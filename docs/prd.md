# NETRA: Product Requirements Document

| Field | Value |
|---|---|
| Product | NETRA (working name; Sanskrit for "eye"). Earth command center. |
| Owner | Arnesh (solo builder, AI-assisted) |
| Version | 1.0, 2026-10-31 |
| Demo date | Monday 2026-11-02 |
| Status | Approved for build |
| Skills applied | Feature Forge (requirements, user stories, EARS acceptance criteria), The Fool (assumption stress-test, section 11) |
| Related | `features.md`, `trd.md`, `architecture.md`, `ui-ux.md`, `wireframe.md`, `testing.md`, `software_engineering.md`, `gsd.md` |

---

## 1. One-line summary

A browser-based 3D Earth where live aircraft, satellites, earthquakes and fires move in real time, controlled by hand gestures, with a monitoring-room interface: dossiers, scan zones, alerts and a live event feed. Free data only. One command to run.

## 2. Why this exists

**Problem.** The college demo on Monday needs a software project that is distinct, visibly live, and fully explainable by one person. The drone project is blocked (partner left, three fake MPU6050 boards). Most peers will show dashboards, trackers and CRUD apps.

**Opportunity.** Open data now covers aircraft, satellites, quakes, fires and daily satellite imagery for free. Few student projects combine them with a cinematic interface and gesture control. A visibly real data pipeline is what separates this from a pretty map.

**Honest framing.** NETRA is a visualization of public data with a monitoring-room feel. It is not a monitoring system and must never claim to be one.

## 3. Goals

| ID | Goal | Measure |
|---|---|---|
| G1 | Win the demo: a panel member says "I haven't seen this before" and cannot catch the presenter out on how it works | Presenter explains all 6 core mechanisms (`trd.md` section 12) with no notes |
| G2 | Show real, live data at world scale | At least 2,000 satellites and 1,500 aircraft on screen at the same time, updating live |
| G3 | Feel like a monitoring system | Dossier, scan, alert feed, feed-health badges and replay all work |
| G4 | Run smoothly on the demo laptop | 30 FPS or better at the target load (NFR-01) |
| G5 | Survive a bad day | App still demos with no internet and no webcam (NFR-02, GES-05, BAK-02) |
| G6 | Be GitHub-ready afterwards | README with GIF, docker compose, attribution |

## 4. Non-goals

- Not an operational surveillance, air traffic, defence or safety tool. No claim of accuracy or completeness.
- No tracking of private individuals. No registration-to-owner lookup. No "follow this person" features.
- No paid APIs, no cloud hosting, no accounts, no login.
- No mobile or tablet layout. Desktop 16:9 only.
- No Kubernetes. Docker Compose is the deployment.
- No AI chat, no RAG, no natural-language command bar before the must-haves are done (stretch only).

## 5. Users and scenarios

| ID | Persona | Situation | What they need |
|---|---|---|---|
| P1 | Examiner / panel member | Watches a 5-minute demo, then asks viva questions | Instant "wow", visible liveness, honest answers on data sources and limits |
| P2 | Curious viewer | Walks up and tries it | Zero setup, gestures that work in 10 seconds, mouse fallback |
| P3 | Builder (Arnesh) | Runs, extends and publishes it | One command start, clean modules, fixtures, docs |

### User stories (Feature Forge format)

- **US-1** As an examiner, I want to see real aircraft and satellites moving on a globe so that I can trust the project works on live data.
- **US-2** As an examiner, I want to click any object and see its details so that I can check the data is real.
- **US-3** As a viewer, I want to rotate and zoom the globe with my hand so that the demo feels futuristic.
- **US-4** As a viewer, I want to scan a region and see what is in it so that it feels like a monitoring room.
- **US-5** As an examiner, I want to know when data is stale or recorded so that I am not misled.
- **US-6** As the presenter, I want the demo to work with no internet or webcam so that a bad venue cannot ruin it.
- **US-7** As the presenter, I want to start everything with one command so that setup cannot fail on stage.
- **US-8** As a viewer, I want to see alerts for things like emergency squawk codes or quakes so that the interface feels alive.

## 6. Scope summary

Full catalogue with acceptance criteria and phases is in `features.md`. Tiers: **M** must (demo fails without it), **S** should (demo is weaker without it), **X** stretch (only if everything else is stable).

