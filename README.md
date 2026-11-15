# PoleWindow

PoleWindow is a simple web tool that lets mission planners, educators, and the public compare lunar south-pole landing sites and date ranges in minutes. For each site it shows when the Sun is above the horizon (solar-power window) and when Earth is above the horizon (direct-to-Earth communications window), using JPL DE421 ephemerides — the same family of geometry provided by NASA’s Horizons System — in an interactive chart and a ranking table.

This project was built for the [NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) challenge **Lunar Landing Site Navigator**.

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

## Limitation: spherical horizon, no LOLA terrain

Elevations are computed over a **smooth spherical lunar horizon**. Local LOLA topography (crater walls, massifs, and ridgelines) is **not** applied. A Sun or Earth that is only a degree or two above this ideal horizon may be hidden by real terrain. Crater-floor centers (Shackleton, Haworth, Faustini) will therefore look more sunlit and more Earth-visible than they are in reality. This limitation is also shown in the app.

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

GitHub Copilot was used as AI assistance to help write project code. The scientific method (Skyfield + DE421 + MOON_ME_DE421, spherical horizon, cited coordinates) was specified and verified independently, including the Horizons cross-check above. No NASA logos or marks were generated or modified with AI.

## License

MIT License, Copyright (c) 2026 José Ignacio García Ojeda. See [LICENSE](LICENSE).
