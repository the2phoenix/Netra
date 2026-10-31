# NETRA: UI and UX Design

Version 1.0 | 2026-10-31
Skills applied: `web-design` (tokens, hierarchy, states, accessibility, dashboard playbook) and `frontend-design` (aesthetic direction, anti-template check). The jeffallan/claude-skills repo has no dedicated UI/UX or wireframe skill, so these two skills from your own setup were used for this file and for `wireframe.md`.

---

## 1. Design brief

**Subject:** a live Earth monitoring room. **Audience:** a college panel and curious viewers, on a laptop and probably a projector. **Job of the screen:** make real, moving data feel observed and under control, then let a hand move through it.

**What it must not feel like:** a generic SaaS dashboard, a game HUD with fake numbers, or a surveillance product. The honest version of "monitoring room" is calm, dark, precise and labelled truthfully.

**Memorable thing (spend boldness in one place):** the **iris**. Scan mode opens like an aperture: the reticle ring becomes an eye, a sweep passes over the globe, and objects light up as it touches them. The name NETRA (eye) and the Rudra universe's third-eye imagery both point here. Everything else stays quiet.

## 2. Direction and anti-template check

| Typical AI-generated "dark dashboard" trait | Our choice instead |
|---|---|
| Near-black plus one neon accent on everything | Black is the void. Colour belongs to data: each layer has its own hue. The ember accent is only for selection and scan. |
| Same rounded card around every block | Panels are flat instrument strips with 2 px corners, separated by hairlines. No card grid. |
| ALL-CAPS tracked eyebrow above every heading | Panel headers are sentence case. Uppercase only for status badges and the wordmark. |
| Monospace for all small labels | Condensed sans for labels. Monospace only for live numbers, because tabular figures stop digits jittering as values change. |
| Fade-and-slide on every element | No entrance animation. One orchestrated moment (boot) and one functional one (scan sweep). |
| Gradient glow decoration | No decorative gradients. The globe is the only luminous thing. |

Check against the brief again after the first build. Remove one thing.

## 3. Tokens

### 3.1 Colour (derived from the subject)
| Token | Hex | Use |
|---|---|---|
| `--void` | `#05070A` | App background, space behind the globe |
| `--panel` | `#0B0F14` at 88% | Panels over the globe (with 8 px backdrop blur) |
| `--line` | `#1B2430` | Hairlines, borders |
| `--text-hi` | `#E6EDF3` | Primary text, numbers |
| `--text-mid` | `#8B98A8` | Secondary text and labels (6.5:1 on `--panel`) |
| `--text-lo` | `#5A6675` | Disabled and decorative only (3.3:1, never for essential text) |
| `--ember` | `#FF6A1A` | Selection ring, reticle, primary button, scan iris (6.7:1 on `--panel`) |
| `--sat` | `#35D0E8` | Satellites |
| `--air` | `#FFB43B` | Aircraft |
| `--quake` | `#FF6A1A` | Earthquake ripples (shares the ember hue on purpose: "something happened here") |
| `--fire` | `#FF3B30` | Fire hotspots |
| `--alert` | `#FF3B30` | Alerts and errors |
| `--live` | `#3DDC84` | LIVE badge |
| `--stale` | `#FFB020` | STALE badge |
| `--off` | `#6B7685` | OFF badge |

Contrast ratios were computed for text colours on `#0B0F14`. Re-check any new pair. Colour is never the only signal: layers also differ by shape (see 3.4) and badges carry words.

### 3.2 Type
| Role | Face | Notes |
|---|---|---|
| Labels, headers, buttons | Saira Condensed | Squared, condensed, instrument feel. Weights 400, 500, 600. Sentence case. |
| Live numbers, coordinates, clock | JetBrains Mono (tabular figures) | Only for changing values |
| Wordmark | Noto Sans Devanagari 700 for "नेत्र", with "NETRA" in Saira Condensed 600 | Small nod to the project's roots |

Install through `@fontsource` packages so fonts work offline. Scale (px): 12, 14, 16, 20, 28. Minimum 14 px for anything the panel must read on a projector. Line height 1.4 for labels, 1.2 for numbers.

