# NETRA: Technical Requirements Document

Version 1.0 | 2026-10-31 | Skills applied: Architecture Designer, API Designer, FastAPI Expert, Python Pro, JavaScript Pro, WebSocket Engineer (consulted, then rejected, see ADR-005), Security Reviewer
Companion docs: `architecture.md` (why), `features.md` (what), this file (how).

Items marked **VERIFY** are facts I could not confirm from documentation in this session. Confirm each in the first hour of the phase that needs it. They are collected in section 13.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Globe | CesiumJS, built with Vite and `vite-plugin-cesium` | Copies Cesium static assets. Bundled Natural Earth II imagery works offline. |
| Language (frontend) | JavaScript ES modules with JSDoc types and `// @ts-check` | No TypeScript build step. Editor still catches type errors. |
| Satellite maths | `satellite.js` | SGP4 propagation and look angles. **VERIFY** OMM/JSON support (`json2satrec`). |
| Hand tracking | `@mediapipe/tasks-vision` HandLandmarker | Wasm and model file must be served locally (section 10.6). |
| Styling | Plain CSS with custom properties (tokens from `ui-ux.md`) | Tailwind is optional. Tokens matter more than utility classes here. |
| Fonts | `@fontsource/*` packages | Bundled so the demo works offline. |
| Backend | Python 3.12, FastAPI, Uvicorn, httpx, Pydantic v2 | Async fetch, typed models. |
| Tests | pytest, pytest-asyncio, respx (backend); Vitest, Playwright (frontend) | See `testing.md`. |
| Lint and format | ruff (Python); ESLint and Prettier (JS) | |
| Packaging | Docker Compose: `web` (Nginx) and `api` | |

Pin exact versions in lockfiles at install time (`package-lock.json`, `requirements.lock`). Do not guess version numbers in docs.

## 2. Repository layout

```
netra/
├── docker-compose.yml
├── .env.example
├── README.md
├── docs/                      # these nine files + explain/
│   └── explain/               # 3-line "how it works" per module (viva prep)
├── api/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py            # FastAPI app, routes, lifespan
│   │   ├── config.py          # env parsing
│   │   ├── cache.py           # TTL cache with stale-while-error
│   │   ├── upstream/          # adsb.py, celestrak.py, usgs.py, firms.py (one client each)
│   │   ├── hubs.py            # hub list and round-robin poller
│   │   ├── models.py          # Pydantic response models
│   │   ├── fixtures.py        # offline mode loader
│   │   └── security.py        # validation, rate limiting
│   ├── scripts/record_fixtures.py
│   ├── fixtures/              # recorded JSON (committed)
│   └── tests/
├── web/
│   ├── Dockerfile             # multi-stage: build with Node, serve with Nginx
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── public/models/hand_landmarker.task   # downloaded once, committed or fetched at build
│   ├── src/
│   │   ├── main.js
│   │   ├── core/              # state, events, config, clock
│   │   ├── globe/             # viewer.js, imagery.js, camera.js
│   │   ├── layers/            # satellites.js, aircraft.js, quakes.js, fires.js, scan.js, zones.js
│   │   ├── workers/           # sgp4.worker.js
│   │   ├── data/              # api.js, scheduler.js, replay.js
│   │   ├── input/
│   │   │   ├── intents.js     # ROTATE, ZOOM, FLY_TO, NEXT_MODE
│   │   │   ├── mouse.js
│   │   │   └── gestures/      # tracker.js, features.js, classifier.js, machine.js
│   │   ├── ui/                # hud.js, dossier.js, feed.js, layers-panel.js, boot.js, about.js
│   │   ├── geo/               # haversine.js, polygon.js, deadreckon.js, footprint.js
│   │   └── styles/            # tokens.css, base.css, components.css
│   └── tests/                 # vitest unit tests, playwright e2e
└── scripts/                   # dev helpers
```

## 3. Configuration

