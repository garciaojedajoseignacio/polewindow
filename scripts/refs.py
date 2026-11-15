#!/usr/bin/env python3
"""Reference landing/impact sites for the PoleWindow demo.

Only sites with published coordinates are included (sources below). Sites
inside the LOLA LDEM_75S_240M coverage (south of ~75.5 S) get the same
terrain-aware hourly visibility as the grid; others get the spherical
horizon only. Writes docs/data/refs.json and docs/data/refs.bin (same
uint16 format as hourly.bin; for spherical-only sites the terrain series
repeat the spherical ones and refs.json marks terrain=false).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "scripts")]

import precompute as P  # noqa: E402

REFS = [
    {"id": "lcross", "name": "LCROSS Centaur impact (Cabeus)", "name_es": "Impacto Centaur del LCROSS (Cabeus)", "lat": -84.6796, "lon_e": -48.7093,
     "mission": "NASA LCROSS", "date": "2009-10-09", "kind": "impact",
     "outcome": {"en": "Planned impact into a permanently shadowed crater; water detected in the ejecta plume.",
                 "es": "Impacto planificado en un cráter en sombra permanente; se detectó agua en la pluma de eyección."},
     "source": "Marshall et al. (2011), Space Sci. Rev. 167, Locating the LCROSS Impact Craters",
     "url": "https://doi.org/10.1007/s11214-011-9765-0"},
    {"id": "im2", "name": "IM-2 Athena (Mons Mouton)", "name_es": "IM-2 Athena (Mons Mouton)", "lat": -84.7906, "lon_e": 29.1957,
     "mission": "Intuitive Machines IM-2 (NASA CLPS)", "date": "2025-03-06", "kind": "landing",
     "outcome": {"en": "Landed on its side in a 20 m crater; operated about 12 hours.",
                 "es": "Quedó de costado en un cráter de 20 m; operó cerca de 12 horas."},
     "source": "LROC (NASA/GSFC/Arizona State University), IM-2 Athena Seen Obliquely",
     "url": "https://lroc.im-ldi.com/images/1408"},
    {"id": "im1", "name": "IM-1 Odysseus (near Malapert A)", "name_es": "IM-1 Odysseus (cerca de Malapert A)", "lat": -80.13, "lon_e": 1.44,
     "mission": "Intuitive Machines IM-1 (NASA CLPS)", "date": "2024-02-22", "kind": "landing",
     "outcome": {"en": "First CLPS soft landing; tipped over on a ~12° slope but operated for several days.",
                 "es": "Primer alunizaje suave de CLPS; se volcó en una pendiente de ~12° pero operó varios días."},
     "source": "NASA, NASA's LRO Images Intuitive Machines' Odysseus Lander (26 Feb 2024)",
     "url": "https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/"},
    {"id": "ch3", "name": "Chandrayaan-3 Vikram (Statio Shiv Shakti)", "name_es": "Chandrayaan-3 Vikram (Statio Shiv Shakti)", "lat": -69.373, "lon_e": 32.319,
     "mission": "ISRO Chandrayaan-3", "date": "2023-08-23", "kind": "landing",
     "outcome": {"en": "Successful soft landing; the Pragyan rover drove about 100 m.",
                 "es": "Alunizaje suave exitoso; el rover Pragyan recorrió unos 100 m."},
     "source": "ISRO / LPSC 2025 abstract 1951",
     "url": "https://www.hou.usra.edu/meetings/lpsc2025/pdf/1951.pdf"},
    {"id": "ce6", "name": "Chang'e-6 (Apollo basin, far side)", "name_es": "Chang'e-6 (cuenca Apolo, cara oculta)", "lat": -41.6385, "lon_e": -153.9852,
     "mission": "CNSA Chang'e-6", "date": "2024-06-01", "kind": "landing",
     "outcome": {"en": "First sample return from the lunar far side (1,935 g).",
                 "es": "Primera devolución de muestras de la cara oculta (1.935 g)."},
     "source": "NASA, NASA's LRO Spots China's Chang'e 6 Spacecraft on Lunar Far Side; CNSA via The Innovation (2024)",
     "url": "https://www.nasa.gov/centers-and-facilities/goddard/nasas-lro-spots-chinas-change-6-spacecraft-on-lunar-far-side/"},
]


def main():
    sites = json.load(open(ROOT / "docs" / "data" / "sites.json"))
    extras = json.load(open(ROOT / "docs" / "data" / "extras.json"))
    grid = json.load(open(ROOT / "docs" / "data" / "grid.json"))
    year = sites["meta"]["year"]
    t, sun, earth = P.body_vectors(year)
    n = len(sun)
    dem = P.Dem(ROOT / "data" / "ldem_75s_240m.img")
    ldsm = np.fromfile(ROOT / "data" / "ldsm_75s_240m.img", dtype="<i2").reshape(P.DEM_N, P.DEM_N) * 0.0015 + 45.0
    gx, gy = np.array(grid["x_km"]), np.array(grid["y_km"])
    psr = np.array(extras["grid"]["psr"]) == 1
    rmax = 2 * P.R_M * np.tan(np.radians(90 + grid["max_lat"]) / 2) / 1000.0
    parts, out = [], []
    for r in REFS:
        lat, lon = r["lat"], r["lon_e"] % 360.0
        sa, sz = P.altaz(sun, lat, lon)
        ea, ez = P.altaz(earth, lat, lon)
        s_sun, s_earth = sa > 0, ea > 0
        rec = dict(r)
        rec["lon_e"] = round(lon, 4)
        rec["spherical"] = P.stats(s_sun, s_earth)
        inside = lat <= -75.5
        rec["terrain"] = inside
        x, y = P.Dem.project(lat, lon)
        rec["x_km"], rec["y_km"] = round(float(x) / 1000, 3), round(float(y) / 1000, 3)
        rec["in_map"] = bool(abs(rec["x_km"]) <= 200 and abs(rec["y_km"]) <= 200)
        if inside:
            mask, h = P.horizon_mask(dem, lat, lon)
            t_sun, t_earth = sa > P.mask_at(mask, sz), ea > P.mask_at(mask, ez)
            rec["terrain_stats"] = P.stats(t_sun, t_earth)
            rec["elev_m"] = round(h, 1)
            col = int(round(float(x) / P.DEM_SCALE + P.DEM_N / 2 - 0.5))
            row = int(round(-float(y) / P.DEM_SCALE + P.DEM_N / 2 - 0.5))
            rec["slope_deg"] = round(float(ldsm[row, col]), 2)
        else:
            t_sun, t_earth = s_sun, s_earth
        r_km = float(np.hypot(x, y)) / 1000
        if r_km <= rmax:
            rec["psr_km"] = 0.0 if (inside and rec["terrain_stats"]["sun_pct"] <= 0) else round(float(np.sqrt((gx[psr] - x / 1000) ** 2 + (gy[psr] - y / 1000) ** 2).min()), 2)
        parts += P.encode_hourly((t_sun, t_earth, s_sun, s_earth))
        out.append(rec)
        print(r["id"], "terrain" if inside else "spherical-only", rec.get("terrain_stats", rec["spherical"]), rec.get("slope_deg"), rec.get("psr_km"))
    with open(ROOT / "docs" / "data" / "refs.json", "w") as f:
        json.dump({"refs": out}, f, separators=(",", ":"), ensure_ascii=False)
    with open(ROOT / "docs" / "data" / "refs.bin", "wb") as f:
        f.write(np.array([len(out), 4, n], dtype="<u2").tobytes())
        for p in parts:
            f.write(p.tobytes())


if __name__ == "__main__":
    main()
