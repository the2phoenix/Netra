# NETRA (नेत्र) — Earth Command Center

A browser-based 3D Earth command center where live aircraft, satellites, earthquakes, and fires move in real time, controlled by hand gestures and mouse input, featuring a dedicated monitoring-room interface: object dossiers, scan zones, alerts, and live event feeds.

Built using open and public data only, keyless or free-tier APIs, with offline fallback resilience.

---

## Architecture Overview

NETRA runs on a two-container setup:
- **`web`**: CesiumJS 3D globe with NASA GIBS imagery, off-thread SGP4 orbit propagation in a Web Worker, and MediaPipe hand tracking feeding an abstract intent engine. Served via Nginx.
- **`api`**: Python 3.12 FastAPI proxy layer handling validation, rate-limiting, and stale-while-error TTL caching for upstream feeds (`adsb.lol`, CelesTrak, USGS, NASA FIRMS), plus offline fixture playback.

```
 Browser (Cesium, MediaPipe, SGP4 worker)
        | same origin /api              \ direct tile requests
        v                                v
   Nginx (web) --proxy--> FastAPI (api)   NASA GIBS
                             |
        adsb.lol  CelesTrak  USGS  FIRMS   (or recorded fixtures when offline)
```

---

## Documentation Index

All core architectural, engineering, and product specifications are kept in [`docs/`](docs/):

1. **[Product Requirements Document (`prd.md`)](docs/prd.md)** — Vision, goals, non-goals, user stories, and acceptance baselines.
2. **[Feature Catalogue (`features.md`)](docs/features.md)** — Full requirement matrix (Must, Should, Stretch) with measurable criteria.
3. **[Technical Requirements Document (`trd.md`)](docs/trd.md)** — Engineering choices, data models, API contracts, formulas, and viva explanation points.
4. **[System Architecture (`architecture.md`)](docs/architecture.md)** — Data pipelines, sequence flows, seams, and Architectural Decision Records (ADRs).
5. **[UI & UX Design (`ui-ux.md`)](docs/ui-ux.md)** — Design tokens, typography, instrument styling, and the scan iris animation.
6. **[Wireframes (`wireframe.md`)](docs/wireframe.md)** — ASCII UI layouts, dossier variants, HUD states, and boot terminal.
7. **[Software Engineering Standards (`software_engineering.md`)](docs/software_engineering.md)** — Code principles, file length budgets, Git conventions, and the "Explain Before Merge" viva rule.
8. **[Testing Strategy & Test Plan (`testing.md`)](docs/testing.md)** — Unit, integration, chaos, and Playwright E2E test specifications.
9. **[Execution Roadmap (`gsd.md`)](docs/gsd.md)** — 7-phase build schedule, checkpoints, and fallbacks.

---

## Quickstart

### Prerequisites
- Docker & Docker Compose (or Python 3.12+ and Node.js 20+)
- Webcam (optional; mouse/keyboard fallback is always available)

### Run with Docker Compose
```bash
cp .env.example .env
docker compose up --build
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## License & Attribution
- Public data provided by CelesTrak, adsb.lol, USGS, and NASA (GIBS / FIRMS).
- Educational and demonstration project.
