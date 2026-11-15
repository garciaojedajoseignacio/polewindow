# PoleWindow

PoleWindow is a simple web tool that lets mission planners, educators, and the public compare lunar south-pole landing sites and date ranges in minutes. For each site it shows when the Sun is above the horizon (solar-power window) and when Earth is above the horizon (direct-to-Earth communications window), using JPL DE421 ephemerides — the same family of geometry provided by NASA’s Horizons System — in an interactive chart and a ranking table.

This project was built for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) challenge **Lunar Landing Site Navigator** by team **Kirby Landers**.

## Live demo (GitHub Pages)

**https://garciaojedajoseignacio.github.io/polewindow/**

The demo is a static page (plain HTML, CSS, and JavaScript; no server, no login, no API keys). It loads precomputed JSON for the whole year **2027** at a **1-hour step** (8,760 samples) and shows:

- A south polar stereographic map (±200 km around the pole) over a shaded-relief image made from **LRO LOLA** topography, with a heat map of Sun, Earth, Sun + Earth visibility or longest night.
- **Click anywhere** between 84°S and the pole to read the values at the nearest of 4,597 precomputed grid points (1.5 km spacing within 36 km of the pole, 6 km beyond).
- A **date range** selector (presets: full year, quarters, months, or any start/end date in 2027). All statistics, the ranking, the heat map and the timelines are recomputed in the browser from the hourly data.
- A sortable ranking of the five cited sites with Sun %, Earth %, Sun + Earth %, **longest continuous sunlight**, longest night, **longest Earth blackout** and **number of Earth contact drop-outs**, plus an auto-generated one-sentence explanation of why the #1 site wins. Toggle between the **terrain-aware (LOLA)** and the **spherical** horizon.
- **Timelines** as three aligned bands (Sun, Earth, Both) for each site and for any clicked grid point, with a date/time tooltip; each site's LOLA horizon profile with the Sun and Earth paths.
- English / Chilean Spanish language switch (default English; `?lang=es` also works).
- Method, sources, validation and limitations.

Hourly visibility for the 5 sites and every grid point is stored in `docs/data/hourly.bin` (about 0.9 MB): for each point and each series (Sun and Earth, terrain and spherical) the initial state and the hours where visibility flips, as little-endian uint16.

The static site lives in [`docs/`](docs/) and is published to the `gh-pages` branch.

## How it answers the challenge

The official challenge asks for an intuitive way to compare landing sites and dates, visualize the Sun and Earth relative to the local horizon, and assess solar-power potential and direct-to-Earth communications windows.

PoleWindow does that in a single page:

- Choose one or more notable south-pole sites, or enter custom lunar latitude and longitude.
- Choose a UTC date range (hourly samples; default 1 January–31 March 2027; up to about 180 days).
- See time-series charts of Sun and Earth elevation versus a spherical local horizon.
- See the percentage of time the Sun is up, Earth is visible, and both are up at once.
- Rank the selected sites for that date range.

The first version uses a smooth lunar horizon (no local terrain), states that limitation clearly, and can later add LOLA topography.

## NASA / JPL data

PoleWindow computes geometry with:

