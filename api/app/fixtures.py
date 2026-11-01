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
    cfg = {
        "starlink": (71000, 53.0, 15.05), "geo": (72000, 0.5, 1.0027),
        "science": (73000, 65.0, 14.5), "gps-ops": (74000, 55.0, 2.0056),
    }
    base_id, inc, mm = cfg.get(group, (75000, 45.0, 15.0))
    lines = []

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

    # Deterministic generation across major international airway corridors
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

    import math
    import time

    now_epoch = time.time()

    # Broad realistic airway network spanning India domestic, Gulf, Europe, Transatlantic, Transpacific, Asia, Americas
    routes = [
        # India Domestic Trunk Corridors
        (28.56, 77.10, 19.09, 72.87, ["AIC", "IGO", "VTI"], 30),   # DEL - BOM
        (28.56, 77.10, 13.20, 77.71, ["IGO", "AIC", "AKJ"], 28),   # DEL - BLR
        (19.09, 72.87, 13.20, 77.71, ["SEJ", "IGO", "AIC"], 24),   # BOM - BLR
        (28.56, 77.10, 22.65, 88.45, ["IGO", "AIC"], 22),          # DEL - CCU
        (13.08, 80.27, 28.56, 77.10, ["AIC", "IGO"], 22),          # MAA - DEL
        (19.09, 72.87, 15.38, 73.83, ["IGO", "AKJ"], 18),          # BOM - GOI
        # India - Gulf & Middle East
        (19.09, 72.87, 25.25, 55.36, ["UAE", "AIC", "FDB"], 32),   # BOM - DXB
        (28.56, 77.10, 25.25, 55.36, ["UAE", "AIC", "ETD"], 32),   # DEL - DXB
        (25.25, 55.36, 51.47, -0.45, ["UAE", "BAW", "ETD"], 28),   # DXB - LHR
        # Europe & Transatlantic NAT Tracks
        (51.47, -0.45, 49.01, 2.55, ["BAW", "AFR", "EZY"], 24),    # LHR - CDG
        (50.03, 8.57, 41.80, 12.24, ["DLH", "AZA", "EWG"], 24),    # FRA - FCO
        (40.64, -73.78, 51.47, -0.45, ["BAW", "VIR", "AAL"], 38),  # JFK - LHR
        (42.36, -71.01, 49.01, 2.55, ["AFR", "DAL", "UAL"], 30),  # BOS - CDG
        (41.97, -87.90, 50.03, 8.57, ["DLH", "UAL", "AAL"], 30),  # ORD - FRA
        # North America Domestic
        (40.64, -73.78, 33.94, -118.41, ["AAL", "DAL", "JBU"], 35), # JFK - LAX
        (41.97, -87.90, 25.79, -80.29, ["AAL", "UAL", "SWA"], 26),  # ORD - MIA
        (47.45, -122.31, 37.62, -122.37, ["ASA", "DAL"], 24),       # SEA - SFO
        # Asia & Pacific
        (28.56, 77.10, 1.36, 103.99, ["SIA", "AIC", "SCO"], 26),   # DEL - SIN
        (35.55, 139.78, 33.94, -118.41, ["ANA", "JAL", "UAL"], 28), # HND - LAX
        (35.55, 139.78, 42.78, 141.69, ["ANA", "JAL"], 22),        # HND - CTS
        (22.31, 113.91, 25.08, 121.23, ["CPA", "CAL"], 24),        # HKG - TPE
        (1.36, 103.99, -33.95, 151.18, ["SIA", "QFA"], 26),        # SIN - SYD
        (-33.95, 151.18, -37.67, 144.84, ["QFA", "VOZ"], 24),      # SYD - MEL
        # Latin America & Africa
        (-23.43, -46.47, -22.81, -43.25, ["TAM", "GLO"], 22),      # GRU - GIG
        (-26.13, 28.24, -33.97, 18.60, ["SAA", "CAW"], 22),        # JNB - CPT
    ]
    types = ["A320", "B738", "A359", "B77W", "B789", "A321", "E190", "A333"]
    hex_counter = 0x400000

    # R = 6371000m
    R_EARTH = 6371000.0

    for lat1, lon1, lat2, lon2, prefixes, count in routes:
        # Calculate great-circle forward bearing and angular distance
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = phi2 - phi1
        dlambda = math.radians(lon2 - lon1)

        # Haversine angular distance
        a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2.0) ** 2)
        angular_dist = 2.0 * math.atan2(math.sqrt(max(0.0, a)), math.sqrt(max(0.0, 1.0 - a)))
        dist_m = max(angular_dist * R_EARTH, 10000.0)

        # Forward bearing
        y = math.sin(dlambda) * math.cos(phi2)
        x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
        forward_deg = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0

        for j in range(count):
            hex_counter += 1
            h = f"{hex_counter:06x}"
            prefix = prefixes[j % len(prefixes)]
            callsign = f"{prefix}{100 + (j * 7) % 899}"
            ac_type = types[j % len(types)]

            is_return = (j % 2 == 1)
            # Cruise speed ~450 kt = 231 m/s. 
            # Apply subtle varied speeds per flight
            speed_mps = 220.0 + (j * 3.5) % 35.0
            gs_kt = speed_mps * 1.94384

            # Dynamic time-progressed position along corridor
            # Period (seconds) = dist_m / speed_mps
            period_s = max(dist_m / speed_mps, 300.0)
            initial_phase = j / float(count)
            # Time progression cycles continuously over the airway
            cycle_t = (initial_phase + (now_epoch / period_s)) % 1.0

            t = (1.0 - cycle_t) if is_return else cycle_t

            # Great-circle intermediate point via slerp
            sin_d = math.sin(angular_dist)
            if sin_d > 1e-6:
                a_weight = math.sin((1.0 - t) * angular_dist) / sin_d
                b_weight = math.sin(t * angular_dist) / sin_d
                x_coord = a_weight * math.cos(phi1) * math.cos(math.radians(lon1)) + b_weight * math.cos(phi2) * math.cos(math.radians(lon2))
                y_coord = a_weight * math.cos(phi1) * math.sin(math.radians(lon1)) + b_weight * math.cos(phi2) * math.sin(math.radians(lon2))
                z_coord = a_weight * math.sin(phi1) + b_weight * math.sin(phi2)
                ac_lat = math.degrees(math.atan2(z_coord, math.sqrt(x_coord * x_coord + y_coord * y_coord)))
                ac_lon = math.degrees(math.atan2(y_coord, x_coord))
            else:
                ac_lat = lat1 + (lat2 - lat1) * t
                ac_lon = lon1 + (lon2 - lon1) * t

            # Subtle lateral airway deviation (+/- 0.08 deg)
            lat_wobble = math.sin(j * 1.7 + now_epoch * 0.001) * 0.08
            lon_wobble = math.cos(j * 1.3 + now_epoch * 0.001) * 0.08

            ac_lat = round(ac_lat + lat_wobble, 4)
            ac_lon = round(ac_lon + lon_wobble, 4)
            track = round((forward_deg + (180.0 if is_return else 0.0)) % 360.0, 1)

            # High altitude jet cruise levels (FL300 - FL410)
            alt = 31000 + (j * 1000) % 10000
            squawk = f"{(1000 + (j * 19) % 6000):04d}"

            items.append(
                AircraftItem(
                    hex=h,
                    callsign=callsign,
                    type=ac_type,
                    lat=ac_lat,
                    lon=ac_lon,
                    alt_ft=alt,
                    gs_kt=round(gs_kt, 1),
                    track_deg=track,
                    vs_fpm=0,
                    squawk=squawk,
                    seen_s=round((j * 0.3) % 15.0, 1),
                    on_ground=False,
                    is_military=False,
                )
            )

    # Add realistic tactical military patrols (God's Eye View inspiration)
    mil_patrols = [
        ("FORTE11", "RQ4", 34.80, 32.50, 52000, 340.0, 95.0, "0321"),   # Eastern Med RQ-4 Global Hawk
        ("JAKE21", "RC135", 55.40, 20.80, 36000, 420.0, 260.0, "1452"),  # Baltic Sea RC-135 Rivet Joint
        ("REACH814", "C17", 36.15, 54.20, 32000, 450.0, 125.0, "4421"), # Persian Gulf C-17 Globemaster
        ("ASCOT221", "A400", 50.12, 1.45, 28000, 380.0, 310.0, "2201"),  # English Channel A400M
        ("TOPCAT41", "KC135", 38.25, 128.40, 29000, 410.0, 180.0, "5234"),# Sea of Japan KC-135
        ("TIGER01", "EUFI", 24.15, 70.20, 26000, 520.0, 45.0, "7011"),   # Arabian Sea Patrol
    ]
    for m_call, m_type, m_lat, m_lon, m_alt, m_gs, m_track, m_squawk in mil_patrols:
        hex_counter += 1
        items.append(
            AircraftItem(
                hex=f"{hex_counter:06x}",
                callsign=m_call,
                type=m_type,
                lat=m_lat,
                lon=m_lon,
                alt_ft=m_alt,
                gs_kt=m_gs,
                track_deg=m_track,
                vs_fpm=0,
                squawk=m_squawk,
                seen_s=0.5,
                on_ground=False,
                is_military=True,
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