### 3.3 Space, shape, elevation
- 8-point scale: 4, 8, 16, 24, 32. Panel padding 16. Rail width 264 (left) and 288 (right).
- Corners: panels 2 px, buttons 4 px, badges 0 px. No pill shapes except the performance chip.
- Elevation: none. Separation by hairlines and the blurred panel over the globe.
- Motion tokens: `--dur-fast: 120ms`, `--dur-base: 240ms`, `--ease-out: cubic-bezier(.2,.8,.2,1)`.

### 3.4 Data marks (one system, redundant encoding)
| Layer | Shape | Colour | Size |
|---|---|---|---|
| Satellites | Small circle (point) | `--sat` | 3 px, 6 px when selected |
| Aircraft | Chevron pointing along heading | `--air` | 14 px sprite |
| Earthquakes | Expanding ring | `--quake` | Radius by magnitude |
| Fires | Small square | `--fire` | 3 px |
| Selected | Ring plus crosshair ticks | `--ember` | 24 px |
| Alert | Pulsing ring | `--alert` | 28 px, 2 s period |

A legend sits in the layer panel: swatch, shape and name.

## 4. Layout and hierarchy

See `wireframe.md` W1. Hierarchy from strongest to weakest:
1. The globe (full bleed, always the focus).
2. The selected object's dossier (right rail, appears on selection).
3. The top-bar counts and feed badges (small, steady).
4. The event feed (quiet unless something new arrives).
5. Layer panel and settings (left rail, quiet).

The panel is quieted, not shouted over: text is `--text-mid` by default, `--text-hi` only for values the viewer is meant to read. One focal point per moment.

**Projector mode (toggle, key `P`):** dark interfaces wash out on projectors. Raises panel opacity to 96%, lifts `--text-mid` to `#A7B3C2`, thickens hairlines to 2 px, bumps the minimum text size to 16 px, and brightens the globe's night side slightly. Test at 1366x768.

## 5. Components and states

Every interactive element has: default, hover, keyboard focus (2 px `--ember` outline with 2 px offset), active, disabled, loading, error where relevant.

| Component | Notes |
|---|---|
| Top-bar badge | Text plus colour. `ADSB live`, `CT stale 2h14m`, `USGS off`. Click opens feed detail (last success, last error). |
| Layer toggle | Checkbox with swatch and shape. Count on the right when on. |
| Mode selector | Radio group: Normal, Night-vision, Thermal. |
| Dossier | Key-value list, copy-on-click values, actions at the bottom. Empty state per `wireframe.md`. |
| Event feed row | Time (mono), icon, text. Click flies to it. New rows slide in once (120 ms) and are announced to assistive tech. |
| Scan controls | Radius slider with numeric field. Centre radio group. |
| Primary button | Ember fill, dark text. Only one primary per screen state. |
| Secondary button | Hairline border, `--text-hi` text. |
| Banner | Full-width strip under the top bar. Amber for stale, red for failure, blue-grey for replay. Always has an action. |
| Tooltip | Appears on hover and on focus. Used for shortcuts. |
| Performance chip | Appears only when performance mode is active. |

## 6. Interaction design

### 6.1 Selection
Click or press Enter on a highlighted object. A ring locks on, the dossier opens, the feed logs "Selected". Click empty space or press Esc to clear.

### 6.2 Scan (the signature moment)
1. Press `S` or the Open iris button. The reticle ring animates into the iris (240 ms).
2. A sweep line rotates once per 4 s. Objects get a reticle and a short tick sound only if sound is on (default off).
3. Hits update live. Esc closes the iris (240 ms).
Reduced motion: no animation, a static ring with hits listed.

### 6.3 Boot (the one choreographed moment)
Real health-check lines type in (max 4 s, space skips). Then the globe fades up from black, the camera eases from deep space to the home view over 2.5 s. Reduced motion: skip straight to the home view.

### 6.4 Visual modes
Night-vision: green monochrome tint, light bloom, fine grain. Thermal: false-colour ramp on luminance. Both are camera post-process stages and apply to the globe only, not to the panels, so text stays readable.

## 7. Gesture UX

**Principles**
- Relative control: moving the hand changes the globe, regardless of where the hand is in the frame.
- Immediate feedback: the reticle changes with the recognised gesture.
- Forgiving: a dead zone, short holds before activation, and lost-tracking grace of 300 ms.
- Always escapable: mouse works at all times and takes over instantly.

