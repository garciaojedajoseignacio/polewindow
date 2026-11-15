#!/usr/bin/env python3
"""Sun and Earth elevation windows at lunar south-pole sites.

Uses JPL DE421 ephemerides and the IAU Mean Earth lunar frame
(MOON_ME_DE421) via Skyfield. The horizon is a smooth sphere:
LOLA terrain / local ridgelines are NOT applied.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from skyfield.api import Loader, PlanetaryConstants

from sites import SITES, SITES_BY_ID

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

# Mean solar/Earth radii for apparent-disk (upper-limb) tests.
SUN_RADIUS_KM = 695_700.0
EARTH_RADIUS_KM = 6371.0

DEFAULT_START = datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)
DEFAULT_END = datetime(2027, 3, 31, 23, 0, tzinfo=timezone.utc)
MAX_DAYS = 180
STEP_HOURS = 1

METHOD = {
    "ephemeris": "JPL DE421 (de421.bsp) via Skyfield",
    "lunar_frame": "MOON_ME_DE421 (Mean Earth; cartographic / IAU style)",
    "kernels": [
        "de421.bsp",
        "moon_080317.tf",
        "pck00008.tpc",
        "moon_pa_de421_1900-2050.bpc",
    ],
    "horizon": "flat spherical lunar horizon (no LOLA terrain / local skyline)",
    "sunlit_center": "Sun geometric center elevation > 0 deg",
    "sunlit_limb": "Sun elevation + apparent solar semidiameter > 0 deg",
    "earth_visible_center": "Earth geometric center elevation > 0 deg",
    "earth_visible_limb": "Earth elevation + apparent Earth semidiameter > 0 deg",
    "step": "1 hour",
}

_KERNELS = None


def load_kernels():
    """Load DE421 and lunar orientation kernels (cached after first call)."""
    global _KERNELS
    if _KERNELS is not None:
        return _KERNELS
    DATA.mkdir(exist_ok=True)
    load = Loader(str(DATA))
    ts = load.timescale()
    eph = load("de421.bsp")
    pc = PlanetaryConstants()
    pc.read_text(load("moon_080317.tf"))
    pc.read_text(load("pck00008.tpc"))
    pc.read_binary(load("moon_pa_de421_1900-2050.bpc"))
    frame = pc.build_frame_named("MOON_ME_DE421")
    _KERNELS = (ts, eph, pc, frame)
    return _KERNELS


def parse_utc(value, *, end_of_day=False):
    """Parse a YYYY-MM-DD or YYYY-MM-DDTHH:MM date/time as UTC.

    A bare date is 00:00 UTC, or 23:00 UTC when end_of_day is True, so a
    range of 2027-01-01 to 2027-03-31 matches the verified 2160-hour span.
    """
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.replace(minute=0, second=0, microsecond=0)

    text = str(value).strip().replace("Z", "")
    if "T" in text:
        dt = datetime.fromisoformat(text)
    else:
        dt = datetime.strptime(text[:10], "%Y-%m-%d")
        if end_of_day:
            dt = dt.replace(hour=23)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.replace(minute=0, second=0, microsecond=0)


def build_times(ts, start, end, step_hours=STEP_HOURS):
    """Hourly Skyfield time array from start through end, inclusive."""
    start = parse_utc(start, end_of_day=False)
    end = parse_utc(end, end_of_day=True)
    if end < start:
        raise ValueError("end must be on or after start")
    delta_hours = int((end - start).total_seconds() // 3600) + 1
    max_hours = MAX_DAYS * 24
    if delta_hours > max_hours:
        raise ValueError(
            f"date range is {delta_hours} hours; maximum is {max_hours} "
            f"({MAX_DAYS} days at a 1-hour step)"
        )
    if delta_hours < 1:
        raise ValueError("date range must include at least one sample")
    # Hour overflow is valid in Skyfield (e.g. 2027-01-01 + 2159 hours).
    hours = start.hour + np.arange(delta_hours) * step_hours
    t = ts.utc(start.year, start.month, start.day, hours)
    return t, start, end, delta_hours


def elevations_for_site(eph, pc, frame, lat, lon_e, t):
    moon = eph["moon"]
    sun = eph["sun"]
    earth = eph["earth"]
    observer = moon + pc.build_latlon_degrees(frame, lat, lon_e, elevation_m=0.0)
    here = observer.at(t)
    sun_alt, sun_az, sun_dist = here.observe(sun).apparent().altaz()
    earth_alt, earth_az, earth_dist = here.observe(earth).apparent().altaz()
    sun_radius_deg = np.degrees(np.arctan(SUN_RADIUS_KM / sun_dist.km))
    earth_radius_deg = np.degrees(np.arctan(EARTH_RADIUS_KM / earth_dist.km))
    return {
        "sun_alt": sun_alt.degrees,
        "earth_alt": earth_alt.degrees,
        "sun_az": sun_az.degrees,
        "earth_az": earth_az.degrees,
        "sun_radius_deg": sun_radius_deg,
        "earth_radius_deg": earth_radius_deg,
    }


def _pct(mask):
    return 100.0 * float(np.mean(mask))


def _longest_run(mask):
    """Longest consecutive True streak, in samples (1-hour step -> hours)."""
    if mask.size == 0:
        return 0
    padded = np.concatenate([[False], mask, [False]])
    diffs = np.diff(padded.astype(int))
    starts = np.where(diffs == 1)[0]
    ends = np.where(diffs == -1)[0]
    if starts.size == 0:
        return 0
    return int((ends - starts).max())


def summarize(data):
    sun_alt = np.asarray(data["sun_alt"])
    earth_alt = np.asarray(data["earth_alt"])
    sun_r = np.asarray(data["sun_radius_deg"])
    earth_r = np.asarray(data["earth_radius_deg"])

    sun_center = sun_alt > 0.0
    sun_limb = (sun_alt + sun_r) > 0.0
    earth_center = earth_alt > 0.0
    earth_limb = (earth_alt + earth_r) > 0.0
    both_center = sun_center & earth_center
    both_limb = sun_limb & earth_limb

    return {
        "n_samples": int(sun_alt.size),
        "sun_center_pct": round(_pct(sun_center), 2),
        "sun_limb_pct": round(_pct(sun_limb), 2),
        "earth_center_pct": round(_pct(earth_center), 2),
        "earth_limb_pct": round(_pct(earth_limb), 2),
        "both_center_pct": round(_pct(both_center), 2),
        "both_limb_pct": round(_pct(both_limb), 2),
        "sun_alt_min_deg": round(float(sun_alt.min()), 3),
        "sun_alt_max_deg": round(float(sun_alt.max()), 3),
        "earth_alt_min_deg": round(float(earth_alt.min()), 3),
        "earth_alt_max_deg": round(float(earth_alt.max()), 3),
        "mean_sun_semidiameter_deg": round(float(np.mean(sun_r)), 4),
        "mean_earth_semidiameter_deg": round(float(np.mean(earth_r)), 4),
        "longest_sun_center_hours": _longest_run(sun_center),
        "longest_sun_night_hours": _longest_run(~sun_center),
        "longest_earth_center_hours": _longest_run(earth_center),
        "longest_earth_outage_hours": _longest_run(~earth_center),
        "longest_both_center_hours": _longest_run(both_center),
    }


def _series_payload(t, data):
    times = [t[i].utc_strftime("%Y-%m-%dT%H:%M:%SZ") for i in range(len(t))]
    return {
        "times": times,
        "sun_alt": [round(float(x), 4) for x in np.asarray(data["sun_alt"])],
        "earth_alt": [round(float(x), 4) for x in np.asarray(data["earth_alt"])],
        "sun_az": [round(float(x), 4) for x in np.asarray(data["sun_az"])],
        "earth_az": [round(float(x), 4) for x in np.asarray(data["earth_az"])],
    }


def rank_sites(rows, key="both_center_pct"):
    ranked = sorted(rows, key=lambda row: row.get(key, 0.0), reverse=True)
    out = []
    for i, row in enumerate(ranked, start=1):
        out.append(
            {
                "rank": i,
                "id": row["id"],
                "name": row["name"],
                "lat": row["lat"],
                "lon_e": row["lon_e"],
                "sun_center_pct": row["sun_center_pct"],
                "earth_center_pct": row["earth_center_pct"],
                "both_center_pct": row["both_center_pct"],
                "sun_limb_pct": row["sun_limb_pct"],
                "earth_limb_pct": row["earth_limb_pct"],
                "both_limb_pct": row["both_limb_pct"],
            }
        )
    return out


def compute(
    sites=None,
    start=None,
    end=None,
    include_series=False,
    custom=None,
):
    """Compute elevation windows for one or more sites.

    sites: list of site dicts or site id strings. Defaults to the five
    cited sites. custom: optional dict with lat, lon_e, and optional name.
    """
    ts, eph, pc, frame = load_kernels()
    start = start or DEFAULT_START
    end = end or DEFAULT_END
    t, start_dt, end_dt, n_hours = build_times(ts, start, end)

    chosen = []
    if sites is None:
        chosen = [dict(site) for site in SITES]
    else:
        for item in sites:
            if isinstance(item, str):
                if item not in SITES_BY_ID:
                    raise ValueError(f"unknown site id: {item}")
                chosen.append(dict(SITES_BY_ID[item]))
            else:
                chosen.append(dict(item))

    if custom:
        lat = float(custom["lat"])
        lon_e = float(custom["lon_e"] if "lon_e" in custom else custom["lon"])
        if not -90.0 <= lat <= 90.0:
            raise ValueError("custom latitude must be between -90 and 90")
        if not -180.0 <= lon_e <= 360.0:
            raise ValueError("custom longitude must be between -180 and 360")
        chosen.append(
            {
                "id": custom.get("id") or "custom",
                "name": custom.get("name") or "Custom site",
                "lat": lat,
                "lon_e": lon_e,
                "source": custom.get("source") or "User-provided coordinates",
                "kind": "custom",
            }
        )

    if not chosen:
        raise ValueError("select at least one site")

    rows = []
    for site in chosen:
        data = elevations_for_site(
            eph, pc, frame, float(site["lat"]), float(site["lon_e"]), t
        )
        summary = summarize(data)
        summary.update(
            {
                "id": site["id"],
                "name": site["name"],
                "lat": site["lat"],
                "lon_e": site["lon_e"],
                "source": site.get("source", ""),
                "kind": site.get("kind", ""),
            }
        )
        if include_series:
            summary["series"] = _series_payload(t, data)
        rows.append(summary)

    return {
        "method": {
            **METHOD,
            "time_span_utc": [
                t[0].utc_strftime("%Y-%m-%d %H:%M"),
                t[-1].utc_strftime("%Y-%m-%d %H:%M"),
            ],
            "n_samples": n_hours,
        },
        "sites": rows,
        "ranking": rank_sites(rows),
    }


def format_table(result):
    rows = result["sites"]
    span = result["method"]["time_span_utc"]
    lines = [
        "PoleWindow — Sun and Earth windows (spherical lunar horizon, no LOLA)",
        f"Interval: {span[0]} to {span[1]} UTC  |  "
        f"{result['method']['n_samples']} hourly samples  |  "
        f"frame {result['method']['lunar_frame']}",
        "",
    ]
    header = (
        f"{'Site':<42} {'Sun %':>8} {'Sun limb':>9} "
        f"{'Earth %':>8} {'Earth lm':>9} {'Both %':>8} "
        f"{'Sun min/max':>16}"
    )
    lines.append(header)
    lines.append("-" * len(header))
    for row in rows:
        alt = f"{row['sun_alt_min_deg']:+.3f}/{row['sun_alt_max_deg']:+.3f}"
        lines.append(
            f"{row['name']:<42} {row['sun_center_pct']:>7.2f}% "
            f"{row['sun_limb_pct']:>8.2f}% {row['earth_center_pct']:>7.2f}% "
            f"{row['earth_limb_pct']:>8.2f}% {row['both_center_pct']:>7.2f}% "
            f"{alt:>16}"
        )
    lines.append("")
    lines.append("Ranking by combined window (Sun and Earth center both above horizon):")
    for item in result["ranking"]:
        lines.append(
            f"  {item['rank']}. {item['name']}: both {item['both_center_pct']:.2f}% "
            f"(Sun {item['sun_center_pct']:.2f}%, Earth {item['earth_center_pct']:.2f}%)"
        )
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=(
            "Compute Sun and Earth elevation windows at lunar south-pole sites."
        )
    )
    parser.add_argument("--start", default="2027-01-01", help="Start date UTC")
    parser.add_argument("--end", default="2027-03-31", help="End date UTC")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print JSON instead of a table",
    )
    args = parser.parse_args(argv)

    result = compute(start=args.start, end=args.end, include_series=False)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(format_table(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
