# CLAUDE.md

## What this project is
A personal home-training coach for **adjustable dumbbells**, built from scratch as an **installable PWA
for iPhone**, with a Cloudflare backend. openGym (AGPL-3.0) is used as a *reference* for proven domain
logic (progression rules, deloads, e1RM, data model) — not as a fork we keep in sync.

Modules:
1. **Training** — plans, logging, progression (double progression by default), deloads, PRs, e1RM, body weight.
2. **Coach rules** — detect stalled / too-easy / stale exercises and suggest swaps or changes.
3. **AI coach** — weekly review, plan generation and meal ideas via free-tier LLMs, behind a Worker.
4. **Nutrition (simple)** — daily calorie & protein log against a target. Log by picking from
   recents/favourites, a bundled starter list (~100–150 common foods from USDA, with portion sizes and
   Hebrew names), USDA search, custom foods, or quick-add kcal. Barcode scanning / Open Food Facts is a
   later phase, not MVP.
5. **XP** — levels, streaks and badges derived from training data.

The product spec lives in `docs/SPEC.md`; the phased plan in `docs/PLAN.md`. Read them before feature work.
**Neither file exists yet.** They are due in the next two sessions. Until then, ask before inventing product decisions.

## Stack
- Frontend: React + TypeScript + Vite, PWA (service worker, web app manifest, offline-first).
  Hosted on **GitHub Pages**, deployed by a GitHub Actions workflow (`actions/deploy-pages`).
- Data: **Cloudflare D1 is the source of truth.** IndexedDB is a local cache + write outbox: every change
  is saved locally first (instant, works offline), pushed to D1 immediately when online, and the app pulls
  from D1 on every open. Reinstalling / a new phone = log in and everything restores. Show a "last synced"
  indicator, retry failed pushes, and provide a full JSON export.
- Backend: Cloudflare — Workers (API + AI proxy), D1 (database), Workers AI (default LLM). No Cloudflare Pages.
- Tests: Vitest for all domain logic.
- Target device: iPhone, installed to the Home Screen from Safari. No native build (no Mac available).

## Hosting and auth constraints (apply everywhere)
- **Base path.** The site is served from `https://guynuri.github.io/<repo-name>/`, i.e. `/onlyLeveling/`.
  Vite `base`, the manifest `start_url` and `scope`, the service-worker scope and every asset URL must use
  that base path. Never hardcode `/`.
- **Hash routing** (`#/today`, `#/history`). GitHub Pages has no server-side rewrites, so deep links
  must not depend on them. No `BrowserRouter`.
- **Auth is a bearer token** in the `Authorization: Bearer <token>` header. **Never cookies.** Safari blocks
  cross-site cookies between `github.io` and `workers.dev`. The token is stored in the device's local storage
  (IndexedDB `meta`), never in a cookie.
