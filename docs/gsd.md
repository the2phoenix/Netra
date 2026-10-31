# NETRA: GSD Execution Plan

Version 1.0 | 2026-10-31
Built on **GSD Core** (`open-gsd/gsd-core`): a spec-driven, context-engineering workflow for Claude Code and other AI coding agents. Each unit of work (a "phase") runs the loop **Discuss, (UI design), Plan, Execute, Verify, Ship**, and state is kept in a `.planning/` folder so work survives context resets.
Combined with the **jeffallan/claude-skills** plugin (see `software_engineering.md` section 2).

Facts about GSD in this file come from its README and the "phase loop" and "plan a phase" docs. Where I could not confirm a command name, it is marked **CONFIRM**.

---

## 1. Read this first: honest trade-offs

- GSD is built for **disciplined, multi-session work**. It adds overhead per phase (discuss, research, plan, plan-check, verify). You have about 48 hours and a Monday deadline.
- To make it fit: **skip research** (this document set is the research), use **coarse granularity**, and keep phases to 3 to 4.5 hours each. Use the full loop only where mistakes are expensive: Phases 1, 3 and 6.
- GSD runs on **Claude Code** (a command-line agent), not in the chat window. It also needs agent usage that your plan must allow. Check this **today**. If you cannot run it, section 9 gives a manual version of the same loop with the same files.
- The loop's value for you is not ceremony. It is: decisions written down before code, a plan small enough to finish, and verification against the requirement IDs. That is what keeps a 20-hour build from drifting.

## 2. Setup (about 20 minutes, Saturday 12:30)

```
# 1. install GSD (choose Claude Code and "local" to this project when prompted)
npx @opengsd/gsd-core@latest

# 2. install the skills (inside Claude Code)
/plugin marketplace add jeffallan/claude-skills
/plugin install fullstack-dev-skills@fullstack-dev-skills

# 3. start the project
/gsd-new-project
```
In the `/gsd-new-project` questions, paste or point to `prd.md` for the vision and scope, `trd.md` for technical constraints, and use the requirement IDs below. Put the nine planning files in `docs/` and tell GSD to treat them as the source of truth.

Create the GitHub repo first (`gh repo create netra --private`), because GSD's Ship step opens pull requests.

**First-hour spikes (before Phase 1 planning is final):** run the V-list items V8, V2, V3, V4 from `trd.md` section 13. They can change Phase 1 decisions.

## 3. Planning files GSD will manage

| File | Purpose |
|---|---|
| `.planning/PROJECT.md` | Vision and constraints (seed below) |
| `.planning/REQUIREMENTS.md` | Requirement IDs and tiers (seed below) |
| `.planning/ROADMAP.md` | Milestone and phases with goals and success criteria (seed below) |
| `.planning/STATE.md` | Where you are in the loop. Read first by every agent. |
| `.planning/{phase}-CONTEXT.md` | Decisions from the Discuss step (pre-filled seeds below) |
| `.planning/{phase}-RESEARCH.md` | Research notes (skipped in most phases) |
| `.planning/{phase}-{N}-PLAN.md` | Task plans with `<read_first>` and `<acceptance_criteria>` |
| `.planning/{phase}-VERIFICATION.md` | Verification result and gaps |
| `UI-SPEC.md` (via `/gsd-ui-phase`) | Optional design contract per UI-heavy phase |

## 4. Seeds

### 4.1 PROJECT.md
```
# NETRA
A browser 3D Earth with live aircraft, satellites, quakes and fires, gesture control, scan zones, alerts and offline replay. Free data only. Demo on 2026-11-02. Solo, AI-assisted.

Core value: real data pipeline + cinematic monitoring-room interface that is honest about what is live, stale or recorded.

Constraints: $0 spend; keyless or free-key sources; 48 hours; desktop 16:9; must run with no internet and no webcam; no owner lookups; "demonstration, public data only".

Source of truth: docs/prd.md, docs/trd.md, docs/features.md, docs/architecture.md, docs/ui-ux.md, docs/wireframe.md, docs/testing.md, docs/software_engineering.md.
```