- **JPL DE421** planetary ephemeris (`de421.bsp`), loaded through [Skyfield](https://rhodesmill.org/skyfield/).
- Lunar orientation kernels used to build the cartographic **MOON_ME_DE421** (Mean Earth) frame:
  - `moon_080317.tf`
  - `pck00008.tpc`
  - `moon_pa_de421_1900-2050.bpc`

These are the same JPL/NAIF products that underlie NASA’s [Horizons System](https://ssd.jpl.nasa.gov/horizons/). Elevations are apparent altitude and azimuth at the site: light time, stellar aberration, and gravitational deflection are included; there is no atmospheric refraction on the Moon.

Sunlit (center) means the Sun’s geometric center has elevation greater than 0°. Sunlit (limb) adds the apparent solar semidiameter (solar radius 695,700 km). Earth visibility uses the same rules, with a mean Earth radius of 6,371 km.

### Horizons cross-check

The method was checked against the official NASA JPL Horizons API for **Connecting Ridge** at **2027-01-01 00:00 UTC** (airless apparent azimuth and elevation of the target center; Horizons center frame MEAN_ME). Horizons values below are taken from the saved query output; Skyfield values are the matching one-point comparison.

| Body  | Skyfield az / alt (°)   | Horizons az / alt (°)          |
|-------|-------------------------|--------------------------------|
| Sun   | 53.17551 / 1.29306      | 53.175510539 / 1.293050483     |
| Earth | 157.21826 / −6.67740    | 157.218270838 / −6.677409531   |

The difference is on the order of **0.00001°**. (Horizons listed DE441 as its source in that query; Skyfield used DE421. The agreement is still at the 0.00001° level for this point.)

## Default sites and coordinate sources

Only these five cited sites are bundled. Do not treat crater-center coordinates as official NASA landing-region centroids. NASA announced thirteen 15 km × 15 km candidate region *names* on 19 August 2022 ([news release](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/)) but did not publish official centroid coordinates in that release.

| Site | Lat (°) | Lon E (°) | Source |
|------|---------|-----------|--------|
| Connecting Ridge (proposed landing site inside NASA’s Artemis III Connecting Ridge candidate region) | −89.53432 | 209.94767 | Gracy & Lee, 55th LPSC (2024), abstract 1695, https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf |
| Peak Near Shackleton (proposed landing site inside NASA’s Artemis III Peak Near Shackleton candidate region) | −89.01701 | 126.27302 | Same LPSC 1695 paper |
| Shackleton crater center | −89.67 | 129.78 | USGS / IAU Gazetteer of Planetary Nomenclature, Feature 5450, default Planetographic +East network, https://planetarynames.wr.usgs.gov/Feature/5450 |
| Haworth crater center | −86.90 | −4.00 | USGS / IAU Gazetteer, Feature 14502, https://planetarynames.wr.usgs.gov/Feature/14502 |
| Faustini crater center | −87.18 | 84.31 | USGS / IAU Gazetteer, Feature 1919, https://planetarynames.wr.usgs.gov/Feature/1919 |

## Terrain-aware horizon (LRO LOLA)

The demo adds terrain with the LOLA gridded data record **`LDEM_75S_240M`** (data set `LRO-L-LOLA-4-GDR-V1.0`, product version 2.0, 2017-06-15; 240 m/pixel, south polar stereographic, 75°S to the pole, heights relative to a 1737.4 km sphere, frame "Mean Earth/Polar Axis of DE421"), from the NASA PDS Geosciences Node:

- https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img (29 MB)
- https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.lbl

Projection equations follow the product's `DSMAP_POLAR.CAT`. For each location, `scripts/precompute.py` casts 360 rays (1° azimuth) along great circles out to 150 km, samples the DEM every 240 m (bilinear), accounts for lunar curvature, and keeps the maximum elevation angle per azimuth. The observer is 2 m above the LOLA surface. The Sun or Earth is "visible" when its center is above that horizon at its azimuth. The spherical-horizon results (center above 0°) are kept side by side for comparison.

The DEM itself is not committed (it is gitignored); only the derived `docs/assets/lola_hillshade.png` (illustrative shading, not real lighting) and the JSON results are.

### Results for 2027 (hourly, body center above the horizon)

Terrain-aware ranking with the stability metrics (full year 2027):

| Site | Sun % | Earth % | Both % | Longest sunlight | Longest night | Longest Earth blackout | Earth drop-outs |
|---|---|---|---|---|---|---|---|
| Connecting Ridge (proposed landing site) | 57.35 | 47.67 | 30.41 | 23.6 d | 12.3 d | 14.5 d | 13 |
| Peak Near Shackleton (proposed landing site) | 35.13 | 48.90 | 19.61 | 12.3 d | 28.1 d | 14.0 d | 13 |
| Shackleton crater center | 0.00 | 0.00 | 0.00 | 0 h | all year | all year | 0 |
| Haworth crater center | 0.00 | 0.00 | 0.00 | 0 h | all year | all year | 0 |
| Faustini crater center | 0.00 | 0.00 | 0.00 | 0 h | all year | all year | 0 |

Terrain-aware vs spherical:

| Site | Sun % terrain (spherical) | Earth % terrain (spherical) | Sun + Earth % terrain (spherical) | Longest night, terrain (spherical) |
|---|---|---|---|---|
| Connecting Ridge (proposed landing site) | 57.35 (52.31) | 47.67 (45.22) | 30.41 (24.03) | 12.3 d (165.0 d) |
| Peak Near Shackleton (proposed landing site) | 35.13 (52.15) | 48.90 (44.27) | 19.61 (23.11) | 28.1 d (112.3 d) |
| Shackleton crater center | 0.00 (54.58) | 0.00 (46.10) | 0.00 (24.59) | all year (165.8 d) |
| Haworth crater center | 0.00 (48.96) | 0.00 (62.47) | 0.00 (31.00) | all year (19.6 d) |
| Faustini crater center | 0.00 (49.86) | 0.00 (48.45) | 0.00 (24.87) | all year (20.0 d) |

The three gazetteer crater centers sit on permanently shadowed crater floors in the terrain model, which is why the spherical model badly overstates them. The most sunlit grid points (up to about 68 % of 2027, e.g. 89.69°S, 198.4°E) cluster on the Shackleton rim and the connecting ridge, the same areas reported as highly illuminated in published LOLA illumination studies (e.g., Mazarico et al., 2011, *Icarus* 211, 1066–1081). Our maxima are lower than published values because of the 1.5 km grid, the 240 m DEM, and the center-of-disk rule.

### Limitations

- Visibility uses the **center** of the Sun and Earth; partial solar disk, panel height and orientation are not modeled.
- 240 m resolution smooths summits and ridges; real illumination at a specific lander spot can differ. Higher-resolution LOLA DEMs (5–20 m) exist but were not used.
- One year (2027) only; polar illumination varies over the 18.6-year lunar nodal cycle.
- Earth visibility is geometric line of sight, not a link budget.
- Not an official NASA product and not a mission-planning tool.

## Landing-planning extras

Generated by `scripts/extras.py` (run after `scripts/precompute.py`) into `docs/data/extras.json` (~77 KB):

- **Slope** from the official LOLA gridded slope map **`LDSM_75S_240M`** (LRO-L-LOLA-4-GDR-V1.0, PDS Geosciences Node: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldsm_75s_240m.img), sampled at the nearest 240 m pixel. The product label says the bidirectional slope comes from plane fits to successive laser shots (baseline about 30–120 m), gridded at 240 m. A Horn 3×3 slope of LDEM_75S_240M is also stored (`slope_dem_deg`) for comparison. Thresholds in the UI: < 5° green (ideal), 5–10° amber (caution), ≥ 10° red with "Warning: steep slope – not ideal for landing" / "Advertencia: pendiente elevada – no ideal para alunizaje". Shown in the selected-point card, the site detail, the ranking and as a map layer.
- **PSR proxy and distance**: grid points where the Sun's center never rises above the LOLA horizon in 2027 (564 points) are treated as permanently shadowed; every point gets the distance (km) to the nearest one. Grid resolution only (1.5 km near the pole, 6 km beyond); not an official PSR map.
- **Earth–Moon distance**: daily center-to-center distance from JPL DE421 (20 Dec 2026 – 5 Jan 2028). The 2027 hourly minimum is 357,283 km (21 Jan 22:00 UTC) and the maximum 406,607 km (7 Jan 08:00 UTC). The UI marks NASA's mean perigee (363,300 km) and mean apogee (405,500 km) from the [NASA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html).

In the browser:

- **Launch window planner** (site detail, also for any clicked point): the three longest Sun + Earth periods in the selected range, the Earth departure dates (window start minus a 3–4.5 day transit) and the Earth–Moon distance at departure and arrival. The 3–4.5 day range is a planning assumption based on direct Apollo-style transfers (Apollo 11: launch 16 July 1969 13:32 UTC, lunar orbit insertion 19 July about 17:22 UTC, ~3.2 days; [NASA Apollo 11 Mission Overview](https://www.nasa.gov/history/apollo-11-mission-overview/)). Artemis uses a different architecture, so real timelines differ. **Simplified planning estimate, not a trajectory design.**
- **Filters**: minimum continuous sunlight (3, 6, 7 or 10 days within the range), maximum slope (< 5° or < 10°) and maximum PSR distance (5, 10, 20 km). Non-matching grid cells fade out, ranking rows dim, and the best-spots list only uses matching points.

Results for the five sites (terrain model, full year 2027):

| Site | Slope LDSM (°) | Slope DEM Horn (°) | Distance to PSR proxy |
|---|---|---|---|
| Connecting Ridge | 3.1 (green) | 1.5 | 2.6 km |
| Peak Near Shackleton | 2.8 (green) | 3.1 | 1.9 km |
| Shackleton crater center | 4.9 (green) | 0.9 | inside (no sun all year) |
| Haworth crater center | 12.7 (red, warning) | 11.3 | inside |
| Faustini crater center | 5.1 (amber) | 5.3 | inside |

Example: Connecting Ridge, full year 2027 — longest Sun + Earth window 5 Nov 15:00 → 17 Nov 06:00 UTC (11.6 days); depart Earth 1–2 Nov; Earth–Moon distance at arrival 403,549 km.

**Artemis III regions** are not drawn on the map: NASA published the names (13 in August 2022; refined to 9 on 28 October 2024: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain — [NASA release](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)) and a map image, but no coordinates. Connecting Ridge and Peak Near Shackleton were in the 2022 list but not in the October 2024 list.

Limitations: 240 m slopes are regional (landing-scale hazards need 5–20 m or finer DEMs and imagery); the PSR proxy misses small cold traps; the launch planner ignores launch-site geometry, vehicle performance and orbit design.

### Proposed site

For the selected date range and horizon model, the site picks one grid point (gold star):

- candidates: Sun > 0 %, Earth > 0 %, Sun + Earth > 0 % and LOLA slope (LDSM, 240 m) under 10°, plus any active filters;
- score = Sun + Earth % − 1 point per degree of slope above 5° (so 5–10° slopes are penalized);
- ties: higher Sun %, then lower slope.

Full year 2027, terrain horizon: **84.162°S, 28.30°E** (LOLA elevation 4,912 m, 6 km grid cell) — Sun + Earth 45.1 %, Sun 45.1 %, Earth 100 %, slope 2.1°, 48.4 km from the nearest PSR-proxy point; about 19 km from the IM-2 landing site on the Mons Mouton massif. With the spherical horizon the pick moves to 84.066°S, 358.09°E (39.6 %). It is a starting point for study (6 km cells away from the pole), not a landing recommendation.

### Reference sites

Past landings/impacts with published coordinates (`scripts/refs.py` → `docs/data/refs.json`, `refs.bin`), drawn as cyan diamonds (toggle "Reference sites"):

| Site | Coordinates | Source | Model | Sun % | Earth % | Both % | Slope |
|---|---|---|---|---|---|---|---|
| LCROSS Centaur impact, Cabeus (2009-10-09) | 84.6796°S, 48.7093°W | Marshall et al. 2011, [Space Sci. Rev.](https://doi.org/10.1007/s11214-011-9765-0) | terrain | 0 | 15.2 | 0 | 2.8° |
| IM-2 Athena, Mons Mouton (2025-03-06) | 84.7906°S, 29.1957°E | [LROC](https://lroc.im-ldi.com/images/1408) | terrain | 43.9 | 80.5 | 36.1 | 3.1° |
| IM-1 Odysseus, near Malapert A (2024-02-22) | 80.13°S, 1.44°E | [NASA](https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/) | terrain (off the ±200 km map) | 38.0 | 100 | 38.0 | 12.5° |
| Chandrayaan-3 Vikram, Statio Shiv Shakti (2023-08-23) | 69.373°S, 32.319°E | [LPSC 2025 #1951](https://www.hou.usra.edu/meetings/lpsc2025/pdf/1951.pdf) | spherical only (outside LOLA 75°S) | 48.6 | 100 | 48.6 | — |
| Chang'e-6, Apollo basin far side (2024-06-01) | 41.6385°S, 153.9852°W | [NASA](https://www.nasa.gov/centers-and-facilities/goddard/nasas-lro-spots-chinas-change-6-spacecraft-on-lunar-far-side/) + CNSA via The Innovation (2024) | spherical only | 51.4 | 0 | 0 | — |

Values are full-year 2027; the site recomputes them for any range. Our LOLA slope at IM-1 (12.5°) agrees with NASA's reported ~12° local slope; LCROSS (a PSR impact target) correctly gets 0 % Sun. Luna-25 (crashed) and the Artemis III regions (no published coordinates) are not included.

## Regenerating the demo data

```bash
source .venv/bin/activate
pip install -r requirements.txt pillow
# JPL/NAIF kernels in ./data (see below), plus the LOLA DEM:
curl -o data/ldem_75s_240m.img https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img
python scripts/precompute.py --year 2027 --validate   # ~75 s on a laptop
curl -o data/ldsm_75s_240m.img https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldsm_75s_240m.img
python scripts/extras.py                              # slope, PSR distance, Earth-Moon distance
python scripts/refs.py                                # reference landing/impact sites
```

This writes `docs/data/sites.json`, `docs/data/grid.json` and `docs/assets/lola_hillshade.png`. `--validate` checks the vectorized Sun/Earth elevations against `compute.py` (Skyfield topocentric) for the five sites. To preview: `python -m http.server -d docs 8000`.

The Flask app below (`app.py`) is the original dynamic version (spherical horizon only, up to 180 days per request); the published demo does not need it.

## How to run

### On an Ubuntu server

```bash
sudo apt update && sudo apt install -y python3 python3-venv python3-pip git
# clone your copy of this repository, then:
cd polewindow
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py          # binds to 127.0.0.1:5000
```

Place the JPL kernels in `./data/` (or let Skyfield download them there on first run):

- `de421.bsp`
- `moon_080317.tf`
- `pck00008.tpc`
- `moon_pa_de421_1900-2050.bpc`

Large `.bsp` / `.bpc` binaries are gitignored. The first download can take around 15–20 seconds; later runs reuse the local files. A 90-day, five-site hourly compute then takes well under a second once the kernels are loaded.

To print the default January–March 2027 table in the terminal:

```bash
python compute.py
```

### SSH tunnel from another computer

The Flask app listens only on localhost. From your laptop, with VS Code Remote-SSH or a tunnel:

```bash
ssh -L 5000:127.0.0.1:5000 USER@SERVER
```

Then open http://127.0.0.1:5000 in the local browser.

### API

- `GET /` — the comparison page
- `GET /api/sites` — the five cited default sites
- `GET` or `POST /api/compute` — JSON time series and summary statistics

`POST` a JSON body such as:

```json
{
  "site_ids": ["connecting_ridge", "faustini_center"],
  "start": "2027-01-01",
  "end": "2027-03-31",
  "include_series": true,
  "custom": {"lat": -89.0, "lon_e": 0.0, "name": "Custom site"}
}
```

## AI assistance

Space Apps asks teams to disclose AI use. This project used:

- **GitHub Copilot** to help write project code.
- **An AI assistant** to help draft code (including `scripts/precompute.py` and the static page in `docs/`), this README, and the research for data sources.

The scientific method and data choices (Skyfield + DE421 + MOON_ME_DE421, LOLA LDEM_75S_240M, cited site coordinates) were checked by the team: the Horizons cross-check above, the `--validate` comparison, and the DEM orientation check against known features. No NASA logos or marks were generated or modified with AI.

## License

MIT License, Copyright (c) 2026 José Ignacio García Ojeda. See [LICENSE](LICENSE).
