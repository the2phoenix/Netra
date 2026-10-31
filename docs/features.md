# NETRA: Feature Catalogue

Version 1.0 | 2026-10-31 | Skills applied: Feature Forge (spec and acceptance criteria)

Tier: **M** must, **S** should, **X** stretch. Phase numbers match `gsd.md`. Every acceptance criterion is something you can see or measure, so `testing.md` can map one test to each.

---

## 1. Catalogue at a glance

| ID | Feature | Tier | Phase | Data source |
|---|---|---|---|---|
| GL-01 | Globe with NASA GIBS imagery and offline fallback | M | 1 | NASA GIBS, bundled Natural Earth |
| GL-02 | Day/night shading and night-lights layer | S | 4 | NASA GIBS (Black Marble), Cesium lighting |
| SAT-01 | Satellites propagated with SGP4 in a worker | M | 1, 2 | CelesTrak GP |
| SAT-02 | Satellite dossier | M | 2 | CelesTrak GP |
| SAT-03 | Ground track and footprint | S | 5 | computed |
| SAT-04 | Next pass over a city | S | 5 | computed |
| FLT-01 | Live aircraft with dead reckoning | M | 3 | adsb.lol |
| FLT-02 | Aircraft dossier and trail | M | 3 | adsb.lol |
| FLT-03 | Emergency squawk alert | S | 5 | adsb.lol |
| HAZ-01 | Earthquake ripples | M | 4 | USGS |
| HAZ-02 | Fire hotspots | S | 4 | NASA FIRMS (free key) |
| HAZ-03 | News event pings | X | 8 | GDELT |
| HUD-01 | Top bar: clock, counts, feed badges | M | 1, 4 | local |
| HUD-02 | Layer panel | M | 2, 4 | local |
| HUD-03 | Boot sequence | S | 7 | local |
| HUD-04 | Event and alert feed | S | 5 | local |
| SCN-01 | Scan mode | M | 5 | local |
| SCN-02 | Geofence zones and alerts | S | 5 | local |
| GES-01 | Open-palm rotate | M | 6 | MediaPipe |
| GES-02 | Pinch zoom | M | 6 | MediaPipe |
| GES-03 | Fist-hold fly-to | M | 6 | MediaPipe |
| GES-04 | Thumbs-up switches visual mode | S | 6 | MediaPipe |
| GES-05 | Mouse and keyboard parity | M | 1 onward | local |
| VIS-01 | Night-vision and thermal modes | S | 7 | Cesium post-process |
| REP-01 | Timeline replay of the last N minutes | S | 7 | local ring buffer |
| BAK-01 | Caching proxy with stale-while-error | M | 1 onward | FastAPI |
| BAK-02 | Offline fixtures and replay mode | M | 7 | recorded JSON |
| DEM-01 | One-command start | M | 1 | Docker Compose |
| DEM-02 | About and credits panel | M | 7 | local |
| CMD-01 | Command bar | X | 8 | local parser |
| AI-01 | AI situation summary | X | 8 | LLM API (check free tier) |

---

## 2. Feature specifications

### GL-01 Globe with imagery (M, Phase 1)
**What:** CesiumJS globe, true-colour NASA imagery, smooth camera.
**Acceptance**
- Globe renders within 5 s of page load on the demo laptop.
- Imagery comes from NASA GIBS. If it fails, Natural Earth appears and a notice is shown.
- GIBS daily layers use yesterday's UTC date. Today's tiles are often partly empty.
- Mouse parity: drag rotates, wheel zooms, double-click flies to a point.
**Notes:** the default Cesium base layer needs an ion token. Do not rely on it. Use GIBS with the bundled fallback.

### GL-02 Day/night and night lights (S, Phase 4)
**Acceptance:** sun-lit side is visibly brighter. Night-lights layer toggles on the dark side and city lights are visible at orbit altitude.

### SAT-01 Satellites with SGP4 (M, Phases 1 and 2)
**What:** positions computed locally from orbital elements, not fetched per frame.
**Acceptance**
- Phase 1: the ISS appears at the right place and moves along a ground track (compare with a public tracker at the same time, within a few degrees).
- Phase 2: at least 2,000 satellites shown across groups (stations, GPS, weather, a Starlink sample, geostationary).
- Propagation runs in a Web Worker. The main thread never blocks over 8 ms for it.
- Positions refresh 2 times per second or faster.
- The catalog loads once, then refreshes no more often than the upstream allows.
**Notes:** request orbital data as JSON/OMM, not classic TLE text. The TLE format can only hold catalog numbers below 100,000.

