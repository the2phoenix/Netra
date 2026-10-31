"""Offline fixtures loader for NETRA.

Per trd.md section 5.3, BAK-02 and testing.md T-INT-07.
"""

import json
from pathlib import Path
from typing import List, Optional
from app.config import settings
from app.models import AircraftItem, FireItem, QuakeItem, SatelliteItem


# Minimal offline fixture for ISS if no recorded fixture exists
FALLBACK_STATIONS_TLE = """ISS (ZARYA)
1 25544U 98067A   26304.17644455  .00006183  00000+0  11976-3 0  9995
2 25544  51.6332 347.1486 0007016 330.4977  29.5614 15.49124187592838
TIANGONG
1 48274U 21035A   26304.18244792  .00012437  00000+0  14216-3 0  9992
2 48274  41.4728 290.7241 0005721  58.2036 301.9366 15.59765241198547
"""

FALLBACK_GPS_TLE = """NAVSTAR 43 (USA 132)
1 24876U 97035A   26304.15000000 -.00000050  00000+0  00000+0 0  9999
2 24876  55.4200  45.1200 0052000 210.1200 149.8800  2.00565000210005
NAVSTAR 47 (USA 154)
1 26605U 00071A   26304.15000000 -.00000050  00000+0  00000+0 0  9999
2 26605  55.1200 105.4200 0061000 190.4500 169.5500  2.00565000190008
NAVSTAR 53 (USA 166)
1 27663U 03005A   26304.15000000 -.00000050  00000+0  00000+0 0  9999
2 27663  54.9800 165.8200 0048000 230.1500 129.8500  2.00565000185002
"""

FALLBACK_WEATHER_TLE = """NOAA 20 (JPSS-1)
1 43013U 17073A   26304.18000000  .00000075  00000+0  34120-4 0  9993
2 43013  98.7200 310.4500 0001450  75.1200 285.0100 14.19560000450001
GOES 16
1 41866U 16071A   26304.18000000  .00000010  00000+0  00000+0 0  9991
2 41866   0.0500 284.8000 0001200  45.0000 315.0000  1.00270000350004
"""


def generate_synthetic_fixtures(group: str, count: int = 100) -> List[SatelliteItem]:
    """Generate realistic deterministic synthetic satellite elements for offline fallback."""
    from app.upstream.celestrak import parse_tle_text

    lines = []
    base_id = 70000
    if group == "starlink":
        base_id = 71000
        inc = 53.0
        mm = 15.05
    elif group == "geo":
        base_id = 72000
        inc = 0.5
        mm = 1.0027
    elif group == "science":
        base_id = 73000
        inc = 65.0
        mm = 14.5
    elif group == "gps-ops":
        base_id = 74000
        inc = 55.0
        mm = 2.0056
    else:
        base_id = 75000
        inc = 45.0
        mm = 15.0

    for i in range(count):
        norad = base_id + i
        raan = (i * (360.0 / count)) % 360.0
        name = f"{group.upper()}-{i+1:04d}"
        lines.append(name)
        lines.append(f"1 {norad:05d}U 24001A   26304.17000000  .00005000  00000+0  10000-3 0  9991")
        lines.append(f"2 {norad:05d}  {inc:07.4f} {raan:08.4f} 0005000  45.0000 315.0000 {mm:11.8f}10001")

    return parse_tle_text("\n".join(lines), group=group, limit=count)