`.env.example`
```
# Optional. Free key from NASA FIRMS (email only). Without it the fire layer is hidden.
FIRMS_MAP_KEY=

# Serve recorded data and show the REPLAY banner. true | false
OFFLINE_MODE=false

# Aircraft owner and registration are dropped unless this is true.
INCLUDE_REGISTRATION=false

# Backend tuning (defaults shown)
FLIGHT_HUB_INTERVAL_S=3
FLIGHT_CACHE_TTL_S=5
QUAKE_CACHE_TTL_S=60
FIRE_CACHE_TTL_S=600
SAT_MIN_REFRESH_S=7500      # a bit over 2 hours, see section 5.4
LOG_LEVEL=info
```
No secrets are baked into images. `.env` is git-ignored.

## 4. Backend API

Base path `/api`. All responses JSON. All timestamps ISO 8601 UTC. Every data response has `fetched_at`, `source`, `stale` (bool) and `age_s`.

### 4.1 `GET /api/health`
```json
{
  "status": "ok",
  "offline": false,
  "uptime_s": 1234,
  "feeds": {
    "adsb":      {"state": "live",  "last_ok": "2026-11-02T09:14:05Z", "age_s": 2},
    "celestrak": {"state": "stale", "last_ok": "2026-11-02T07:01:00Z", "age_s": 8000},
    "usgs":      {"state": "live",  "last_ok": "2026-11-02T09:13:41Z", "age_s": 26},
    "firms":     {"state": "off",   "reason": "no_key"}
  }
}
```
States: `live`, `stale`, `off`. The UI badges map directly to these.

### 4.2 `GET /api/satellites?group=<name>`
- `group` must be one of an allowlist: `stations`, `gps-ops`, `weather`, `noaa`, `science`, `geo`, `starlink` (plus others added deliberately).
- Response: `{ group, count, items: [Element] }`.
- `Element` carries the OMM fields satellite.js needs: `OBJECT_NAME`, `NORAD_CAT_ID`, `EPOCH`, `MEAN_MOTION`, `ECCENTRICITY`, `INCLINATION`, `RA_OF_ASC_NODE`, `ARG_OF_PERICENTER`, `MEAN_ANOMALY`, `BSTAR`, `MEAN_MOTION_DOT`, `MEAN_MOTION_DDOT`, `EPHEMERIS_TYPE`, `CLASSIFICATION_TYPE`, `ELEMENT_SET_NO`, `REV_AT_EPOCH`.
- Starlink is large. The backend returns at most `limit` objects (default 1500) chosen by stride sampling so the sample covers all shells.
- Errors: `400 invalid_group`, `502 upstream_unavailable` (only if no cache exists at all).

### 4.3 `GET /api/flights`
Query: `mode=hubs` (default) or `mode=around&lat=..&lon=..&dist_nm=..`
- `lat` in [-90, 90], `lon` in [-180, 180], `dist_nm` in [1, 250] (**VERIFY** the upstream maximum).
- `hubs`: the backend merges the cached results of all hubs. `around`: the backend queries (and caches) that centre.
```json
{
  "fetched_at": "2026-11-02T09:14:05Z", "source": "adsb.lol", "stale": false, "age_s": 2,
  "sampled": true, "hubs": 12, "count": 1812,
  "items": [
    {"hex": "800a1f", "callsign": "AIC101", "type": "B788",
     "lat": 28.55, "lon": 77.10, "alt_ft": 37000, "gs_kt": 486,
     "track_deg": 312.4, "vs_fpm": 0, "squawk": "1457", "seen_s": 1.2}
  ]
}
```
- Mapping from the upstream readsb fields: `hex`, `flight`, `t`, `lat`, `lon`, `alt_baro`, `gs`, `track`, `baro_rate`, `squawk`, `seen`. `alt_baro` can be the string `"ground"`: convert to `alt_ft: 0` and `on_ground: true`.
- Items without `lat` and `lon` are dropped. Duplicate `hex` values from overlapping hubs keep the one with the smallest `seen_s`.
- The registration field `r` and any owner data are dropped unless `INCLUDE_REGISTRATION=true`.

