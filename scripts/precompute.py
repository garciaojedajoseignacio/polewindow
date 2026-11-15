#!/usr/bin/env python3
"""Precompute PoleWindow data for the static GitHub Pages demo.

Outputs (written to docs/):
  data/sites.json  - the 5 cited sites: yearly Sun/Earth/both %, longest dark
                     period, daily hours, hourly bitsets, LOLA horizon masks,
                     sampled Sun/Earth tracks. Spherical AND terrain-aware.
  data/grid.json   - ~900 south-pole grid points (lat -84 to -90) with the same
                     yearly statistics, for "click anywhere" custom coordinates.
  assets/lola_hillshade.png - shaded relief from LRO LOLA LDEM_75S_240M,
                     cropped to +/-200 km around the south pole, same polar
                     stereographic projection as the SVG chart.

Ephemerides: JPL DE421 + MOON_ME_DE421 frame through Skyfield (see compute.py).
Terrain: LRO LOLA GDR polar stereographic DEM LDEM_75S_240M (PDS Geosciences
Node, data set LRO-L-LOLA-4-GDR-V1.0). Download it with:

  curl -O https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img
  curl -O https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.lbl

and pass --dem path/to/ldem_75s_240m.img (default: data/ldem_75s_240m.img).

Usage: python scripts/precompute.py [--year 2027] [--dem PATH] [--validate]
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from compute import load_kernels, elevations_for_site  # noqa: E402
from sites import SITES  # noqa: E402

R_M = 1737400.0          # LOLA reference sphere radius (m)
DEM_N = 3812             # LDEM_75S_240M lines = samples
DEM_SCALE = 240.0        # m / pixel, exact at the pole
DEM_HALF_PX = 1000       # crop used for shading (+/- 240 km)
MAP_HALF_KM = 200.0      # half-width of the SVG chart / hillshade image
GRID_MAX_LAT = -84.0
GRID_SPACING_KM = 6.0
FINE_RADIUS_KM = 36.0     # denser grid around the pole (Shackleton, ridges)
FINE_SPACING_KM = 1.5
N_AZ = 360               # horizon mask azimuth bins (1 deg)
RAY_MAX_KM = 150.0
RAY_STEP_KM = 0.24       # one DEM pixel
OBSERVER_HEIGHT_M = 2.0  # eye/antenna height above the LOLA surface


# ---------------------------------------------------------------- ephemeris
def body_vectors(year):
    """Sun and Earth positions (km) from the Moon center in MOON_ME_DE421."""
    ts, eph, pc, frame = load_kernels()
    start = ts.utc(year, 1, 1)
    end = ts.utc(year + 1, 1, 1)
    n = int(round((end.tt - start.tt) * 24))
    t = ts.utc(year, 1, 1, np.arange(n))
    moon = eph["moon"].at(t)
    sun = moon.observe(eph["sun"]).apparent().frame_xyz(frame).km
    earth = moon.observe(eph["earth"]).apparent().frame_xyz(frame).km
    return t, sun.T, earth.T  # (n,3)


def enu_basis(lat_deg, lon_deg):
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    return up, east, north


def altaz(vec_km, lat_deg, lon_deg, height_m=0.0):
    """Topocentric altitude/azimuth (deg) of body vectors for a surface point."""
    up, east, north = enu_basis(lat_deg, lon_deg)
    site = up * (R_M + height_m) / 1000.0
    d = vec_km - site
    dist = np.linalg.norm(d, axis=1)
    alt = np.degrees(np.arcsin(d @ up / dist))
    az = np.degrees(np.arctan2(d @ east, d @ north)) % 360.0
    return alt, az


# ---------------------------------------------------------------- LOLA DEM
class Dem:
    def __init__(self, path):
        raw = np.fromfile(path, dtype="<i2")
        if raw.size != DEM_N * DEM_N:
            raise ValueError(f"unexpected DEM size {raw.size}")
        self.h = raw.reshape(DEM_N, DEM_N).astype(np.float32) * 0.5  # meters

    @staticmethod
    def project(lat_deg, lon_deg):
        """Polar stereographic (DSMAP_POLAR.CAT): x right = 90E, y up = 0E (m)."""
        r = 2.0 * R_M * np.tan(np.radians(90.0 + np.asarray(lat_deg)) / 2.0)
        lo = np.radians(lon_deg)
        return r * np.sin(lo), r * np.cos(lo)

    @staticmethod
    def unproject(x_m, y_m):
        r = np.hypot(x_m, y_m)
        lat = -90.0 + np.degrees(2.0 * np.arctan(0.5 * r / R_M))
        lon = np.degrees(np.arctan2(x_m, y_m)) % 360.0
        return lat, lon

    def sample(self, lat_deg, lon_deg):
        """Bilinear height (m) at planetocentric lat/lon."""
        x, y = self.project(lat_deg, lon_deg)
        col = x / DEM_SCALE + DEM_N / 2.0 - 0.5   # 0-based (I - 1)
        row = -y / DEM_SCALE + DEM_N / 2.0 - 0.5  # 0-based (J - 1)
        c0 = np.clip(np.floor(col).astype(int), 0, DEM_N - 2)
        r0 = np.clip(np.floor(row).astype(int), 0, DEM_N - 2)
        fc = np.clip(col - c0, 0, 1)
        fr = np.clip(row - r0, 0, 1)
        h = self.h
        return ((1 - fr) * ((1 - fc) * h[r0, c0] + fc * h[r0, c0 + 1])
                + fr * ((1 - fc) * h[r0 + 1, c0] + fc * h[r0 + 1, c0 + 1]))


def destination(lat_deg, lon_deg, az_deg, ang_rad):
    """Great-circle destination; az from north, clockwise (east)."""
    p1, l1 = np.radians(lat_deg), np.radians(lon_deg)
    az = np.radians(az_deg)[:, None]
    th = ang_rad[None, :]
    sp2 = np.sin(p1) * np.cos(th) + np.cos(p1) * np.sin(th) * np.cos(az)
    p2 = np.arcsin(np.clip(sp2, -1, 1))
    l2 = l1 + np.arctan2(np.sin(az) * np.sin(th) * np.cos(p1),
                         np.cos(th) - np.sin(p1) * sp2)
    return np.degrees(p2), np.degrees(l2)


def horizon_mask(dem, lat, lon):
    """Terrain horizon elevation angle (deg) for N_AZ azimuths, plus site height."""
    az = np.arange(N_AZ) * (360.0 / N_AZ)
    dist_m = np.arange(RAY_STEP_KM, RAY_MAX_KM + 1e-9, RAY_STEP_KM) * 1000.0
    ang = dist_m / R_M
    h0 = float(dem.sample(np.array([lat]), np.array([lon]))[0]) + OBSERVER_HEIGHT_M
    plat, plon = destination(lat, lon, az, ang)
    ht = dem.sample(plat, plon)
    ro = R_M + h0
    rt = R_M + ht
    vert = rt * np.cos(ang)[None, :] - ro
    horiz = rt * np.sin(ang)[None, :]
    elev = np.degrees(np.arctan2(vert, horiz)).max(axis=1)
    return elev, h0 - OBSERVER_HEIGHT_M


def mask_at(mask, az_deg):
    """Linear interpolation of the horizon mask at arbitrary azimuths."""
    step = 360.0 / N_AZ
    f = (az_deg % 360.0) / step
    i0 = np.floor(f).astype(int) % N_AZ
    i1 = (i0 + 1) % N_AZ
    w = f - np.floor(f)
    return mask[i0] * (1 - w) + mask[i1] * w


# ---------------------------------------------------------------- statistics
def longest_run(mask):
    if not mask.any():
        return 0
    padded = np.concatenate([[False], mask, [False]]).astype(np.int8)
    d = np.diff(padded)
    return int((np.where(d == -1)[0] - np.where(d == 1)[0]).max())


def stats(sun_vis, earth_vis):
    both = sun_vis & earth_vis
    return {
        "sun_pct": round(100.0 * sun_vis.mean(), 2),
        "earth_pct": round(100.0 * earth_vis.mean(), 2),
        "both_pct": round(100.0 * both.mean(), 2),
        "longest_dark_h": longest_run(~sun_vis),
        "longest_earth_outage_h": longest_run(~earth_vis),
    }


def bits_b64(mask):
    return base64.b64encode(np.packbits(mask.astype(np.uint8)).tobytes()).decode()


def daily_hours(mask):
    n = mask.size // 24
    return mask[: n * 24].reshape(n, 24).sum(axis=1).astype(int).tolist()


# ---------------------------------------------------------------- hillshade
def write_hillshade(dem, out_png, out_px=800, half_km=MAP_HALF_KM):
    from PIL import Image

    half = int(round(half_km * 1000 / DEM_SCALE))  # pixels
    c = DEM_N // 2
    z = dem.h[c - half - 1:c + half + 1, c - half - 1:c + half + 1].astype(np.float64)
    gy, gx = np.gradient(z, DEM_SCALE)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, alt = np.radians(315.0), np.radians(35.0)  # illustrative light only
    shade = (np.sin(alt) * np.cos(slope)
             + np.cos(alt) * np.sin(slope) * np.cos(az - aspect))
    shade = np.clip(shade, 0, 1)[1:-1, 1:-1]
    zc = z[1:-1, 1:-1]
    zn = (zc - np.percentile(zc, 1)) / (np.percentile(zc, 99) - np.percentile(zc, 1))
    zn = np.clip(zn, 0, 1)
    # Dark-theme tint: low = deep blue-grey, high = warm grey, modulated by shade.
    lo = np.array([30, 40, 62.0])
    hi = np.array([214, 206, 190.0])
    rgb = (lo[None, None, :] * (1 - zn[..., None]) + hi[None, None, :] * zn[..., None])
    rgb = rgb * (0.35 + 0.75 * shade[..., None])
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    img = img.resize((out_px, out_px), Image.LANCZOS)
    img = img.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    img.save(out_png, optimize=True)


# ---------------------------------------------------------------- main
def site_record(dem, sun, earth, lat, lon, include_detail):
    sa, sz = altaz(sun, lat, lon)
    ea, ez = altaz(earth, lat, lon)
    sph_sun, sph_earth = sa > 0.0, ea > 0.0
    rec = {"spherical": stats(sph_sun, sph_earth)}
    if dem is not None:
        mask, h = horizon_mask(dem, lat, lon)
        ter_sun = sa > mask_at(mask, sz)
        ter_earth = ea > mask_at(mask, ez)
        rec["terrain"] = stats(ter_sun, ter_earth)
        rec["elev_m"] = round(h, 1)
        if include_detail:
            rec["horizon_deg"] = [round(float(v), 3) for v in mask]
            rec["daily"] = {
                "sun_t": daily_hours(ter_sun),
                "earth_t": daily_hours(ter_earth),
                "both_t": daily_hours(ter_sun & ter_earth),
                "sun_s": daily_hours(sph_sun),
                "earth_s": daily_hours(sph_earth),
                "both_s": daily_hours(sph_sun & sph_earth),
            }
            rec["hourly_b64"] = {
                "sun_t": bits_b64(ter_sun), "earth_t": bits_b64(ter_earth),
                "sun_s": bits_b64(sph_sun), "earth_s": bits_b64(sph_earth),
            }
    if include_detail:
        step = 6
        rec["track"] = {
            "step_h": step,
            "sun_az": np.round(sz[::step]).astype(int).tolist(),
            "sun_alt": np.round(sa[::step], 2).tolist(),
            "earth_az": np.round(ez[::step]).astype(int).tolist(),
            "earth_alt": np.round(ea[::step], 2).tolist(),
        }
    return rec


def validate(year_vectors_fn):
    """Compare the vectorised alt/az with compute.py (Skyfield topocentric)."""
    ts, eph, pc, frame = load_kernels()
    t = ts.utc(2027, 1, 1, np.arange(0, 2160, 7))
    moon = eph["moon"].at(t)
    sun = moon.observe(eph["sun"]).apparent().frame_xyz(frame).km.T
    earth = moon.observe(eph["earth"]).apparent().frame_xyz(frame).km.T
    worst = 0.0
    for s in SITES:
        ref = elevations_for_site(eph, pc, frame, s["lat"], s["lon_e"], t)
        sa, _ = altaz(sun, s["lat"], s["lon_e"])
        ea, _ = altaz(earth, s["lat"], s["lon_e"])
        d = max(np.abs(sa - ref["sun_alt"]).max(), np.abs(ea - ref["earth_alt"]).max())
        worst = max(worst, d)
        print(f"  validate {s['id']}: max |dAlt| = {d:.5f} deg")
    return worst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2027)
    ap.add_argument("--dem", default=str(ROOT / "data" / "ldem_75s_240m.img"))
    ap.add_argument("--out", default=str(ROOT / "docs"))
    ap.add_argument("--validate", action="store_true")
    args = ap.parse_args()
    out = Path(args.out)
    (out / "data").mkdir(parents=True, exist_ok=True)
    (out / "assets").mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    worst = validate(None) if args.validate else None
    t, sun, earth = body_vectors(args.year)
    n = len(sun)
    print(f"ephemeris: {n} hourly samples for {args.year} ({time.time()-t0:.1f}s)")

    dem = Dem(args.dem) if Path(args.dem).exists() else None
    if dem is None:
        print("WARNING: DEM not found, terrain-aware results skipped")
    else:
        write_hillshade(dem, out / "assets" / "lola_hillshade.png")
        # Native-resolution (240 m) inset for the zoomed pole view, +/-40 km.
        write_hillshade(dem, out / "assets" / "lola_hillshade_pole.png",
                        out_px=2 * int(round(40000 / DEM_SCALE)), half_km=40.0)
        print(f"hillshade written ({time.time()-t0:.1f}s)")

    meta = {
        "year": args.year,
        "start_utc": t[0].utc_strftime("%Y-%m-%dT%H:%MZ"),
        "end_utc": t[-1].utc_strftime("%Y-%m-%dT%H:%MZ"),
        "n_hours": n,
        "step_h": 1,
        "visibility_rule": "body center above horizon (spherical: 0 deg; terrain: LOLA horizon mask at that azimuth)",
        "ephemeris": "JPL DE421 via Skyfield; lunar frame MOON_ME_DE421 (NAIF moon_080317.tf, moon_pa_de421_1900-2050.bpc, pck00008.tpc)",
        "dem": "LRO LOLA GDR LDEM_75S_240M (LRO-L-LOLA-4-GDR-V1.0, V2.0 2017-06-15), 240 m/pixel polar stereographic, reference radius 1737.4 km" if dem else None,
        "dem_url": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img" if dem else None,
        "horizon": {"azimuth_bins": N_AZ, "ray_max_km": RAY_MAX_KM, "ray_step_km": RAY_STEP_KM,
                    "observer_height_m": OBSERVER_HEIGHT_M},
        "map": {"projection": "south polar stereographic, sphere R=1737.4 km, 0E up, 90E right",
                "half_width_km": MAP_HALF_KM, "pole_inset_half_width_km": 40.0},
        "validation_max_alt_diff_deg": None if worst is None else round(float(worst), 5),
    }

    sites_out = []
    for s in SITES:
        rec = site_record(dem, sun, earth, s["lat"], s["lon_e"], True)
        x, y = Dem.project(s["lat"], s["lon_e"])
        rec.update({"id": s["id"], "name": s["name"], "lat": s["lat"], "lon_e": s["lon_e"],
                    "x_km": round(float(x) / 1000, 3), "y_km": round(float(y) / 1000, 3),
                    "source": s["source"], "kind": s["kind"]})
        sites_out.append(rec)
        print(f"  {s['id']}: sph {rec['spherical']}  ter {rec.get('terrain')}")
    with open(out / "data" / "sites.json", "w") as f:
        json.dump({"meta": meta, "sites": sites_out}, f, separators=(",", ":"))

    rmax = 2 * R_M * np.tan(np.radians(90 + GRID_MAX_LAT) / 2) / 1000.0

    def square_grid(spacing, radius, exclude=None):
        k = int(np.floor(radius / spacing))
        ax = np.arange(-k, k + 1) * spacing
        xx, yy = np.meshgrid(ax, ax)
        rr = np.hypot(xx, yy)
        keep = rr <= radius + 1e-6
        if exclude is not None:
            keep &= rr > exclude
        return xx[keep], yy[keep]

    cx, cy = square_grid(GRID_SPACING_KM, rmax, exclude=FINE_RADIUS_KM - GRID_SPACING_KM)
    fx, fy = square_grid(FINE_SPACING_KM, FINE_RADIUS_KM)
    gx = np.concatenate([fx, cx])
    gy = np.concatenate([fy, cy])
    gs = np.concatenate([np.full(fx.size, FINE_SPACING_KM), np.full(cx.size, GRID_SPACING_KM)])
    glat, glon = Dem.unproject(gx * 1000, gy * 1000)
    cols = {k_: [] for k_ in ["sun_s", "earth_s", "both_s", "dark_s", "sun_t", "earth_t",
                              "both_t", "dark_t", "elev"]}
    for i, (la, lo) in enumerate(zip(glat, glon)):
        rec = site_record(dem, sun, earth, float(la), float(lo), False)
        sp = rec["spherical"]
        cols["sun_s"].append(sp["sun_pct"]); cols["earth_s"].append(sp["earth_pct"])
        cols["both_s"].append(sp["both_pct"]); cols["dark_s"].append(sp["longest_dark_h"])
        if dem is not None:
            tr = rec["terrain"]
            cols["sun_t"].append(tr["sun_pct"]); cols["earth_t"].append(tr["earth_pct"])
            cols["both_t"].append(tr["both_pct"]); cols["dark_t"].append(tr["longest_dark_h"])
            cols["elev"].append(int(round(rec["elev_m"])))
        if i % 500 == 0:
            print(f"  grid {i}/{len(glat)} ({time.time()-t0:.1f}s)")
    grid = {"spacing_km": GRID_SPACING_KM, "fine_spacing_km": FINE_SPACING_KM,
            "fine_radius_km": FINE_RADIUS_KM, "cell_km": gs.tolist(), "max_lat": GRID_MAX_LAT, "n": int(len(glat)),
            "x_km": np.round(gx, 2).tolist(), "y_km": np.round(gy, 2).tolist(),
            "lat": np.round(glat, 4).tolist(), "lon_e": np.round(glon, 4).tolist(), **cols}
    with open(out / "data" / "grid.json", "w") as f:
        json.dump(grid, f, separators=(",", ":"))
    print(f"done in {time.time()-t0:.1f}s; grid points = {len(glat)}")


if __name__ == "__main__":
    main()