### 4.2 REQUIREMENTS.md (IDs are the same everywhere)
```
MUST:    GL-01 SAT-01 SAT-02 FLT-01 FLT-02 HAZ-01 HUD-01 HUD-02 SCN-01
         GES-01 GES-02 GES-03 GES-05 BAK-01 BAK-02 DEM-01 DEM-02
SHOULD:  GL-02 SAT-03 SAT-04 FLT-03 HAZ-02 HUD-03 HUD-04 SCN-02 GES-04 VIS-01 REP-01
STRETCH: HAZ-03 CMD-01 AI-01
NFR:     NFR-01 performance, NFR-02 resilience, NFR-03 security, NFR-04 cost,
         NFR-05 startup, NFR-06 privacy, NFR-07 accessibility, NFR-08 maintainability
```
GSD's plan checker verifies that every requirement ID for a phase appears in at least one plan. Keep the IDs exact.

### 4.3 ROADMAP.md

**Milestone v0.1 "Demo 2026-11-02"**

| Phase | Name | Goal (one sentence) | Requirements | Time (IST) | Mode |
|---|---|---|---|---|---|
| 1 | Tracer | One real end-to-end slice: browser to API to CelesTrak to SGP4 worker to a moving ISS on a GIBS globe, started with one command | GL-01, SAT-01 (ISS only), BAK-01 (satellite route), HUD-01 (clock), DEM-01, GES-05 (mouse) | Sat 12:30 to 16:30 | `--mvp` tracer |
| 2 | Satellites at scale | 2,000+ satellites at 30 FPS with selection, dossier and layer panel | SAT-01, SAT-02, HUD-02 | Sat 16:30 to 19:30 | standard |
| 3 | Live aircraft | 1,500+ aircraft from a caching proxy, smooth by dead reckoning, with dossier and trail | FLT-01, FLT-02, BAK-01 | Sat 20:15 to 00:00 | standard, `--tdd` for geo |
| 4 | Hazards and imagery | Quakes, fires, night lights, day/night and feed-health badges | HAZ-01, HAZ-02, GL-02, HUD-01, HUD-02 | Sun 07:30 to 10:30 | standard |
| 5 | Scan and alerts | The monitoring layer: scan iris, hits, geofence zones, event feed, squawk alerts, ground tracks | SCN-01, SCN-02, HUD-04, FLT-03, SAT-03, SAT-04 | Sun 10:30 to 14:00 | `--tdd` for geo, UI-SPEC |
| 6 | Hands | Gesture control with mouse parity: rotate, zoom, fly-to | GES-01, GES-02, GES-03, GES-04, GES-05 | Sun 14:00 to 18:30 | `--tdd` for classifier |
| 7 | Polish and hardening | Cinematic boot, visual modes, replay, offline fixtures, credits, performance, rehearsal assets | HUD-03, VIS-01, REP-01, BAK-02, DEM-02, NFR-01, NFR-02, NFR-03 | Sun 18:30 to 23:00 | standard |
| 8 | Stretch (optional) | Command bar, AI summary, news pings | CMD-01, AI-01, HAZ-03 | Only if phase 7 is green early | quick |

