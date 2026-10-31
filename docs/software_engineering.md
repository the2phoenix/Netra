# NETRA: Software Engineering Standards

Version 1.0 | 2026-10-31
Skills applied: Fullstack Guardian (implementation across the stack), Python Pro, JavaScript Pro, FastAPI Expert, Code Reviewer, Secure Code Guardian, Security Reviewer, DevOps Engineer, Code Documenter, Debugging Wizard, The Fool.

Purpose: keep a 48-hour, AI-assisted, solo build correct, explainable and shippable. These rules are short on purpose. A rule you will not follow in a rush is worse than no rule.

---

## 1. Principles

1. **Explain before merge.** If you cannot explain a module in three sentences, it does not get merged. This is the viva rule and the only rule that cannot be bent.
2. **Thin vertical slices.** Every phase ends with something that runs end to end. Never build all the backend, then all the frontend.
3. **Boring tech, sharp edges only where it shows.** Plain JS modules, plain CSS, FastAPI, Docker Compose. Spend complexity on the pipeline, caching, geometry and gesture engine.
4. **Honest data.** The UI never shows stale, sampled or recorded data as live. This is both a quality rule and an ethics rule.
5. **Fail soft.** An upstream failing, a missing webcam or a bad frame must degrade the app, not break it.
6. **Measure, do not guess.** Performance claims come from the FPS monitor and the stats hook, not from feelings.

## 2. Skills: when to run which

Install in Claude Code (from the repository README):
```
/plugin marketplace add jeffallan/claude-skills
/plugin install fullstack-dev-skills@fullstack-dev-skills
```
The repo also offers `/common-ground` (surfaces hidden assumptions) and a skill called The Fool (stress-tests decisions). The repo's own workflow guide chains skills as: Feature Forge, then Architecture Designer, then Fullstack Guardian with framework skills, then Test Master and Playwright Expert, then Code Reviewer, Security Reviewer, DevOps Engineer.

| Moment | Skill | Example prompt |
|---|---|---|
| Start of a phase | `/common-ground` | "Surface your assumptions about phase 3 before planning." |
| Plan check | The Fool | "Challenge the hub-sampling decision for aircraft." |
| Backend work | FastAPI Expert, Python Pro, API Designer | "Implement `/api/flights` per `trd.md` 4.3 with the stale-while-error cache." |
| Frontend work | JavaScript Pro, Fullstack Guardian | "Build the aircraft layer with a billboard collection per `trd.md` 7." |
| Real-time shape | WebSocket Engineer | Only if ADR-005 is reopened. Not planned. |
| Tests | Test Master, Playwright Expert | "Write unit tests for `geo/haversine.js` from `testing.md` T-GEO-01." |
| Review | Code Reviewer | "Review this diff against section 10 of `software_engineering.md`." |
| Security | Secure Code Guardian, Security Reviewer | "Review `api/` against section 7 checklist." |
| Containers | DevOps Engineer | "Make the compose healthchecks and the multi-stage web build." |
| A bug | Debugging Wizard | "Reproduce first. Here are the logs and the fixture." |
| Docs | Code Documenter | "Write the 3-line explanation for `layers/aircraft.js`." |

Not covered by this repo: UI/UX and wireframing. `ui-ux.md` used the `web-design` and `frontend-design` skills from your own setup instead.

## 3. Git workflow

- One repository. `main` is always runnable.
- Short-lived branches named `phase-<n>-<topic>` (for example `phase-3-aircraft`). GSD also creates its own phase branches and PRs when you use its ship step.
- **Commit per task**, small and atomic. GSD executors already commit atomically, so keep the same habit by hand.
- Conventional commit messages: `feat(aircraft): dead reckoning between polls`, `fix(api): serve stale on 403`, `test(geo): haversine London-Paris`, `docs(explain): sgp4 pipeline`.
- Tag each milestone: `m1-tracer`, `m2-live-world`, `m3-alive`, `m4-hands`, `m5-freeze`. If Sunday night goes badly, you can demo the last tag.
- `git tag demo-ready` after the final rehearsal. Do not touch `main` after that.
- No large binaries in git except the hand-landmark model and recorded fixtures, which are small. Document both.