### 4.4 `GET /api/quakes?min_mag=2.5&window=day`
- `window`: `hour`, `day`, `week`. Backend maps to the USGS summary feed.
- Items: `{id, mag, place, time, lat, lon, depth_km}`.

### 4.5 `GET /api/fires?day_range=1`
- Requires `FIRMS_MAP_KEY`. Without it: `503` with `{"error": "fires_disabled", "reason": "no_key"}`.
- Items: `{lat, lon, frp, confidence, acq_time, satellite}`. Capped at 20,000, highest `frp` first.

### 4.6 `GET /api/meta/hubs`
List of hub names and centres, for the UI to show what "sampled" means.

### 4.7 Error format
```json
{"error": "invalid_group", "message": "group must be one of: stations, gps-ops, ..."}
```
No stack traces in responses. Log them server-side.

## 5. Backend internals

### 5.1 TTL cache with stale-while-error
```python
class Cached:
    value, fetched_at, ttl_s, last_error
async def get(key, ttl_s, fetch):
    entry = cache.get(key)
    if entry and age(entry) < ttl_s:
        return entry, stale=False
    try:
        value = await fetch()            # httpx, timeout 8 s
        cache.set(key, value); return fresh
    except Exception as e:
        if entry: mark stale; return entry, stale=True   # never crash
        raise UpstreamUnavailable
```
Use a per-key `asyncio.Lock` so ten browser requests cause one upstream request.

### 5.2 Hub poller (aircraft)
A background task (started in the FastAPI lifespan) walks a list of 12 hubs and fetches one hub every `FLIGHT_HUB_INTERVAL_S` seconds. Each hub result is cached with a timestamp. `mode=hubs` merges all hub caches. A full cycle takes about 36 s, and dead reckoning in the browser hides the age. Suggested hubs (centre, radius 250 nm): London, Frankfurt, New York, Chicago, Los Angeles, Dubai, Delhi, Singapore, Tokyo, Sydney, Sao Paulo, Johannesburg. The UI labels the data "sampled".

If **VERIFY Q1** finds a global or bulk endpoint, replace hubs with it and keep the same response shape.

### 5.3 Fixtures
`scripts/record_fixtures.py` calls the real endpoints and writes `fixtures/*.json`. For aircraft it records one snapshot every 5 s for 15 minutes (this also feeds REP-01). With `OFFLINE_MODE=true`, upstream clients are replaced by a fixture reader that replays snapshots in a loop. Every response carries `"replay": true` and `"recorded_at"`. The UI turns that into the REPLAY banner.

### 5.4 Upstream politeness
- CelesTrak: a group refreshes about every 2 hours, and repeat requests inside that window get 403. Set `SAT_MIN_REFRESH_S` above 2 hours, persist the last response to disk, and on 403 serve the disk copy.
- adsb.lol: community service. Keep to one request per few seconds overall. Send a descriptive `User-Agent` (`netra-demo/0.1 (student project)`).
- FIRMS: free key limit documented as 5,000 transactions per 10 minutes. Our usage is a few per hour.
- All upstream hosts are hard-coded constants. No client-controlled URLs.

### 5.5 Validation and limits
Pydantic validators on every query parameter. A simple in-memory token bucket per client IP (for example 30 requests per second burst, 10 sustained) protects the proxy. It is a demo, not a production edge, but it shows the idea.

## 6. Frontend state and data model