**Success criteria per phase** (these become the verifier's checklist):

1. Tracer: `docker compose up` shows a globe with GIBS imagery; the ISS moves and matches a public tracker within a few degrees; top-bar clock runs; mouse rotates and zooms; killing the API shows a stale state instead of a crash.
2. Satellites: 2,000+ points at 30 FPS; click opens a dossier in under 200 ms; layer toggle works; SGP4 batch under 8 ms in the worker.
3. Aircraft: 1,500+ aircraft; no teleporting on polls; dossier without registration; stale badge after 60 s of failure; T-GEO-07..10 pass.
4. Hazards: quakes and fires render and toggle; night-lights visible; each feed has a correct LIVE, STALE or OFF badge; fires hidden without a key.
5. Scan: hits match an independent haversine count; zone entry creates one event per object; squawk fixture creates one alert; ground track and footprint for the selected satellite.
6. Hands: rotate, zoom and fly-to work for 5 minutes without false triggers; mouse parity; camera loss falls back to mouse mode; T-GES-01..11 pass.
7. Polish: offline mode demo passes; REPLAY banner honest; About panel complete; T-PERF-01..04 pass on the demo laptop; security checklist passes; fallback video recorded.

## 5. Phase context seeds (paste into each Discuss step)

These are the decisions already made in the planning documents. Confirm or change them, do not rediscover them.

**Phase 1 (Tracer)**
- Vite plus plain JS modules, Cesium via `vite-plugin-cesium`. FastAPI plus Uvicorn. Nginx serves the build and proxies `/api`.
- Imagery: GIBS WMTS with yesterday's UTC date for daily layers; bundled Natural Earth as fallback. Terrain: none.
- Satellite data as JSON/OMM from CelesTrak, group `stations` for the tracer. If `satellite.js` lacks OMM support, build TLE lines in the backend.
- SGP4 runs in a Web Worker from the start (do not refactor later).
- Intents layer (`ROTATE`, `ZOOM`, `FLY_TO`, `NEXT_MODE`) exists from day one, mouse is its first client.
- Include the compose healthchecks and a `/api/health` skeleton.
- Skeleton adaptation: there is no database. The "one real read/write" is one real CelesTrak fetch plus one disk-cache write.

**Phase 2 (Satellites)**
- Groups: stations, gps-ops, weather, geo, science, Starlink sample capped at 1,500.
- Point primitives, ids stored on the primitive for picking.
- Dossier fields: name, NORAD ID, altitude, speed, inclination, period, element age.

**Phase 3 (Aircraft)**
- Do the 15-minute adsb.lol spike (V1) first. If a bulk endpoint exists, drop hub sampling.
- Hubs: 12, 250 nm, one fetch per 3 s, merged, labelled "sampled".
- Billboard collection with one sprite. Dead reckoning with 500 ms easing. Drop registration and owner fields.
- Trail: last 5 minutes, one polyline for the selected aircraft only.

**Phase 4 (Hazards and imagery)**
- USGS summary feed, 2.5+ magnitude, 24 h. Ripples as ground-clamped ellipses.
- FIRMS only with a free key; otherwise the toggle is hidden and the boot line says so.
- Night lights via GIBS Black Marble (confirm layer id with V3). Day/night via Cesium lighting.
- Feed-health badges bound to `/api/health`.

**Phase 5 (Scan and alerts)**
- Scan centre options: reticle, named city list, click. Radius 50 to 500 km. Sweep 4 s per rev.
- Geometry: bounding-box prefilter then haversine; polygon ray casting; documented antimeridian limitation.
- Satellite "overhead" means elevation above 10 degrees.
- Feed keeps 200 events, click flies to target.
- Run `/gsd-ui-phase 5` using `ui-ux.md` section 6.2 as the brief for the iris.

**Phase 6 (Hands)**
- MediaPipe HandLandmarker from the video frame callback, about 30 Hz, main thread.
- Wasm and model served locally (V6). Test offline.
- Thresholds as in `trd.md` 10.4, EMA smoothing with alpha 0.35, 3-frame debounce, hysteresis for pinch, dead zone 0.004.
- Relative control only. Gestures emit intents only and never import Cesium.
- Mouse mode always available (`M`).

**Phase 7 (Polish)**
- Boot sequence uses real health checks, max 4 s.
- Fixtures: 15 minutes of aircraft snapshots at 5 s, satellites per group, quakes, fires if keyed. Replay banner always.
- Night-vision and thermal as Cesium post-process stages on the globe only.
- Projector mode (`P`). Performance mode caps.
- Run the full security checklist and the chaos drills.

## 6. Run sheet: what to type, in order

Flags marked (verified) come from the GSD docs I read. Do not use a flag marked **CONFIRM** until you have checked `docs/COMMANDS.md` in the gsd-core repo or the in-tool help.

**Every phase**
```
/common-ground                            # skills repo: surface assumptions (optional, 5 minutes)
/gsd-discuss-phase <N>                    # capture decisions; paste the seed from section 5
/gsd-plan-phase <N> --skip-research --granularity coarse     # (verified)
/gsd-execute-phase <N>                    # CONFIRM exact command name
# verify and ship: CONFIRM names in docs/COMMANDS.md (the docs have "Verify and ship" and "Execute a phase" how-to guides)
```

**Phase-specific variants (verified flags)**
| Phase | Plan command |
|---|---|
| 1 | `/gsd-plan-phase 1 --mvp --skip-research --granularity coarse` (tracer-first is the default; `--mvp` also frames the goal as a user story and produces a walking-skeleton file for Phase 1 of a new project) |
| 3, 5, 6 | `/gsd-plan-phase <N> --skip-research --granularity coarse --tdd` (requires a failing test before each behaviour-adding task. Applied to business logic, so UI and glue code are exempt.) |
| 5 | `/gsd-ui-phase 5` first, then plan |
| If verification finds gaps | `/gsd-plan-phase <N> --gaps` (replans only the gaps; verified) |
| Small fixes (typos, tweaks) | `/gsd-quick` (verified: GSD recommends it below the phase threshold) |
| If you have a cross-AI review | `/gsd-plan-phase <N> --reviews` after `/gsd-review --phase <N>` (verified) |

**Skills to call inside each phase** (from `software_engineering.md` section 2): FastAPI Expert and Python Pro for `api/`; JavaScript Pro and Fullstack Guardian for `web/`; Test Master for tests; Code Reviewer before every Ship; Security Reviewer at Phases 3, 6 and 7; DevOps Engineer in Phases 1 and 7.

## 7. Schedule and checkpoints (IST)

| When | Block |
|---|---|
| Sat 12:30 to 12:50 | Setup (section 2), spikes V8, V2, V3, V4 |
| Sat 12:50 to 16:30 | Phase 1 |
| Sat 16:30 to 19:30 | Phase 2 |
| Sat 19:30 to 20:15 | Break and food. Real break. |
| Sat 20:15 to 00:00 | Phase 3 |
| Sat 00:00 to Sun 07:30 | Sleep. Seven hours is the plan. Do not trade it for features. |
| Sun 07:30 to 10:30 | Phase 4 |
| Sun 10:30 to 14:00 | Phase 5 (with a 30-minute lunch) |
| Sun 14:00 to 18:30 | Phase 6 |
| Sun 18:30 to 23:00 | Phase 7 (record fixtures first, at about 18:30) |
| Sun 23:00 | **Feature freeze.** Tag `m5-freeze`. |
| Mon morning | Fresh clone test, rehearse three times, record fallback video if not done, go |

**Go / no-go checkpoints**

| Checkpoint | Time | Rule |
|---|---|---|
| C1 | Sat 16:30 | Tracer works. If not, stop using the full GSD loop, switch to the manual loop (section 9), and drop Phase 2's Starlink sample. |
| C2 | Sat 24:00 | Satellites and aircraft live on screen. If aircraft are not working, use a single-region radius query around the camera and label it. Do not start Phase 4 until this works. |
| C3 | Sun 14:00 | Scan works. If not, cut SCN-02, SAT-03, SAT-04 and spend the time on scan basics. |
| C4 | Sun 18:30 | Rotate and zoom gestures work. If not, freeze gestures at what works, ship mouse-first, and put the rest of the time into polish and fixtures. Gestures are the show, not the substance. |
| C5 | Sun 23:00 | Freeze. Anything unfinished is cut. Monday is for rehearsal. |

**Cut order** is in `features.md` section 3.

## 8. How GSD maps to your testing and review

| GSD step | NETRA artefact |
|---|---|
| Discuss | Section 5 seeds, plus `/common-ground` |
| UI design | `/gsd-ui-phase` using `ui-ux.md` and `wireframe.md` |
| Plan | `{phase}-N-PLAN.md`, checked by the plan checker. Acceptance criteria must be checkable (a test or a command), matching `features.md` |
| Execute | Atomic commits per task (`software_engineering.md` section 3). Test-first where `--tdd` applies |
| Verify | Success criteria in section 4.3, tests in `testing.md`, requirement coverage by ID |
| Ship | PR, tag per milestone (`m1-tracer` and so on) |

## 9. Manual fallback loop (same files, no GSD tool)

If you cannot run GSD, or it slows you down:
1. Copy section 4 seeds into `.planning/` by hand.
2. For each phase: write `.planning/<N>-CONTEXT.md` (10 lines, from section 5), then a task list of 6 to 12 tasks, each with a "done when" line copied from `features.md` acceptance criteria.
3. Execute one task at a time with a fresh Claude Code or chat session that has only: the relevant `trd.md` section, the task, and the files it touches. This is the "fresh context" idea that GSD automates.
4. Verify against the phase success criteria and the matching `testing.md` rows.
5. Update `STATE.md` by hand: current phase, last completed task, next task, blockers.

## 10. Anti-patterns to avoid
- Planning all 8 phases in detail on Saturday. Plan one phase at a time.
- A phase that "just needs one more thing". When a phase hits its time box, verify what exists and move on, then carry the leftover forward as an explicit task.
- Letting execution run unattended past Phase 3 without reviewing the diff. Explain-before-merge applies to everything the agent writes.
- Spending the verify step on features that were cut. Update `REQUIREMENTS.md` when you cut something so the verifier does not hunt for it.
- Skipping sleep. A tired Sunday costs more than the extra Saturday hours gain.

## 11. After Monday
Use `/gsd-new-milestone` style work (CONFIRM name) for v0.2: command bar, AI summary, SQLite alert history, hosted read-only demo, README GIF, a short post for Obsidian Phoenix or GitHub.