## 4. Code standards

### Python (api/)
- Python 3.12, type hints on all function signatures, Pydantic models for every request and response shape.
- `ruff check` and `ruff format` clean. Line length 100.
- `async` all the way for I/O. One shared `httpx.AsyncClient` created in the lifespan.
- No global mutable state except the cache object. Pass dependencies in.
- Modules under 250 lines. Functions under 40 lines. If a function needs a comment to explain what it does, split it.
- Names carry units: `alt_ft`, `gs_kt`, `age_s`, `ttl_s`.

### JavaScript (web/)
- ES modules, no globals except the deliberate `window.__netra` test hook.
- JSDoc types on exported functions and `// @ts-check` at the top of each file.
- ESLint and Prettier clean. `const` by default. No `var`.
- **No allocation inside the render loop.** Reuse scratch objects. This is the single most important performance rule.
- Names carry units: `altM`, `gsMps`, `trackDeg`, `dtS`.
- Modules under 250 lines. One concern per module (see `architecture.md` section 2).
- Dependency direction: `ui` and `input` depend on `core`. `layers` depend on `core`, `geo` and `globe`. `geo` depends on nothing. Gestures never import Cesium. Nothing imports `ui` except `main.js`.

### Both
- No commented-out code in commits.
- No TODO without an issue-style note in `docs/debt.md` (what, why, cost to fix).
- Magic numbers become named constants with units, for example `GESTURE_HOLD_MS = 800`.

## 5. Error handling and logging

| Rule | Detail |
|---|---|
| Never swallow errors silently | Log with context or surface a state. `catch {}` is banned. |
| Upstream errors | Caught at the upstream client, converted to a typed `UpstreamError`, handled by the cache layer (stale-while-error). |
| User-facing errors | Plain language with an action (`ui-ux.md` section 8). |
| Logging | Structured logs (JSON or key=value) with level, feed, status, duration. One line per upstream call. No payload bodies. |
| Secrets | Never logged. The FIRMS key is redacted from any URL before logging. |
| Frontend | A small `log.warn/error` wrapper. Errors increment counters shown in the F3 debug overlay. |

## 6. Debugging protocol (Debugging Wizard)
1. Reproduce, ideally with a fixture so it is repeatable.
2. Write a failing test if the bug is in pure logic.
3. Find the cause. Do not patch symptoms.
4. Fix, run the test, add a one-line note to `docs/debt.md` if a shortcut remains.
5. If a bug takes more than 30 minutes, stop, write down what you know, and ask: can the feature be cut or simplified instead?

## 7. Security checklist (run at Phase 3, Phase 6 and Phase 7)

**Backend**
- [ ] Upstream hosts are constants. No URL or host comes from a request.
- [ ] Every query parameter validated (type, range, allowlist). `lat`, `lon`, `dist_nm`, `group`, `window`, `min_mag`.
- [ ] Rate limiter active. Returns 429 when exceeded.
- [ ] No stack traces in responses. Errors use the standard error body.
- [ ] `FIRMS_MAP_KEY` read from the environment only, never returned, never logged, not in the image.
- [ ] Aircraft registration and owner fields dropped unless explicitly enabled.
- [ ] Timeouts on every outbound call. Response size limits where practical.
- [ ] Container runs as a non-root user. `.env` is git-ignored.

**Frontend**
- [ ] No keys or tokens in the bundle (`grep` the `dist/` folder).
- [ ] All text from upstream (place names, callsigns) rendered with `textContent`, never `innerHTML`.
- [ ] No `eval` or dynamic script loading from third-party hosts at runtime. Wasm, model and fonts are local.
- [ ] Camera permission requested only when gestures are enabled. Video never leaves the page.

**Supply chain**
- [ ] Lockfiles committed. `npm audit` and `pip-audit` reviewed. No unmaintained packages.
- [ ] Licences checked and listed (Cesium Apache-2.0, FastAPI MIT, and so on). Data licences in the README: adsb.lol ODbL, GIBS acknowledgment, CelesTrak, USGS, FIRMS.

**Ethics**
- [ ] No owner lookups. No per-person tracking features.
- [ ] About panel states "demonstration, public data only".