```js
/** @typedef {{hex:string, callsign:string, type:string, lat:number, lon:number,
 *  altM:number, gsMps:number, trackDeg:number, vsMps:number, squawk:string,
 *  t0:number}} Aircraft */   // t0 = ms epoch of the last real fix
/** @typedef {{id:number, name:string, group:string}} SatMeta */
/** @typedef {{id:string, mag:number, place:string, lat:number, lon:number,
 *  depthKm:number, time:number}} Quake */
/** @typedef {{ts:number, level:'info'|'warn'|'alert', kind:string,
 *  text:string, target?:{lat:number, lon:number, id?:string}}} FeedEvent */
```
App state is a small store with `subscribe(topic, fn)`. Topics: `feeds`, `selection`, `layers`, `mode`, `scan`, `zones`, `events`, `perf`. No framework. Aircraft and satellite arrays live in typed arrays outside the store (the store only holds counts and the selected id) to avoid reactive overhead.

### Units (a classic source of bugs)
| Library | Distance | Angles |
|---|---|---|
| satellite.js | kilometres | radians for geodetic, degrees for `degreesLat/Long` helpers |
| Cesium `Cartesian3.fromDegrees` | metres | degrees |
| ADS-B | feet, knots, feet per minute | degrees |
| Internal (this app) | metres, metres per second | degrees at the edges, radians inside `geo/` |

Convert once at the boundary. Constants: `FT_TO_M = 0.3048`, `KT_TO_MPS = 0.514444`, `FPM_TO_MPS = 0.00508`, `EARTH_R_M = 6371008.8`.

## 7. Rendering

| Layer | Primitive | Why |
|---|---|---|
| Satellites | `PointPrimitiveCollection`, one point per object | Thousands at near-zero cost |
| Aircraft | `BillboardCollection` with one sprite, `rotation` from heading, `alignedAxis` up | Oriented icons, batched |
| Fires | `PointPrimitiveCollection`, capped | |
| Quakes | Entities with a ground-clamped ellipse and a `CallbackProperty` radius for the ripple | Few objects, animated |
| Selection ring, trails, ground track | Entities or `PolylineCollection` | One object at a time |
| Scan circle and zones | Entities (ellipse, polygon) | Few objects |

**Picking:** `scene.pick` on click returns the primitive, whose `id` property maps back to the data record. Hover highlight uses `scene.drillPick` sparingly (only on mouse move end, debounced).

**Imagery:** GIBS via `WebMapTileServiceImageryProvider` using the REST URL pattern, with `GeographicTilingScheme` for the EPSG:4326 endpoint. Layer ids and tile matrix set names (for example true-colour VIIRS, Black Marble, Blue Marble): **VERIFY** against `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?SERVICE=WMTS&request=GetCapabilities`. Use yesterday's UTC date for daily layers.

**Lighting:** set `globe.enableLighting = true` for day/night shading.

## 8. Algorithms

### 8.1 SGP4 pipeline (SAT-01)
```
elements (OMM) --json2satrec--> satrec
every 500 ms in the worker, for each satrec:
    {position: eci_km} = propagate(satrec, now)         # km, ECI (TEME) frame
    gmst = gstime(now)
    ecf_km = eciToEcf(eci_km, gmst)                      # rotate by Earth rotation
    write ecf_km * 1000 into a Float32Array (x, y, z metres)   # Float32 is enough at this scale
post the buffer to the main thread (transfer, not copy)
main thread: for i in objects: point[i].position = Cartesian3(buf[3i], buf[3i+1], buf[3i+2])
```
- Drop objects where `propagate` returns `false` (decayed or bad elements) and count them.
- Float32 has about 1-metre precision at 7,000 km from Earth's centre, which is fine for display. Use Float64 for look-angle maths in 8.5.
- Altitude and speed for the dossier: geodetic altitude from `eciToGeodetic`, speed from the velocity vector norm.