| Area | Must | Should | Stretch |
|---|---|---|---|
| Globe and imagery | GL-01 | GL-02 | |
| Satellites | SAT-01, SAT-02 | SAT-03, SAT-04 | |
| Aircraft | FLT-01, FLT-02 | FLT-03 | |
| Hazards | HAZ-01 | HAZ-02 | HAZ-03 |
| HUD and feed | HUD-01, HUD-02 | HUD-03, HUD-04 | |
| Scan | SCN-01 | SCN-02 | |
| Gestures | GES-01, GES-02, GES-03, GES-05 | GES-04 | |
| Visual modes and replay | | VIS-01, REP-01 | |
| Backend and demo safety | BAK-01, BAK-02, DEM-01, DEM-02 | | |
| Command bar, AI summary | | | CMD-01, AI-01 |

## 7. Functional requirements (EARS)

EARS patterns: Ubiquitous, Event-driven (WHEN), State-driven (WHILE), Unwanted (IF ... THEN), Optional (WHERE).

**Globe and data**
- **GL-01** The system SHALL render a 3D globe with NASA GIBS imagery. IF GIBS tiles fail to load THEN the system SHALL fall back to the bundled Natural Earth imagery and show a notice.
- **SAT-01** The system SHALL propagate satellite positions locally with SGP4 from CelesTrak orbital elements and update them at least twice per second. WHEN the catalog is older than the upstream refresh interval THEN the system SHALL keep using the cached elements and mark the feed STALE.
- **FLT-01** WHEN a new aircraft snapshot arrives THEN the system SHALL update aircraft positions and, between snapshots, SHALL move each aircraft by dead reckoning from its last speed and heading.
- **HAZ-01** The system SHALL show earthquakes from the last 24 hours, sized by magnitude.

**Interaction**
- **SAT-02 / FLT-02** WHEN the user clicks an aircraft or satellite THEN the system SHALL open its dossier within 200 ms.
- **SCN-01** WHEN the user opens scan mode THEN the system SHALL list every aircraft, satellite, quake and fire inside the chosen radius and update the list at least every 2 seconds.
- **GES-01** WHILE an open palm is tracked THEN the system SHALL rotate the globe in proportion to hand movement.
- **GES-02** WHILE a pinch is held THEN the system SHALL zoom the camera in proportion to vertical hand movement.
- **GES-03** WHEN a fist is held for 0.8 seconds over a highlighted target THEN the system SHALL fly the camera to it.
- **GES-05** The system SHALL provide a mouse and keyboard equivalent for every gesture. IF no camera is available THEN the system SHALL start in mouse mode without error.

**Honesty and safety**
- **HUD-01** The system SHALL display a status badge (LIVE, STALE or OFF) for every data feed, and a clear banner while in replay mode.
- **DEM-02** The system SHALL show data credits and a "demonstration, public data only" statement.
- **BAK-01** IF an upstream source is unreachable or rate limited THEN the backend SHALL serve the last good data marked stale, and SHALL NOT crash.

## 8. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-01 Performance | Frame rate at 2,400 satellites + 1,800 aircraft + 300 quakes on the demo laptop | 30 FPS or higher, 1% lows above 20 |
| NFR-02 Resilience | Works with no internet (recorded data) and no webcam (mouse mode) | Both verified in rehearsal |
| NFR-03 Security | No API key or secret in browser code, logs or repo | Verified by grep and review |
| NFR-04 Cost | Total spend | 0 INR. Free tiers and keyless sources only. |
| NFR-05 Start-up | `docker compose up` to a usable globe | Under 60 seconds on a warm machine, under 3 minutes cold |
| NFR-06 Privacy | Camera video never leaves the browser | No upload, no storage, stated on screen |
| NFR-07 Accessibility (baseline) | Keyboard operable, visible focus, contrast AA for text | Checked in `ui-ux.md` section 9 |
| NFR-08 Maintainability | Modules small enough to explain in 3 sentences | Review checklist in `software_engineering.md` |

## 9. Success metrics (demo day)

| Metric | Target |
|---|---|
| Cold start to globe on screen | Under 60 s |
| Rehearsed demo, no crash or freeze | 3 runs in a row, 10 minutes each |
| Mechanisms the presenter can explain unaided | 6 of 6 |
| Network-off demo | Passes |
| Webcam-off demo | Passes |
| Fallback video recorded | Yes, before Monday morning |
| README with GIF and credits | Yes, within 48 hours after the demo |