## 8. Dependency policy
- Add a dependency only if it saves more than an hour and is widely used. Record why in `docs/debt.md`.
- Pin versions through lockfiles. Do not hand-write version numbers from memory.
- Anything fetched at runtime from a CDN breaks offline mode. Bundle it.

## 9. Working with AI-generated code

The panel will ask what you wrote. These rules protect you.

1. **Prompt with the spec.** Point the AI at `trd.md` and `features.md` sections by number. Vague prompts produce vague code.
2. **Small tasks.** One module or one function per prompt. Review each result before moving on.
3. **Verify library facts.** AI can invent function names. Anything on the Verify list (`trd.md` section 13) gets checked against the real docs or a running snippet before you build on it.
4. **Run it, then read it.** Run the code, then read every line. Add the three-line explanation to `docs/explain/<module>.md`:
   ```
   What it does:
   How it works (the one idea):
   What would break it:
   ```
5. **Do not paste secrets** into prompts. Do not paste the `.env`.
6. **Tests first for pure logic.** Ask for the failing test, then the implementation (this matches GSD's TDD mode).
7. **Own the numbers.** Thresholds in the gesture classifier, cache TTLs and caps are tuned by you on your hardware. Write down what you tried in `docs/tuning.md`.
8. **Keep a "can I explain it" tracker** in `docs/explain/README.md`: module, explained yes/no, date. Aim for all yes by Sunday 20:00.

## 10. Code review checklist (Code Reviewer, applied to every diff)

Correctness
- [ ] Does it do what the acceptance criteria in `features.md` say?
- [ ] Units correct at every boundary (km vs m, deg vs rad, ft vs m)?
- [ ] Failure paths handled (empty array, null, timeout, 403, no camera)?

Design
- [ ] One concern per module? Dependency direction respected?
- [ ] No duplicate logic? Names say what and unit?

Performance
- [ ] No allocation in per-frame code? No `Entity` for bulk data?
- [ ] No work on the main thread that belongs in the worker?

Security and ethics
- [ ] Section 7 items touched by this diff still pass?

Maintainability
- [ ] Tests added or updated? Explanation file written?
- [ ] Constants named? No dead code?

## 11. Definition of done

**Per task:** code runs, tests pass, lint clean, explanation written, committed with a conventional message.
**Per feature:** acceptance criteria in `features.md` pass, works in mouse mode, feed badge behaves, test mapped in `testing.md` is green.
**Per phase:** the success criteria in `gsd.md` are met, the demo script still runs, the phase tag is created.
**Per release (Sunday 23:00):** feature freeze, fixtures recorded, offline mode verified, fallback video recorded, README with credits drafted, security checklist run, `demo-ready` tag.

## 12. Tooling and automation

`Makefile`
```
make dev        # run api and web in watch mode
make test       # pytest + vitest
make e2e        # playwright against fixtures
make lint       # ruff + eslint + prettier --check
make fixtures   # record fixtures from live data
make demo       # docker compose up --build
make demo-off   # OFFLINE_MODE=true docker compose up
```
Pre-commit hook (optional but cheap): ruff, eslint, and the fast unit tests. If it slows you down, run it before each push instead.

CI is optional for Monday. If you add GitHub Actions later, run lint, unit tests and the e2e suite against fixtures (see `testing.md`). Do not run performance tests in CI: headless runners have no real GPU.

## 13. Documentation
- `README.md`: what it is, GIF, one-command start, offline mode, gestures, data credits, limits, licence.
- `docs/explain/`: three-line explanations per module.
- `docs/tuning.md`: thresholds and why.
- `docs/debt.md`: shortcuts taken.
- `docs/` also holds the nine planning files.

## 14. Observability for the demo
- `GET /api/health` and the feed badges tell the truth about the pipeline.
- Press F3 for a debug overlay: FPS, frame time, object counts, worker time, gesture state, last API latencies. It is also a good thing to show a curious panel member.

## 15. Technical debt policy
Debt is allowed during the 48 hours if it is written down in `docs/debt.md` with a cost estimate. Debt in the offline mode, the honesty labels or the security checklist is not allowed.