### 8.2 Dead reckoning (FLT-01)
For an aircraft with last fix at `t0`, ground speed `v` (m/s), true track `θ` (radians from north) and latitude `φ`, longitude `λ`:
```
dt = (now - t0) / 1000                    # seconds, clamp to 90 s
δ  = v * dt / R                           # angular distance, R = 6371008.8 m
φ2 = asin( sinφ·cosδ + cosφ·sinδ·cosθ )
λ2 = λ + atan2( sinθ·sinδ·cosφ , cosδ − sinφ·sinφ2 )
alt2 = alt + vs * dt                      # clamp to [0, 20000] m
```
When a new fix arrives, do not snap. Keep the displayed position and ease toward the new predicted position over 500 ms: `display += (target - display) * min(1, dt/0.5)`.
Aircraft on the ground (`on_ground`) do not move. Aircraft with `seen_s > 60` fade out.

### 8.3 Great-circle distance (SCN-01, SCN-02)
Haversine: `a = sin²(Δφ/2) + cosφ1·cosφ2·sin²(Δλ/2); d = 2R·asin(√a)`.
Point in circle: `d(center, p) <= radius`.
Performance: pre-filter with a latitude/longitude bounding box, then haversine only for the survivors.

### 8.4 Point in polygon (SCN-02)
Ray casting on (lon, lat), counting edge crossings of a ray from the point. Documented limitation: polygons crossing the antimeridian (±180°) or enclosing a pole are not supported. Say so rather than hide it.

### 8.5 Look angles and passes (SAT-04, SCN-01)
- Elevation of a satellite from an observer: `ecfToLookAngles(observerGeodetic, satEcf)` returns azimuth, elevation and range. "Overhead" means elevation above 10°.
- Next pass: step time forward in 30 s increments from now for up to 24 h. Find where elevation crosses 10° upward (rise) and downward (set). Refine each crossing by bisection to about 1 s. Report rise time, maximum elevation (track the maximum between rise and set) and duration.

### 8.6 Footprint (SAT-03)
Visible ground radius for satellite altitude `h` and minimum elevation `ε`:
```
λ = arccos( R·cos ε / (R + h) ) − ε        # Earth central angle
ground_radius = R · λ
```
With ε = 0 this is the horizon circle. Use ε = 10° for a more realistic coverage ring.

### 8.7 Ground track (SAT-03)
Propagate the selected satellite at 30 s steps for 90 minutes, convert each to geodetic lat/lon, break the line where longitude jumps by more than 180° (antimeridian), and draw a clamped polyline.

## 9. Performance design

- Satellites: SGP4 in a worker, results via a transferred buffer. Only the main thread touches Cesium objects.
- Aircraft: positions in `Float64Array` (lat, lon, alt, speed, heading, t0). One loop per frame updates billboard positions. No object allocation in the loop (reuse a scratch `Cartesian3`).
- Do not use `Entity` for bulk data.
- `scene.requestRenderMode` stays off (the scene is always animating), but lower `resolutionScale` when FPS drops.
- FPS monitor: rolling average over 120 frames. Under 20 FPS for 5 seconds triggers "performance mode": caps reduced by 30%, post-process effects off, `resolutionScale` 0.8.
- Hard caps: satellites 4,000, aircraft 3,000, fires 20,000, quakes 500.
- Expose `window.__netra = { stats(), setMode(), intents }` so Playwright can read FPS and counts and inject intents.
- Hand tracking runs from `requestVideoFrameCallback` at about 30 Hz. If a frame takes over 33 ms, skip the next one.

## 10. Gesture engine

### 10.1 Pipeline
`video frame -> HandLandmarker (21 landmarks, normalised x,y,z) -> features -> filter -> classifier -> state machine -> intents`

### 10.2 MediaPipe landmark indices used
0 wrist; 4 thumb tip; 8 index tip; 12 middle tip; 16 ring tip; 20 pinky tip; 9 middle-finger base (MCP); 5 index MCP; 17 pinky MCP.

### 10.3 Features (scale-invariant, so hand distance does not matter)
```
palm       = dist(lm[0], lm[9])                              # reference length
pinch      = dist(lm[4], lm[8]) / palm
ext_i      = dist(lm[tip_i], lm[0]) / palm   for tips 8,12,16,20
fist_score = mean(ext_i)                      # small when fingers are curled
palm_ctr   = mean(lm[0], lm[5], lm[9], lm[13], lm[17])       # x, y in video space, mirrored
```