- **Passkeys are out.** GitHub Pages (`github.io`) is a public suffix and cannot bind WebAuthn credentials.
  Sign-in is password-only (PLAN.md, PR #3). SPEC §6.1 still says passkeys; it is not changed here.
- **CORS.** The Worker allows exactly `https://guynuri.github.io` and `http://localhost:5173` (dev). Nothing
  else. It answers `OPTIONS` preflight and lists `Authorization` in `Access-Control-Allow-Headers`. No
  wildcard origin, and no `Access-Control-Allow-Credentials`.
- The frontend and the Worker are on different origins. Never assume a same-origin `/api`.

## Codebase map
<!-- TODO (first session): fill in once the scaffold exists — folder layout, stores, data model,
     how to run, test, lint, build and deploy. Keep it to ~20 lines. -->

## Reference code (openGym)
- A read-only clone lives in `reference/opengym/` (gitignored). Read it to learn how upstream solved
  progression, deloads, e1RM, rest timers and data modelling.
- Porting code from it is allowed — this repo is licensed AGPL-3.0 for that reason. Note ported files
  in `docs/CREDITS.md`.
- **Never copy media from it.** Its exercise animations are © Gym visual and are not licensed to us.

## Golden rules
- **The AI suggests, the rules decide.** The LLM may propose swaps, deloads, extra sets, meal ideas, and
  the first plan's weights, reps and sets. Its output is validated and corrected by deterministic, tested
  code before it is shown (decided in docs/SPEC.md §5). After the first plan, the engine owns progression
  (SPEC §3.3). Calories and macros are always computed by the engine.
- **No secrets in the frontend.** All LLM and USDA calls go through the Worker; keys live in Worker
  secrets. Never commit keys or `.env` files.
- **Provider-agnostic AI.** One OpenAI-compatible client with configurable base URL + model and a fallback
  chain (Workers AI → Gemini → Claude, per SPEC §5.2). Free tiers change; nothing else may depend on a provider.
- **Structured AI I/O.** Send compact summaries (per-exercise trends, not raw logs). Require JSON matching a
  schema; validate; map exercise names to library IDs; reject or retry on mismatch. Cache weekly reviews.
- **Offline first.** Everything except AI and food search works offline. AI degrades to a
  "copy prompt / paste answer" fallback.
- **iOS PWA realities.** Test on a real iPhone in standalone (Home Screen) mode. Push only works when
  installed. Deleting the PWA deletes local data — sync to D1 is the backup, so never let sync silently fail.

## Data sources & licences (must follow)
| Data | Source | Licence | Obligations |
|---|---|---|---|
| Exercise structure (names, muscles, equipment, level, force, mechanic) | yuhonas/free-exercise-db | Unlicense (public domain), **data only** | Its images are treated as unlicensed: never use or commit them. |
| Exercises + images | wger.de API | CC-BY-SA 3 / 4 (per exercise and per image) | Store author + licence per image; show them on screen; share-alike on modified images. |
| Exercises + images | everkinetic/data | CC-BY-SA 4.0 | Credit Everkinetic. Copy images into our storage; never hotlink `img.everkinetic.com`. |
| Exercises with no licensed image | (any) | — | Show text only. Don't fill the gap with free-exercise-db photos. |
| Generic foods | USDA FoodData Central | CC0 | None required; credit recommended. Free API key, via Worker. |
| Packaged foods / barcodes | Open Food Facts | Data ODbL, images CC BY-SA | Attribution on every screen showing OFF data + legal page; share-alike for derived DBs; contribute back. |
| ❌ Do not use | Gym visual media (hasaneyldrm/exercises-dataset images/GIFs, openGym demos) | © Gym visual | Not licensed to us. The dataset's MIT *text* is OK; the media is not. |

- Every exercise record stores `source`, `license`, `author`, `sourceUrl`; a Credits screen lists them.
- Israeli packaged foods are poorly covered by OFF: always offer "create custom food" when a lookup misses.

## Domain rules (defaults — the spec may override)
- Units: kg. Dumbbell min/max/step are user settings; progression must snap to available weights.
- Default progression: double progression over a rep range (e.g. 8–12). All sets at top of range → next
  available weight, reset to bottom of range.
- "Too easy": logged RIR ≥ 3 at top of range for 2 consecutive sessions → suggest a bigger jump or extra set.
- "Stalled": no e1RM improvement over 2 weeks of sessions → suggest deload or swap (SPEC §4).
  "Stale": same exercise 8+ weeks → suggest a variation.
- e1RM: Epley, only from sets of ≤ 12 reps.
- Swaps: same movement pattern + target muscle + available equipment, preferring ones not used recently.
- Nutrition targets: Mifflin-St Jeor × activity factor, adjusted for goal; protein ~1.6–2.2 g/kg;
  weekly calorie adjustment from the 7-day average body-weight trend vs target rate.
- All thresholds live in one config file, not scattered as magic numbers.
- Suggestions are training guidance, not medical advice; keep the UI wording that way.

## Workflow
- Plan before code for anything non-trivial; implement one phase of `docs/PLAN.md` at a time.
- Small, focused commits; one feature per branch/PR.
- Every domain-logic function is pure and covered by tests.
- Run tests + lint + build before calling a task done. Update `docs/PLAN.md` status when a phase finishes.
- When something in the spec is ambiguous, ask — don't invent product decisions.

## Open questions
- Open questions now live in `docs/SPEC.md` §11. The missed-session deload (3 in a row) is decided there.