"""Default lunar south-pole sites for PoleWindow.

Coordinates and sources are taken only from the cited publications and
gazetteer entries listed below. Do not invent additional default sites.
Connecting Ridge and Peak Near Shackleton are proposed points inside NASA
Artemis III candidate regions; the three crater coordinates are official
gazetteer crater centers, not official NASA landing-region centroids.
"""

SITES = [
    {
        "id": "connecting_ridge",
        "name": "Connecting Ridge (proposed landing site)",
        "lat": -89.53432,
        "lon_e": 209.94767,
        "source": (
            "Gracy & Lee, 55th LPSC (2024), abstract 1695. "
            "Proposed site inside the NASA Artemis III Connecting Ridge "
            "candidate region. "
            "https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf"
        ),
        "kind": "proposed_site_in_nasa_region",
    },
    {
        "id": "peak_near_shackleton",
        "name": "Peak Near Shackleton (proposed landing site)",
        "lat": -89.01701,
        "lon_e": 126.27302,
        "source": (
            "Gracy & Lee, 55th LPSC (2024), abstract 1695. "
            "Proposed site inside the NASA Artemis III Peak Near Shackleton "
            "candidate region. "
            "https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf"
        ),
        "kind": "proposed_site_in_nasa_region",
    },
    {
        "id": "shackleton_center",
        "name": "Shackleton crater center",
        "lat": -89.67,
        "lon_e": 129.78,
        "source": (
            "USGS / IAU Gazetteer of Planetary Nomenclature, Feature 5450, "
            "default Planetographic +East network. "
            "Center latitude -89.67, center longitude 129.78. "
            "https://planetarynames.wr.usgs.gov/Feature/5450"
        ),
        "kind": "gazetteer_crater_center",
    },
    {
        "id": "haworth_center",
        "name": "Haworth crater center",
        "lat": -86.90,
        "lon_e": -4.00,
        "source": (
            "USGS / IAU Gazetteer of Planetary Nomenclature, Feature 14502, "
            "default Planetographic +East network. "
            "Center latitude -86.90, center longitude -4.00. "
            "https://planetarynames.wr.usgs.gov/Feature/14502"
        ),
        "kind": "gazetteer_crater_center",
    },
    {
        "id": "faustini_center",
        "name": "Faustini crater center",
        "lat": -87.18,
        "lon_e": 84.31,
        "source": (
            "USGS / IAU Gazetteer of Planetary Nomenclature, Feature 1919, "
            "default Planetographic +East network. "
            "Center latitude -87.18, center longitude 84.31. "
            "https://planetarynames.wr.usgs.gov/Feature/1919"
        ),
        "kind": "gazetteer_crater_center",
    },
]

SITES_BY_ID = {site["id"]: site for site in SITES}