### 10.4 Classifier (starting thresholds, calibrate on the demo laptop)
| Gesture | Rule |
|---|---|
| PINCH | `pinch < 0.25` to enter, `pinch > 0.35` to leave (hysteresis) |
| FIST | `fist_score < 1.1` and `pinch` not active |
| OPEN_PALM | `fist_score > 1.6` and all four fingers extended |
| THUMBS_UP | thumb tip above thumb base and the four other fingers curled (`fist_score < 1.2`), thumb extended |
| NONE | anything else |

A gesture must hold for 3 consecutive frames (about 100 ms) before it is accepted, and 3 frames of disagreement before it ends. This removes flicker.

### 10.5 State machine and intents
```
IDLE ──OPEN_PALM──▶ PAN ──PINCH──▶ ZOOM
 ▲                   │              │
 │                   └──release─────┘
 ├──FIST (held 800 ms over a target)──▶ FLY_ARMED ──▶ emit FLY_TO ──▶ IDLE (1 s lockout)
 └──tracking lost > 300 ms──▶ IDLE
```
- PAN: `dx = (palm_ctr.x − prev.x) * GAIN_PAN`, `dy` likewise. The x axis is mirrored so moving the hand right rotates the globe right. Emit `ROTATE(dx, dy)`.
- ZOOM: `dz = (palm_ctr.y − prev.y) * GAIN_ZOOM * camera_height`. Hand up zooms in. Emit `ZOOM(dz)`. Scaling by camera height makes zoom usable from orbit to street level.
- FLY_ARMED: the "target" is the object or city nearest the screen-centre reticle within 80 px. Show a filling ring during the 800 ms hold.
- Smoothing: exponential moving average, `x_f = α·x + (1−α)·x_f_prev`, α about 0.35 for motion. (A One Euro filter is a good upgrade if time allows.)
- Dead zone: ignore movements under 0.004 normalised units so a resting hand does not drift the globe.
- Relative control only (hand deltas, not absolute position). It is more comfortable and tolerant to where the user stands.

### 10.6 Offline assets
The HandLandmarker needs two things: the Wasm files and the `hand_landmarker.task` model. Official examples load both from a CDN. For the demo, copy the Wasm directory from `node_modules/@mediapipe/tasks-vision/wasm` into `public/`, and download the model once while online into `public/models/`. Without this, gestures fail offline. Add a check to `testing.md` T-GES-08.

### 10.7 Camera controller
`input/intents.js` defines the only API into the camera: `rotate(dx, dy)`, `zoom(dz)`, `flyTo(target)`, `nextMode()`. Mouse and gestures both call it. Rotation uses `camera.rotateRight/rotateUp` or equivalent scaled by altitude. Zoom uses `camera.zoomIn/zoomOut` with a minimum and maximum height clamp. Fly-to uses `camera.flyTo({destination, duration: 2.5})`.

## 11. Build and runtime

**`api/Dockerfile`**: python 3.12 slim, install from lock file, run `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Volume `/app/cache`. Healthcheck calls `/api/health`.

**`web/Dockerfile`**: stage 1 Node, `npm ci`, `npm run build`. Stage 2 Nginx serving `dist/` with `nginx.conf` proxying `/api/` to `http://api:8000/`. Add gzip and long-cache headers for hashed assets.

**`docker-compose.yml`**
```yaml
services:
  api:
    build: ./api
    env_file: .env
    volumes: ["./data/cache:/app/cache"]
    healthcheck: { test: ["CMD", "python", "-c", "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/health')"], interval: 10s }
  web:
    build: ./web
    ports: ["8080:80"]
    depends_on: { api: { condition: service_healthy } }
```