### SAT-02 Satellite dossier (M, Phase 2)
**Acceptance:** click a satellite and within 200 ms see name, NORAD ID, altitude, speed, inclination, period and element-set age. A highlight ring follows it. Clear button works.

### SAT-03 Ground track and footprint (S, Phase 5)
**Acceptance:** for the selected satellite show the next 90 minutes of ground track and a footprint circle on the ground. The circle radius comes from altitude with a documented formula.

### SAT-04 Next pass over a city (S, Phase 5)
**Acceptance:** choose a city and see the next time the selected satellite rises above 10 degrees elevation, with maximum elevation and duration.

### FLT-01 Live aircraft (M, Phase 3)
**What:** aircraft as small oriented icons, moving smoothly between polls.
**Acceptance**
- At least 1,500 aircraft shown at once, from sampled hub regions or a global endpoint, whichever Phase 3 confirms.
- Icon rotation matches the heading.
- Between polls aircraft keep moving by dead reckoning. When a new poll arrives, positions blend in over about 500 ms with no visible teleport.
- Top bar shows "AIR n" and the word "sampled" if the data is a sample.
- Stale data (no successful poll for over 60 s) turns the ADSB badge amber.

### FLT-02 Aircraft dossier and trail (M, Phase 3)
**Acceptance:** click an aircraft and see callsign, type, altitude, speed, heading, vertical rate, squawk. A trail of the last 5 minutes is drawn. The dossier does not show registration or owner.

### FLT-03 Emergency squawk alert (S, Phase 5)
**Acceptance:** any aircraft squawking 7500, 7600 or 7700 creates one event in the feed and a pulsing marker. A test fixture with a 7700 aircraft produces exactly one alert, not one per poll.

### HAZ-01 Earthquake ripples (M, Phase 4)
**Acceptance:** quakes from the last 24 hours at magnitude 2.5 or higher appear as ripples scaled by magnitude. Click shows place, magnitude, depth, time. New quakes since page load create a feed event.

### HAZ-02 Fire hotspots (S, Phase 4)
**Acceptance:** with a free FIRMS key set, hotspots from the last 24 hours show as points, capped at 20,000. Without a key the layer toggle is hidden and the boot screen says so.

### HUD-01 Top bar (M, Phases 1 and 4)
**Acceptance:** UTC clock updates every second. Counts reflect what is loaded. Each feed has a badge: LIVE, STALE (with age) or OFF. Cursor latitude and longitude and camera altitude are shown over the globe.

### HUD-02 Layer panel (M, Phases 2 and 4)
**Acceptance:** each layer toggles in under 100 ms of visible effect. State survives a page reload.

### HUD-03 Boot sequence (S, Phase 7)
**Acceptance:** lines reflect real health checks. Total under 4 s. Space skips.

### HUD-04 Event feed (S, Phase 5)
**Acceptance:** newest first, UTC timestamps, max 200 kept. Click an event to fly to it. Events: quake, squawk, geofence entry, feed state change.

### SCN-01 Scan mode (M, Phase 5)
**Acceptance**
- Centre can be the reticle, a named city or a clicked point. Radius 50 to 500 km.
- Sweep animation rotates once per 4 s. Objects get a reticle when the sweep passes.
- Hit list updates every 2 s with counts and nearest object per type.
- Satellite hits mean "above 10 degrees elevation from the centre".
- Distances use great-circle (haversine) distance. A unit test covers a known city pair.

### SCN-02 Geofence zones (S, Phase 5)
**Acceptance:** save a scan circle or draw a polygon as a zone. Entering the zone creates one event per object per entry, not per frame. Maximum 5 zones.

