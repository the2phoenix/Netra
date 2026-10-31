# NETRA: Wireframes

Version 1.0 | 2026-10-31 | Desktop 16:9 only (1920x1080 target, must hold at 1366x768)

Low fidelity on purpose: structure, hierarchy and states. No colour, no type. Colour and type live in `ui-ux.md`. Requirement IDs refer to `prd.md`.

**Layout rule:** the globe is the page. Panels float over it, never push it. Everything outside the globe is a thin, dark, dense instrument strip.

---

## W1. Main screen (REQ GL-01, HUD-01, HUD-02, HUD-04, SAT-02, FLT-02)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ NETRA  UTC 09:14:07  SAT 2,431  AIR 1,812  QUAKE 14  FIRE 312  ADSB LIVE             │
├──────────────────┬──────────────────────────────────────────────┬────────────────────┤
│ LAYERS           │                                              │ DOSSIER: AIRCRAFT  │
│ [x] Satellites   │          .-'''''''''''''''''-.               │ ------------------ │
│ [x] Aircraft     │       .-'   *SAT    >AIR       '-.           │ AIC101  B788       │
│ [x] Quakes       │     .'          o QUAKE          '.          │ Alt    37,000 ft   │
│ [ ] Fires        │    /     ~~ ground track           \         │ Speed  486 kt      │
│ [x] Night lights │   |           [ + ]                 |        │ Hdg    312 deg     │
│ [ ] Clouds       │    \     ^FIRE                    /          │ V/S    0 fpm       │
│                  │     '.                           .'          │ Squawk 1457        │
│ MODE             │       '-.                     .-'            │ Origin India       │
│ (o) Normal       │          '-.................-'               │                    │
│ ( ) Night-vision │                                              │ [Track] [Fly to]   │
│ ( ) Thermal      │                                              │ [Clear]            │
│                  │                                              │                    │
│ SCAN             │                                              │                    │
│ [ Open iris ]    │   +-------------+                            │                    │
│ radius 250 km    │   | cam preview |  34.12N 77.40E alt 8400 km │                    │
│ CAMERA           │   | hand: PINCH |                            │                    │
│ gestures ON      │   +-------------+                            │                    │
├──────────────────┴──────────────────────────────────────────────┴────────────────────┤
│ EVENT FEED                                                                           │
│ 09:13:58 SQUAWK 7700 VT-ANB 28.5N 77.1E    09:13:41 QUAKE M4.6 Hindu Kush            │
│ 09:13:12 ENTER ZONE ISS Delhi NCR          09:12:30 FIRE +14 in 10 min               │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Regions**
| Region | Content | Behaviour |
|---|---|---|
| Top bar | Name, UTC clock, live counts, feed health badges | Counts tick when data changes. Badges: LIVE / STALE / OFF. |
| Left rail | Layer toggles, visual mode, scan button, camera and gesture status | Collapsible with `[` key. |
| Centre | Globe, reticle, camera preview (bottom-left of globe), cursor coordinates and camera altitude (bottom-centre) | Reticle follows the screen centre. Preview is mirrored, 160x120. |
| Right rail | Dossier of the selected object | Empty state when nothing selected (see W5). |
| Bottom strip | Event feed, newest first, 3 visible lines, expands on click | Click an event to fly to it. |

**Dossier variants**
```
AIRCRAFT                     SATELLITE                    QUAKE
------------------           ------------------           ------------------
AIC101   B788                ISS (ZARYA)                  M 4.6
Alt   37,000 ft              NORAD 25544                  Hindu Kush
Speed 486 kt                 Alt    418 km                Depth 212 km
Hdg   312 deg                Speed  7.66 km/s             09:13:41 UTC
V/S   0 fpm                  Incl   51.6 deg              [Fly to]
Squawk 1457                  Period 92.8 min
[Track] [Fly to] [Clear]     [Ground track] [Next pass]
                             [Fly to] [Clear]
```

---

## W2. Boot sequence (REQ HUD-03, DEM-01)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│                              N E T R A                                               │
│                    earth command center  -  v0.1                                     │
│                                                                                      │
│   [ OK ] backend link ................ 38 ms                                         │
│   [ OK ] satellite catalog ........... 2,431 objects                                 │
│   [ OK ] aircraft feed ............... sampling 12 hubs                              │
│   [ OK ] earthquakes (24 h) .......... 14 events                                     │
│   [ -- ] fire hotspots ............... key not set, layer hidden                     │
│   [ .. ] camera ...................... waiting for permission                        │
│                                                                                      │
│   [##################------]  72 %                                                   │
│                                                                                      │
│                    Press SPACE to skip  -  M for mouse mode                          │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
The boot lines are real checks, not a fake animation. Max 4 seconds. SPACE skips.

---

## W3. Scan mode (REQ SCN-01, SCN-02)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ NETRA  SCAN  center 28.61N 77.21E  radius 250 km        Esc closes the iris          │
├──────────────────┬──────────────────────────────────────────────┬────────────────────┤
│ SETUP            │                                              │ HITS (live)        │
│ Center           │             .-------------.                  │ Aircraft      64   │
│ (o) Reticle      │         .-'   .   |   .    '-.               │ Satellites     3   │
│ ( ) City: Delhi  │        /   .     \|/     .    \              │  >10 deg up        │
│ ( ) Click map    │       |  .  .---(-+-)---.  .   |             │ Quakes         0   │
│                  │       |      .   /|\   .       |             │ Fires          7   │
│ Radius           │        \   .    / | .       .  /             │ ------------------ │
│ [----o-----]     │         '-.   .  sweep   .-'                 │ Nearest aircraft   │
│ 250 km           │            '-------------'                   │ AIC101    42 km    │
│                  │                                              │ Nearest satellite  │
│ Filters          │   rings: 50 / 100 / 250 km                   │ ISS  el 38 deg     │
│ [x] Aircraft     │   the sweep reveals hits as it passes        │                    │
│ [x] Satellites   │                                              │ [Export hits]      │
│ [x] Quakes       │                                              │ [Save as zone]     │
│ [x] Fires        │                                              │                    │
├──────────────────┴──────────────────────────────────────────────┴────────────────────┤
│ 09:14:30 SCAN START zone=Delhi NCR r=250km     09:14:31 HIT AIC101 42 km             │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
Interaction: sweep line rotates once every 4 s. Each object inside the radius gets a reticle the first time the sweep passes it. Radius slider and centre choice update the hit counts live. "Save as zone" turns the circle into a geofence that raises alerts (SCN-02).

---

## W4. Gesture setup (REQ GES-01 to GES-05)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ NETRA  GESTURE SETUP  step 2 of 3                      Esc = use mouse instead       │
├──────────────────┬──────────────────────────────────────────────┬────────────────────┤
│ STEPS            │                                              │ LIVE FEATURES      │
│ 1 Camera   done  │      +------------------------------+        │ palm size    0.21  │
│ 2 Open palm  <   │      |                              |        │ pinch        0.62  │
│ 3 Pinch, fist    │      |        ( open palm )         |        │ fist         0.08  │
│                  │      |       hand overlay here      |        │ hand         RIGHT │
│ TIPS             │      |                              |        │ fps          29    │
│ Good light       │      +------------------------------+        │                    │
│ Plain wall       │                                              │ RECOGNISED         │
│ Hand 40-70 cm    │   Show an open palm and hold for 1 s         │ OPEN PALM  ok      │
│                  │   [########------]  holding 0.6 s            │                    │
│                  │                                              │ [Retry] [Next]     │
├──────────────────┴──────────────────────────────────────────────┴────────────────────┤
│ Camera video stays in this browser tab. Nothing is uploaded or stored.               │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Gesture cheat card (shown after setup, and on `?`)**
```
OPEN PALM + MOVE     rotate the globe
PINCH + MOVE UP/DOWN zoom in / out
TWO-HAND SPREAD      zoom in / out (optional)
FIST, HOLD 0.8 s     fly to the highlighted city or object
THUMBS UP            next visual mode
MOUSE                drag = rotate, wheel = zoom, double-click = fly to
```

---

## W5. States: empty, stale, replay, error (REQ NFR-02, BAK-02)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER BADGES                                                                        │
│   ADSB LIVE (green)   CT STALE 2h14m (amber)   USGS OFF (grey)   FIRMS NO KEY (grey) │
│                                                                                      │
│ BANNERS                                                                              │
│   [!] Aircraft feed unreachable. Showing last data from 09:11 UTC.   [Retry]         │
│   [i] REPLAY MODE - recorded 2026-11-01 14:05 UTC. Not live.         [Go live]       │
│                                                                                      │
│ EMPTY AND ERROR TEXT                                                                 │
│   Nothing in range. Widen the radius or move the reticle.                            │
│   No camera found. Use the mouse: drag to rotate, wheel to zoom.                     │
│   Camera blocked. Allow camera access in the address bar, then press R.              │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
Rule: the screen must never imply data is live when it is not. Replay mode always shows the recording time.

**Dossier empty state**
```
DOSSIER
------------------
Nothing selected.
Click an aircraft or
satellite, or press
F to fly to a city.
```

---

## W6. About and credits (REQ DEM-02)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ABOUT NETRA                                                      [Esc]               │
│                                                                                      │
│   Demonstration project. Public data only. Not an operational system.                │
│   Positions can be delayed, incomplete or sampled. Do not use for safety.            │
│                                                                                      │
│ DATA AND CREDITS                                                                     │
│   Flights      adsb.lol community network (ODbL)                                     │
│   Satellites   CelesTrak GP data, propagated locally with SGP4                       │
│   Imagery      NASA GIBS (Earth Observing System Data and Information System)        │
│   Earthquakes  USGS    Fires  NASA FIRMS    Globe  CesiumJS                          │
│                                                                                      │
│   Built by Arnesh - BCA project - source: github.com/<you>/netra                     │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
NASA GIBS asks for an acknowledgment in this form: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)." Use that exact sentence in the shipped About panel.

---

## Screen flow

```
Boot (W2) -> Gesture setup (W4, skippable) -> Main (W1) <-> Scan (W3)
                                                |-> About (W6)
                                                '-> States overlay (W5) as needed
```

## Open layout decisions (resolve in the Discuss step of Phase 1)
1. Camera preview position: bottom-left of the globe (drawn here) or top-right corner.
2. Event feed: 3 lines always visible, or collapsed to a one-line ticker.
3. Whether the right rail hides when nothing is selected, to show more globe.