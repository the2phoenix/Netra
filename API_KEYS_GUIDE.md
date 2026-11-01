# 🔑 NETRA Tactical Intelligence API Setup Guide

This guide details how to obtain and configure API keys for every intelligence and geospatial service supported by NETRA. All recommended services offer **generous monthly free credits or completely keyless open access** ($0 out-of-pocket cost).

---

## 1. Google Maps Photorealistic 3D Tiles API

- **Benefit:** Streams photorealistic 3D buildings, bridges, and city geometry worldwide directly into Cesium.
- **Free Tier:** **$200/month recurring Google Cloud credit** (~28,500 root tile sessions/mo, reset every 30 days).
- **How to get your API key:**
  1. Go to [Google Cloud Console](https://console.cloud.google.com/).
  2. Create a new project (e.g. `NETRA-3D-Earth`).
  3. Navigate to **APIs & Services** ➔ **Library**.
  4. Search for **"Map Tiles API"** and click **Enable**.
  5. Go to **APIs & Services** ➔ **Credentials** ➔ Click **Create Credentials** ➔ **API Key**.
  6. Copy your API Key (e.g., `AIzaSy...`).
  7. *(Optional)* Click "Edit API Key" and restrict the key to **"Map Tiles API"** for security.
- **Configuration:** Set in `web/.env`:
  ```bash
  VITE_GOOGLE_MAPS_KEY=AIzaSyAZu8mjUqiOqEaeNWVILfp2Tyd1vLkcexQ
  ```
  Or set in browser console: `localStorage.setItem('NETRA_GOOGLE_MAPS_KEY', 'your_key')`.

---

## 2. Mapbox Vector & Satellite API

- **Benefit:** High-contrast tactical vector roads, building footprints, and dark navigation basemaps.
- **Free Tier:** **50,000 free map loads every month** ($0).
- **How to get your API Token:**
  1. Go to [Mapbox Signup](https://account.mapbox.com/auth/signup/).
  2. Create a free account (no credit card required for free tier).
  3. Under your **Dashboard**, find your **Default Public Token** (starts with `pk.eyJ...`).
- **Configuration:** Set in `web/.env`:
  ```bash
  VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSI...
  ```

---

## 3. Windy Webcams / OpenWebcams API

- **Benefit:** Real-time live images from over 50,000 public highway, border, landmark, and city webcams globally.
- **Free Tier:** **1,000 free requests per day** ($0).
- **How to get your API key:**
  1. Go to [Windy Webcams API](https://api.windy.com/webcams).
  2. Click **Get API Key** and sign up for a free developer account.
  3. Create an application and copy your API Key.
- **Configuration:** Set in `web/.env`:
  ```bash
  VITE_WINDY_KEY=your_windy_key_here
  ```

---

## 4. OpenSky Network Live ADS-B API

- **Benefit:** Live commercial, cargo, and military transponder telemetry worldwide.
- **Free Tier:** **100% Free Open API** (Anonymous: 400 requests/day; Free Registered Account: 4,000 requests/day).
- **How to register:**
  1. Visit [OpenSky Network Registration](https://opensky-network.org/index.php?option=com_users&view=registration).
  2. Enter a username and email.
- **Configuration:** Set in `web/.env` or `api/.env`:
  ```bash
  VITE_OPENSKY_USER=your_username
  VITE_OPENSKY_PASS=your_password
  ```

---

## 5. 100% Keyless Services (Zero Configuration Needed)

The following intelligence feeds are **already fully integrated and operational** with NO API keys or credentials needed:

1. **NYC DOT & Caltrans Open Traffic Cameras:**
   - Over 1,500 live public traffic camera image endpoints in New York City and California updating every 2–5 seconds.
2. **OpenStreetMap Nominatim Geocoding:**
   - Free worldwide search for any monument, landmark, city, or address (Statue of Liberty, Tokyo Tower, India Gate, etc.).
3. **OpenStreetMap Overpass API:**
   - Public database queries for defense installations, runways, radar domes, and nuclear/power plants.
4. **USGS Earthquake Hazards Feed:**
   - Real-time global seismic fault line and magnitude sensor data updated every 60 seconds.
5. **NASA FIRMS Thermal Anomalies:**
   - Real-time MODIS / VIIRS satellite active fire hotspot detection.
6. **NASA GIBS Earth Imagery:**
   - Blue Marble, Black Marble (Earth at night city lights), NOAA-20 daily weather clouds, and geopolitical boundaries.
