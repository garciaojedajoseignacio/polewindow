#!/usr/bin/env python3
"""Extra layers for the PoleWindow demo (run after scripts/precompute.py).

Writes docs/data/extras.json with:
  * slope_deg: LRO LOLA gridded bidirectional slope LDSM_75S_240M (PDS
    Geosciences Node, LRO-L-LOLA-4-GDR-V1.0) sampled at each grid point and
    site (nearest 240 m pixel). The label says slopes come from plane fits
    to successive laser shots (baseline about 30-120 m) and are gridded at
    240 m/pixel.
  * slope_dem_deg: slope of LDEM_75S_240M (Horn 3x3 method, ~720 m window),
    kept for comparison.
  * psr_km: distance to the nearest grid point that gets no direct sunlight
    (Sun center never above the LOLA horizon) during the whole year in
    sites.json/grid.json. A permanently-shadowed-region (PSR) proxy at grid
    resolution, not an official PSR map.
  * moon: daily Earth-Moon center-to-center distance (km, 00:00 UTC) from
    JPL DE421 via Skyfield, plus the year's hourly minimum and maximum.

Download the slope map with:
  curl -o data/ldsm_75s_240m.img https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldsm_75s_240m.img
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from compute import load_kernels  # noqa: E402
from precompute import DEM_N, DEM_SCALE, Dem  # noqa: E402


def pixel(lat, lon):
    x, y = Dem.project(lat, lon)
    col = np.rint(x / DEM_SCALE + DEM_N / 2.0 - 0.5).astype(int)
    row = np.rint(-y / DEM_SCALE + DEM_N / 2.0 - 0.5).astype(int)
    return np.clip(row, 0, DEM_N - 1), np.clip(col, 0, DEM_N - 1)


def main():
    docs = ROOT / "docs"
    grid = json.load(open(docs / "data" / "grid.json"))
    sites = json.load(open(docs / "data" / "sites.json"))
    year = sites["meta"]["year"]

    ldsm = np.fromfile(ROOT / "data" / "ldsm_75s_240m.img", dtype="<i2").reshape(DEM_N, DEM_N)
    slope = ldsm.astype(np.float32) * 0.0015 + 45.0
    dem = Dem(ROOT / "data" / "ldem_75s_240m.img").h.astype(np.float64)
    # Horn slope of the DEM (ground pixel size ~240 m near the pole).
    p = np.pad(dem, 1, mode="edge")
    dzdx = ((p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[1:-1, :-2] + p[2:, :-2])) / (8 * DEM_SCALE)
    dzdy = ((p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:])) / (8 * DEM_SCALE)
    slope_dem = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))

    glat, glon = np.array(grid["lat"]), np.array(grid["lon_e"])
    r, c = pixel(glat, glon)
    g_slope = slope[r, c]
    g_sdem = slope_dem[r, c]

    gx, gy = np.array(grid["x_km"]), np.array(grid["y_km"])
    psr = np.array(grid["sun_t"]) <= 0.0
    px, py = gx[psr], gy[psr]

    def psr_dist(x, y):
        if px.size == 0:
            return None
        return float(np.sqrt((px - x) ** 2 + (py - y) ** 2).min())

    g_psr = [round(psr_dist(x, y), 2) for x, y in zip(gx, gy)]

    site_out = {}
    for s in sites["sites"]:
        rr, cc = pixel(np.array([s["lat"]]), np.array([s["lon_e"]]))
        self_psr = s["terrain"]["sun_pct"] <= 0.0
        site_out[s["id"]] = {
            "slope_deg": round(float(slope[rr[0], cc[0]]), 2),
            "slope_dem_deg": round(float(slope_dem[rr[0], cc[0]]), 2),
            "psr_km": 0.0 if self_psr else round(psr_dist(s["x_km"], s["y_km"]), 2),
            "psr_self": bool(self_psr),
        }
        print(s["id"], site_out[s["id"]])

    # Earth-Moon distance.
    ts, eph, pc, frame = load_kernels()
    start_day = -12  # from 20 Dec of the previous year, for departure dates
    n_days = 365 + 12 + 6
    t = ts.utc(year, 1, 1 + start_day + np.arange(n_days))
    km = (eph["moon"] - eph["earth"]).at(t).distance().km
    th = ts.utc(year, 1, 1, np.arange(sites["meta"]["n_hours"]))
    kh = (eph["moon"] - eph["earth"]).at(th).distance().km
    imin, imax = int(kh.argmin()), int(kh.argmax())
    moon = {
        "start": t[0].utc_strftime("%Y-%m-%d"),
        "km": [int(round(v)) for v in km],
        "min": {"utc": th[imin].utc_strftime("%Y-%m-%dT%H:%MZ"), "km": int(round(kh[imin]))},
        "max": {"utc": th[imax].utc_strftime("%Y-%m-%dT%H:%MZ"), "km": int(round(kh[imax]))},
        "source": "JPL DE421 via Skyfield, Earth center to Moon center, geometric",
    }
    print("moon min/max", moon["min"], moon["max"], "psr points", int(psr.sum()))

    out = {
        "meta": {
            "slope_product": "LRO LOLA LDSM_75S_240M (LRO-L-LOLA-4-GDR-V1.0), bidirectional slope, 240 m/pixel",
            "slope_url": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldsm_75s_240m.img",
            "psr_rule": "grid points with 0 hours of Sun center above the LOLA horizon in the year",
            "n_psr_points": int(psr.sum()),
        },
        "grid": {
            "slope_deg": [round(float(v), 1) for v in g_slope],
            "slope_dem_deg": [round(float(v), 1) for v in g_sdem],
            "psr_km": g_psr,
            "psr": [int(v) for v in psr],
        },
        "sites": site_out,
        "moon": moon,
    }
    with open(docs / "data" / "extras.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