def load_satellite_fixtures(group: str) -> Optional[List[SatelliteItem]]:
    """Load satellite items from disk fixture or fallback."""
    from app.upstream.celestrak import parse_tle_text

    if group == "all":
        items = []
        for g in ["stations", "gps-ops", "weather", "science", "geo", "starlink"]:
            sub = load_satellite_fixtures(g)
            if sub:
                items.extend(sub)
        return items

    fixture_file = settings.fixtures_dir / f"satellites_{group}.json"
    if fixture_file.exists():
        try:
            with open(fixture_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [SatelliteItem(**item) for item in data.get("items", [])]
        except Exception:
            pass

    # Built-in fallbacks
    if group == "stations":
        return parse_tle_text(FALLBACK_STATIONS_TLE, group="stations")
    elif group == "gps-ops":
        return parse_tle_text(FALLBACK_GPS_TLE, group="gps-ops") + generate_synthetic_fixtures("gps-ops", 28)
    elif group == "weather":
        return parse_tle_text(FALLBACK_WEATHER_TLE, group="weather") + generate_synthetic_fixtures("weather", 30)
    elif group == "geo":
        return generate_synthetic_fixtures("geo", 50)
    elif group == "science":
        return generate_synthetic_fixtures("science", 50)
    elif group == "starlink":
        return generate_synthetic_fixtures("starlink", 200)

    return []


def load_aircraft_fixtures() -> List[AircraftItem]:
    """Load aircraft items from disk fixture or generate realistic deterministic multi-hub dataset."""
    from app.upstream.adsb import HUBS

    fixture_file = settings.fixtures_dir / "flights.json"
    if fixture_file.exists():
        try:
            with open(fixture_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [AircraftItem(**item) for item in data.get("items", [])]
        except Exception:
            pass

    # Deterministic generation across 12 hubs: ~125 aircraft per hub = 1,500 total
    items: List[AircraftItem] = []

    # Include special emergency aircraft from wireframe and test spec (T-INT-07)
    items.append(
        AircraftItem(
            hex="800a1f",
            callsign="VT-ANB",
            type="B788",
            lat=28.55,
            lon=77.10,
            alt_ft=37000,
            gs_kt=486.0,
            track_deg=312.4,
            vs_fpm=0,
            squawk="7700",
            seen_s=1.2,
            on_ground=False,
        )
    )

    callsign_prefixes = {
        "LHR": ["BAW", "VIR", "EZY"],
        "FRA": ["DLH", "CFG", "EWG"],
        "JFK": ["AAL", "DAL", "JBU"],
        "ORD": ["UAL", "AAL", "ENY"],
        "LAX": ["SWA", "DAL", "ASA"],
        "DXB": ["UAE", "FDB", "ETD"],
        "DEL": ["AIC", "IGO", "SEJ"],
        "SIN": ["SIA", "SCO", "JSA"],
        "HND": ["ANA", "JAL", "SFJ"],
        "SYD": ["QFA", "VOZ", "JST"],
        "GRU": ["TAM", "GLO", "AZU"],
        "JNB": ["SAA", "CAW", "LNK"],
    }
    types = ["A320", "B738", "A359", "B77W", "B789", "A321", "E190", "A333"]

    count_per_hub = 125
    hex_counter = 0x400000

    for hub in HUBS:
        prefixes = callsign_prefixes.get(hub.code, ["NET"])
        for j in range(count_per_hub):
            hex_counter += 1
            h = f"{hex_counter:06x}"
            prefix = prefixes[j % len(prefixes)]
            callsign = f"{prefix}{100 + (j * 7) % 899}"
            ac_type = types[j % len(types)]

            # Radial distribution around hub (within ~220 nm)
            angle_rad = (j * 2.39996) % 6.28318  # Golden ratio spiral
            dist_deg = ((j + 1) / count_per_hub) * 2.8  # Up to ~2.8 degrees (~170 nm)

            ac_lat = round(hub.lat + dist_deg * 0.7 * (1.0 if j % 2 == 0 else -1.0), 4)
            ac_lon = round(hub.lon + dist_deg * 0.9 * (1.0 if j % 3 == 0 else -1.0), 4)
            track = round((angle_rad * 180.0 / 3.14159) % 360.0, 1)

            alt = 3000 + (j * 300) % 38000
            gs = 180.0 + (j * 3.5) % 320.0
            vs = -500 if j % 4 == 0 else (500 if j % 4 == 1 else 0)
            squawk = f"{(1000 + (j * 17) % 6000):04d}"

            items.append(
                AircraftItem(
                    hex=h,
                    callsign=callsign,
                    type=ac_type,
                    lat=ac_lat,
                    lon=ac_lon,
                    alt_ft=alt,
                    gs_kt=round(gs, 1),
                    track_deg=track,
                    vs_fpm=vs,
                    squawk=squawk,
                    seen_s=round((j * 0.3) % 15.0, 1),
                    on_ground=False,
                )
            )

    return items


def load_quake_fixtures() -> List[QuakeItem]:
    """Load earthquake items from disk fixture or return 14 realistic global events."""
    fixture_file = settings.fixtures_dir / "quakes.json"
    if fixture_file.exists():
        try:
            with open(fixture_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [QuakeItem(**item) for item in data.get("items", [])]
        except Exception:
            pass

    # Deterministic 14 quakes matching wireframe W1 / W2 and testing.md
    raw_quakes = [
        {"id": "us7000m46a", "mag": 4.6, "place": "Hindu Kush region, Afghanistan", "time": 1730452421000, "lat": 36.52, "lon": 70.83, "depth_km": 212.0},
        {"id": "nc75102941", "mag": 5.8, "place": "74 km W of Petrolia, California", "time": 1730449123000, "lat": 40.32, "lon": -125.12, "depth_km": 10.0},
        {"id": "us7000m62b", "mag": 6.2, "place": "Northern Sumatra, Indonesia", "time": 1730441234000, "lat": 1.84, "lon": 98.91, "depth_km": 25.0},
        {"id": "ak024d271f", "mag": 3.8, "place": "42 km S of Cantwell, Alaska", "time": 1730438901000, "lat": 64.21, "lon": -148.24, "depth_km": 8.5},
        {"id": "us7000m42c", "mag": 4.2, "place": "Antofagasta, Chile", "time": 1730435678000, "lat": -21.43, "lon": -68.32, "depth_km": 110.0},
        {"id": "us7000m51d", "mag": 5.1, "place": "Near the east coast of Honshu, Japan", "time": 1730431200000, "lat": 37.82, "lon": 141.61, "depth_km": 42.0},
        {"id": "pr71420101", "mag": 3.1, "place": "12 km SSE of Guánica, Puerto Rico", "time": 1730428900000, "lat": 17.97, "lon": -66.88, "depth_km": 12.0},
        {"id": "us7000m49e", "mag": 4.9, "place": "Cook Strait, New Zealand", "time": 1730425400000, "lat": -41.22, "lon": 174.91, "depth_km": 35.0},
        {"id": "us7000m53f", "mag": 5.3, "place": "Gulf of Corinth, Greece", "time": 1730421000000, "lat": 38.25, "lon": 22.42, "depth_km": 14.0},
        {"id": "us7000m41g", "mag": 4.1, "place": "Central Turkey", "time": 1730418900000, "lat": 37.91, "lon": 36.24, "depth_km": 10.0},
        {"id": "us7000m60h", "mag": 6.0, "place": "Port-Vila, Vanuatu", "time": 1730415600000, "lat": -17.52, "lon": 168.14, "depth_km": 45.0},
        {"id": "hv73120902", "mag": 3.5, "place": "14 km S of Volcano, Hawaii", "time": 1730412300000, "lat": 19.38, "lon": -155.26, "depth_km": 5.2},
        {"id": "us7000m44i", "mag": 4.4, "place": "Samar, Philippines", "time": 1730409800000, "lat": 12.12, "lon": 124.51, "depth_km": 30.0},
        {"id": "us7000m50j", "mag": 5.0, "place": "Reykjanes Ridge, Iceland", "time": 1730405400000, "lat": 64.02, "lon": -20.51, "depth_km": 6.0},
    ]

    return [QuakeItem(**q) for q in raw_quakes]


def load_fire_fixtures() -> List[FireItem]:
    """Load fire hotspots from disk fixture or return representative sample."""
    fixture_file = settings.fixtures_dir / "fires.json"
    if fixture_file.exists():
        try:
            with open(fixture_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [FireItem(**item) for item in data.get("items", [])]
        except Exception:
            pass

    # Representative hotspots across wildfire corridors
    regions = [
        {"lat": -3.46, "lon": -62.21, "count": 60},  # Amazon basin
        {"lat": -0.78, "lon": 23.55, "count": 80},   # Congo basin
        {"lat": -18.28, "lon": 133.51, "count": 50}, # Northern Australia
        {"lat": 38.50, "lon": -120.20, "count": 30}, # California Sierra
        {"lat": -2.50, "lon": 113.20, "count": 40},  # Borneo / Indonesia
    ]

    items: List[FireItem] = []
    idx = 0
    for reg in regions:
        for k in range(reg["count"]):
            idx += 1
            lat = round(reg["lat"] + (k * 0.17) % 3.0 - 1.5, 4)
            lon = round(reg["lon"] + (k * 0.23) % 3.0 - 1.5, 4)
            frp = round(15.0 + (k * 7.3) % 280.0, 1)
            items.append(
                FireItem(
                    lat=lat,
                    lon=lon,
                    frp=frp,
                    confidence="high" if frp > 80 else "nominal",
                    acq_time="2026-11-02 08:30",
                    satellite="VIIRS_SNPP",
                )
            )

    items.sort(key=lambda x: x.frp, reverse=True)
    return items
