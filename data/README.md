# JPL kernels

PoleWindow expects these files in this directory:

- `de421.bsp` — JPL DE421 planetary ephemeris
- `moon_080317.tf` — lunar frame specifications
- `pck00008.tpc` — planetary constants
- `moon_pa_de421_1900-2050.bpc` — lunar principal-axis orientation, DE421

The `.bsp` and `.bpc` binaries are not committed (see `.gitignore`). Skyfield’s `Loader` will download missing files into this folder on first run. The two text kernels (`.tf`, `.tpc`) are included in the repository.