### GES-01 to GES-03 Core gestures (M, Phase 6)
**Acceptance**
- Open palm and move: globe rotates, direction matches hand direction as seen on the mirrored preview.
- Pinch and move up or down: zoom in or out, speed scaled to altitude so it is usable from orbit to street level.
- Fist held 0.8 s while a city or object is highlighted: smooth fly-to over about 2.5 s.
- No false triggers: with the hand resting still, nothing moves. Losing the hand for under 300 ms does not reset state.
- Works at 25 FPS or higher camera processing on the demo laptop.

### GES-04 Thumbs-up cycles visual mode (S, Phase 6)
**Acceptance:** thumbs-up held 0.5 s cycles Normal, Night-vision, Thermal. Debounced by 1 s.

### GES-05 Mouse and keyboard parity (M, from Phase 1)
**Acceptance:** every gesture action has a mouse or key equivalent from `wireframe.md` W4. The app starts and works with no camera. Pressing `M` forces mouse mode.

### VIS-01 Visual modes (S, Phase 7)
**Acceptance:** night-vision (green tint, bloom, grain) and thermal (false-colour ramp) switch with no reload and cost under 5 FPS at target load.

### REP-01 Replay (S, Phase 7)
**Acceptance:** a ring buffer keeps the last 15 minutes of aircraft snapshots. A scrubber replays them. The UI shows "REPLAY" with the time while replaying, and a Go live button.

### BAK-01 Caching proxy (M, from Phase 1)
**Acceptance:** each upstream has a TTL, a minimum interval and a stale-while-error path. Killing the upstream does not crash the backend. `/api/health` shows each feed's state and age. Details: `trd.md` section 5.

### BAK-02 Offline fixtures (M, Phase 7)
**Acceptance:** a script records fixtures from live data. With `OFFLINE_MODE=true` the whole app runs with no internet and shows a REPLAY banner with the recording time. Fixtures never pretend to be live.

### DEM-01 One-command start (M, Phase 1)
**Acceptance:** `docker compose up` brings up the API and web containers. The app opens at `http://localhost:8080`. A `.env.example` documents the optional keys.

### DEM-02 About and credits (M, Phase 7)
**Acceptance:** About panel lists every data source and the NASA GIBS acknowledgment sentence, plus the "demonstration, public data only" statement.

### CMD-01 Command bar (X, Phase 8)
Examples: `track ISS`, `fly delhi`, `scan 200km tokyo`, `layers off fires`. A small parser, no LLM needed.

### AI-01 AI situation summary (X, Phase 8)
One button sends a compact JSON of the current scan results to an LLM and shows a short report. Only if a free option is confirmed. Never block the demo on it.

### HAZ-03 News event pings (X, Phase 8)
GDELT events as small pings with a source link. Low priority. Data quality is noisy.

---

## 3. Cut order (what goes first when time runs short)

1. AI-01, CMD-01, HAZ-03 (stretch, never start before Phase 7 is green)
2. REP-01 replay
3. VIS-01 visual modes
4. HAZ-02 fires
5. SCN-02 geofence zones
6. SAT-03, SAT-04
7. GES-04
8. GL-02
9. Reduce GES to rotate and zoom only (keep GES-05 mouse parity)

**Never cut:** BAK-02 offline fixtures, GES-05, DEM-01, DEM-02, HUD-01 badges. They protect the demo.

## 4. Demo script (about 5 minutes)

| Time | Action | Shows |
|---|---|---|
| 0:00 | Run `docker compose up` (or already running). Boot screen plays. | One-command start, real health checks |
| 0:30 | Open palm: spin Earth. Pinch: zoom to a city. | Gestures |
| 1:15 | Click an aircraft, then the ISS. Read the dossiers. | Live data, SGP4 |
| 2:00 | Layers on: quakes, fires, night lights. | Multi-source pipeline |
| 2:45 | Open scan over Delhi. Read hits. | Geometry, monitoring feel |
| 3:30 | Save the circle as a zone. Wait or trigger an event in the feed. | Alerts |
| 4:00 | Pull the network cable (or toggle offline). Badges go amber, banner appears, app keeps running. | Resilience and honesty |
| 4:30 | Close with the 3 mechanisms: SGP4, caching proxy, gesture state machine. | Depth |

## 5. Definition of done (per feature)
A feature is done when: its acceptance criteria pass, its test from `testing.md` is green, it works in mouse mode, its feed badge behaves, and its three-line explanation exists in `docs/explain/`.