## 10. Constraints and assumptions

**Constraints:** about 48 hours, one person, AI-assisted coding, free data only, venue internet may be poor, one webcam of unknown quality, projector resolution unknown.

**Assumptions to confirm (owner: Arnesh):**
1. The demo laptop runs Docker Desktop (or WSL2) and has a dedicated or decent integrated GPU.
2. The panel allows a live demo and a laptop of the presenter's choice.
3. The department does not mandate a specific stack, database or report format. (If it does, see risk R7.)
4. A free Cesium ion account is available if needed. The default setup should not require one.

## 11. Risks and stress test (The Fool)

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Venue Wi-Fi fails | High | High | Offline replay mode with recorded fixtures (BAK-02). Record them Sunday afternoon. |
| R2 | Webcam or lighting breaks gestures | Medium | Medium | Mouse parity (GES-05). Gesture setup screen. Plain wall, good light. |
| R3 | Too many objects freeze the browser | Medium | High | Point and billboard collections, worker for SGP4, hard caps, FPS budget (`trd.md` section 9). |
| R4 | adsb.lol has no global endpoint or limits requests | Medium | High | 15-minute spike first. Fallback is hub sampling around 12 busy regions, labelled "sampled" in the UI. |
| R5 | CelesTrak returns 403 for repeat requests inside its refresh window | High | Medium | Backend fetches at most once per group per refresh window and serves from disk cache. |
| R6 | Scope creep eats the polish and rehearsal time | High | High | Cut line in `features.md`. Feature freeze Sunday 23:00. Monday is rehearsal only. |
| R7 | Department requires a report, PPT or database that is not planned | Unknown | High | Ask today. If a database is required, add SQLite for the alert log and replay buffer. |
| R8 | Presenter cannot explain code written by AI | Medium | Critical | Viva cheat sheet (`trd.md` section 12). Write 3 lines per module in `docs/explain/` as each module lands. |
| R9 | Panel challenges originality: similar open-source globes exist | Medium | Medium | Say so first. The differentiators are gesture control, the scan and alert layer, offline replay and the honest data labels. |
| R10 | Laptop throttles on battery | Medium | Medium | Plugged in, high-performance power mode, tested at the venue resolution. |

**Hardest question to the plan:** is a gesture-controlled globe a fun demo trick or a real project? The answer on Monday is the data pipeline, the caching and resilience design, and the geometry behind scan and geofences. Lead with those in the viva and use gestures as the "show".

## 12. Ethics and data use

- Public, voluntarily broadcast or openly published data only (ADS-B, orbital elements, earthquake and fire detections).
- Aircraft registration and owner details are not requested from the backend by default. No feature looks up who owns an aircraft.
- Attribution shown in the app (DEM-02). adsb.lol data is ODbL licensed, so credit it and do not imply it is complete.
- The interface says "demonstration, not operational" in the About panel and the README.

## 13. Open questions

| # | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | Does adsb.lol offer a bulk or global query? Check `https://api.adsb.lol/docs` | Arnesh | Phase 3 start |
| Q2 | Exact Monday time slot, projector resolution, and whether the venue has internet | Arnesh | Sunday |
| Q3 | Does the department require a report, PPT, synopsis or a specific stack? | Arnesh | Today |
| Q4 | Which laptop will run the demo, and does it run Docker Desktop? | Arnesh | Today |
| Q5 | Keep the name NETRA, or use Trinetra to tie in with the Rudra universe? | Arnesh | Before the UI is built |

## 14. Milestones

| Milestone | When | Exit criterion |
|---|---|---|
| M1 Tracer | Saturday ~16:00 | Globe, ISS moving from a real element set, HUD clock, `docker compose up` works |
| M2 Live world | Saturday ~23:00 | Satellites and aircraft live, dossier works |
| M3 Alive | Sunday ~14:00 | Quakes, scan mode, alerts, feed health |
| M4 Hands | Sunday ~18:30 | Gestures work with mouse parity |
| M5 Freeze | Sunday 23:00 | Polish done, fixtures recorded, no new features |
| M6 Demo | Monday | Rehearse 3 times, record fallback video, go |

Phase detail and cut rules: `gsd.md`.