**Browser requirements:** a current Chrome or Edge (best MediaPipe and WebGL support). Camera access works on `localhost` without HTTPS. Test the exact browser you will demo in.

## 12. Viva cheat sheet: the 6 mechanisms

Learn each to the point where you can draw it on a whiteboard.

1. **Satellite positions (SGP4).** Orbital elements describe an orbit at a time (epoch). SGP4 is the standard model that predicts where the satellite will be later, including Earth's oblateness and drag. It outputs position in an inertial frame (ECI). We rotate it by Earth's rotation angle (GMST) into an Earth-fixed frame (ECF) and then to latitude, longitude and altitude. Elements are fetched every couple of hours, the rest is local computation.
2. **Aircraft data (ADS-B).** Aircraft transponders broadcast position, speed and heading. Volunteers with receivers feed aggregators such as adsb.lol, which expose an API. Coverage depends on receivers, so the data is partial. We poll, cache, normalise and drop owner fields.
3. **Smooth motion (dead reckoning).** Polls arrive every few seconds. Between them we move each aircraft along its heading at its speed using great-circle maths, then ease toward the next real fix.
4. **Caching proxy and resilience.** One service owns all upstream calls, so we respect rate limits, keep the key off the browser, and serve last-good data when an upstream fails, marking it stale. That is stale-while-error.
5. **Gestures.** MediaPipe gives 21 hand landmarks. We turn them into scale-invariant features (distances divided by palm size), classify with thresholds and hysteresis, require a short hold to avoid flicker, and drive a small state machine that outputs camera intents. Mouse uses the same intents.
6. **Scan and geofence geometry.** Haversine gives great-circle distance for circular scans. Ray casting tests polygon membership. A bounding-box pre-filter keeps it fast. Satellite visibility uses look angles and a 10° elevation rule.

**Likely panel questions (prepare one-sentence answers)**
- Why compute satellites in the browser? (Positions change every second, elements every hours. Sending elements is cheaper than streaming positions.)
- Why not show all flights worldwide? (Free community data, partial coverage, rate limits. We sample busy regions and say so.)
- How accurate is it? (Aircraft: as accurate as the broadcast, plus some seconds of age. Satellites: SGP4 is accurate to about a kilometre near epoch and degrades over days.)
- What happens when the internet dies? (Stale badges, then fixtures with a REPLAY banner.)
- Why a proxy at all? (Rate limits, secrets, CORS, caching, fixtures.)
- What would break at 10x load? (Single API instance memory cache. Move to Redis and add horizontal replicas.)
- Is this surveillance? (No. Public, voluntarily broadcast data, owner fields dropped, labelled demonstration.)
- What did you build and what did you use? (Be exact: libraries for globe, SGP4 and hand landmarks. Your work: the pipeline, caching, dead reckoning, scan geometry, state machine, UI, tests.)

## 13. Verify list (do these early)

| # | Item | Where | When |
|---|---|---|---|
| V1 | adsb.lol: bulk or global query? Maximum `dist`? Request-rate guidance? (`https://api.adsb.lol/docs`) | 4.3, 5.2 | Phase 3, first 15 minutes |
| V2 | `satellite.js` supports OMM JSON (`json2satrec`)? If not, build TLE lines on the backend for objects under 100,000 | 8.1 | Phase 1 |
| V3 | GIBS layer ids, tile matrix sets and formats via GetCapabilities | 7 | Phase 1 |
| V4 | Cesium default assets work with no ion token when imagery is overridden | GL-01 | Phase 1 |
| V5 | CelesTrak current groups and refresh behaviour | 4.2, 5.4 | Phase 1 |
| V6 | MediaPipe model and Wasm load from local files | 10.6 | Phase 6 start, earlier if possible |
| V7 | FIRMS endpoint format and key activation | 4.5 | Phase 4 |
| V8 | Docker Desktop and WebGL performance on the demo laptop | 11 | Today |