| Gesture | Reticle feedback | Camera result |
|---|---|---|
| Open palm, moving | Open ring, arrows at the edges | Globe rotates |
| Pinch, moving up or down | Closed ring, plus and minus marks | Zoom in or out |
| Fist, held | Ring fills clockwise over 0.8 s | Fly to nearest target |
| Thumbs up | Flash of the new mode name | Next visual mode |
| No hand | Dim ring | Nothing |

**Camera preview:** mirrored, 160x120, bottom-left of the globe, landmarks drawn in `--ember`, toggle with `C`. Text under it says what is recognised.

**Fatigue:** holding an arm up tires people within a minute or two. Keep motions small and relative, let the presenter rest an elbow on the table, and design the demo script (`features.md`) so gestures come in short bursts.

**Privacy line, always visible in setup:** "Camera video stays in this browser tab. Nothing is uploaded or stored."

## 8. Content and microcopy

Rules (from the frontend-design writing guidance): sentence case, plain verbs, active voice, name things by what the user does, errors say what happened and what to do.

| Situation | Copy |
|---|---|
| Stale feed | "Aircraft feed unreachable. Showing last data from 09:11 UTC." Action: Retry |
| Replay | "Replay. Recorded 2026-11-01 14:05 UTC. Not live." Action: Go live |
| No camera | "No camera found. Use the mouse: drag to rotate, wheel to zoom." |
| Camera blocked | "Camera blocked. Allow camera access in the address bar, then press R." |
| Empty scan | "Nothing in range. Widen the radius or move the reticle." |
| Sampled data | "AIR 1,812 sampled" (tooltip: "Busy regions only. Free community data, not every aircraft.") |
| Alert | "Squawk 7700 (general emergency): VT-ANB, 28.5N 77.1E" |
| About | "Demonstration project. Public data only. Not an operational system." |

Button labels name the action: Track, Fly to, Clear, Open iris, Save as zone, Export hits. The same action keeps the same word everywhere.

## 9. Accessibility and quality floor

- **Contrast:** text at least 4.5:1, large text and UI parts at least 3:1 against the panel. `--text-lo` is not used for essential text.
- **Keyboard:** every control reachable. `Tab` order follows the layout. Shortcuts: `S` scan, `L` layers, `F` fly to city search, `C` camera preview, `M` mouse mode, `P` projector mode, `[` collapse left rail, `?` help, `Esc` clear or close.
- **Focus:** visible 2 px ember outline everywhere.
- **Screen readers:** the globe canvas has an `aria-label`. The event feed is an `aria-live="polite"` region. Dossier values are real text. Badges are text.
- **Reduced motion:** honour `prefers-reduced-motion`: no boot animation, no sweep, fly-to duration 0.
- **Touch targets:** 44 px minimum for any button (the app is desktop-first, but a touchscreen projector is plausible).
- **Colour independence:** shapes and words back up colour (3.4).

## 10. Performance and the UI

- Panels use `backdrop-filter` blur. It is costly over a busy WebGL canvas. Measure; if FPS drops, switch to a solid `--panel` fill (the performance chip does this).
- No layout thrash: the top bar and dossier update through batched text changes at most 4 times per second.
- Fonts subset to Latin plus the Devanagari wordmark glyphs.

## 11. Pre-ship design checklist (from `web-design`)

1. Does the first screen pass the grunt test: what is this, how does it help me, what do I do? (Globe, labelled layers, "Open iris".)
2. One primary action per state?
3. Hierarchy by size, weight and space, not colour alone?
4. 8-point spacing and alignment lines obeyed?
5. Body at least 14 px (16 px in projector mode)?
6. Contrast passes? Meaning never colour only?
7. Hover, focus, active, disabled, loading and error states exist for every control?
8. Empty, loading, stale and error states designed (see `wireframe.md` W5)?
9. Keyboard and reduced-motion paths tested?
10. Does it look like a choice for this subject? Remove one thing.

## 12. Open design decisions
1. Name: NETRA or Trinetra.
2. Camera preview placement (bottom-left or top-right).
3. Whether a soft sound cue plays on scan hits (default off).
4. Whether to include a Devanagari wordmark in the boot screen only, or in the top bar too.