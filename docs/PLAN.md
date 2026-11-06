# onlyLeveling: Phased Implementation Plan

Status: **draft v1 for review.** Source of truth for scope: `docs/SPEC.md` (draft v1). Reference
logic: `docs/REFERENCE_NOTES.md`. Data sources: `docs/DATA_SOURCES.md`. Rules: `CLAUDE.md`.

Each phase is **one PR**. Every phase lists: goal, files, data model and migrations, tests, acceptance
criteria (from SPEC §10 unless noted), risks. Status is updated here when a phase merges.

## 0. Decisions this plan makes (please confirm)

These are places where the spec and the request differ, or where I picked a default. Each is reversible.

| # | Topic | What this plan does | Why |
|---|---|---|---|
| D1 | **Nutrition timing** | Moved **out of Wave 2** to *Later / Phase 3* (blueprint only, §8). | SPEC §1 and §9 put nutrition in a later phase. Your rule was "unless the spec changes the order". The spec does. |
| D2 | **Weekly AI review timing** | Removed from Phase 7. Phase 7 = AI client + **first-plan proposal** only. Weekly review = SPEC Phase 2, after Phase 5. | SPEC §5.1 and §9 say weekly review is later. |
| D3 | **Onboarding** | Assigned to Phase 7 (it is the only entry to the first AI plan). | No phase in your list owns it; SPEC §8.2 lists it as key screen 1. |
| D4 | **Push notifications** | **Confirmed (PR #3): stays in Wave 2 as Phase 9**, after Phase 4, as the spec has it. | SPEC §6.4 and §10 require it for MVP, but it is not in your list. |
| D5 | **Settings UI** | Core settings in Phase 3 (dumbbells, rest, days, units, bodyweight). Remaining settings (theme, invite codes, export, password, credits) in Phase 4 and 2. | Needed as data before plans work. |
| D6 | **Coach rules = MVP** | Phase 5 is MVP, as in SPEC §9. | Confirmed by SPEC. |
| D7 | **Phase 3 and Phase 4 size** | Each is large. I recommend splitting each into two PRs (3a domain, 3b UI; 4a sync and D1 data, 4b password sign-in, invites and recovery). Still one phase each. | Reviewability on a phone-first codebase. Say if you want one PR each. |
| D8 | **CLAUDE.md golden rule** | Out of this PR. Still says the engine sets all numbers. SPEC §5.4 says the AI returns weights, reps, sets for the first plan. Must be updated before Phase 7 merges (SPEC §5.4 says so). | Conflict in source docs. |
| D9 | **Kettlebells** | Excluded from plans and swaps. `BELL_EQ` port kept for the unit model only. | SPEC §1 says dumbbells only. REFERENCE_NOTES §8 mentions kettlebells via `BELL_EQ`. |
| D10 | **Compound vs isolation** | Derived from free-exercise-db `mechanic` field (`compound` / `isolation`); unset = isolation range. | SPEC §3.1 gives the table; this is the mapping. |

**Source-doc drift to fix at the start:** the local `main` checkout is behind `origin/main`. It lacks
`docs/SPEC.md`. This plan was written against `origin/main` (c9560a9). Phase 1 must start from it.

## 1. Global constraints (apply to every phase)

- Dumbbells only. Units kg. English only, 16 px phone gutter, no horizontal page scroll.
- Derived numbers (progression, e1RM, XP, ranks, deloads) come from pure, tested functions. Thresholds
  live only in `src/config/thresholds.ts`. No magic numbers elsewhere.
- No secrets in the frontend. Keys are Worker secrets.
- Every exercise record stores `source`, `license`, `author`, `sourceUrl`. Never hotlink GitHub. Never copy
  Gym visual media (openGym `catalogue/media/`).
- Every user-visible suggestion says "suggestion" and carries the footer *Training guidance, not medical
  advice.* No "e1RM", "RIR", "Epley", "stall", "deload" in UI copy (SPEC §4.2).
- Sync never fails silently. Local write first, always.
- Every Worker query is scoped by the authenticated `userId`.
- Each phase ends with: test + lint + typecheck + build green in CI; PLAN.md status updated.
- Ported files get a row in `docs/CREDITS.md`. Porting source: `reference/opengym/` in the primary checkout
  (gitignored; worktrees do not have it, so read it from the primary checkout or re-clone).

## 2. Stack and tooling (set in Phase 1)

- Vite, React, TypeScript (strict), `vite-plugin-pwa` (service worker, manifest).
- Vitest for all domain logic. ESLint (typescript-eslint, react-hooks). Prettier optional.
- `idb` (tiny IndexedDB wrapper). Do not hand-roll the IDB API.
- Worker: Wrangler; D1; `@cloudflare/vitest-pool-workers` for Worker tests (Phase 4).
- Password hashing: Web Crypto PBKDF2 or scrypt, no auth library (Phase 4). No passkeys (decided, PR #3).
- CI: GitHub Actions. Node version pinned in `.nvmrc` and `engines`.

---

# WAVE 1: foundation (strictly sequential)

Order: 1 → 2 → 3 → 4 → **Contracts freeze (PR C)**. Each phase must merge before the next starts.

## Phase 1: Scaffold, IndexedDB cache and outbox, CI, Pages deploy, installable

**Goal.** An installable PWA shell with an offline-capable local store and a finished outbox API (no remote
yet). CI gates every PR. Deploys the frontend to GitHub Pages (decided, PR #3). **Frontend only:** no Worker,
no D1, no Cloudflare resources in this phase. Those arrive in Phase 4.

**Hosting constraints (CLAUDE.md "Hosting and auth constraints").** Vite `base` = `/onlyLeveling/`; manifest
`start_url` and `scope` and the service-worker scope use the same base; hash routing only (no `BrowserRouter`).

**Files (create).**
- `package.json`, `tsconfig.json`, `vite.config.ts` (with `vite-plugin-pwa`), `vitest.config.ts`,
  `eslint.config.js`, `.nvmrc`, `.gitignore` (add `.env*`, `.dev.vars`, `reference/`).
- `index.html`, `public/manifest.webmanifest`, `public/icons/` (180, 192, 512 px, plus maskable).
- `src/main.tsx`, `src/App.tsx` (shell: bottom nav with placeholder tabs, "last synced: never" indicator).
- `src/db/idb.ts`: opens the IndexedDB database; schema version 1 (see below); typed store helpers.
- `src/data/outbox.ts`: `enqueue(op)`, `peek()`, `ack(id)`, `fail(id, error)`, backoff math (pure).
- `src/modules/registry.ts`: module registration. See §3.
- `src/config/thresholds.ts`: one section per module, empty for now, with a `// ponytail:` note if needed.
- `.github/workflows/ci.yml`: on every PR, install, test, lint, typecheck, build.
- `.github/workflows/deploy.yml`: on push to `main`, build and publish `dist` with GitHub Pages (`actions/deploy-pages`).

**Data model and migrations.**
- No D1 yet. IndexedDB v1 stores: `meta` (key/value: `lastSyncedAt`), `outbox` (`{id, op, payload, createdAt,
  attempts, lastError, nextTryAt}`).
- Phase 3 bumps the IDB version to 2 and creates **all** stores later waves need, empty (see §3.3). Phase 1
  does not create them.

**Tests (Vitest).**
- Outbox: FIFO order; `ack` removes only that item; `fail` increments attempts and sets `nextTryAt`;
  backoff is capped; a failed item is never dropped.
- Registry: a module with a duplicate id throws; registration order is stable.

**Acceptance.**
- Installs to the iPhone Home Screen from Safari. Opens in standalone mode with the correct icon and name.
- Offline: after one load, the app shell opens with no network.
- CI: a PR runs test, lint, typecheck and build. A failing test blocks merge (branch protection: user action).
- Pages deploy runs on `main`. The deployed app loads from `https://guynuri.github.io/onlyLeveling/` with no
  404 on assets, and a hash deep link (`#/history`) opens after a reload.
- Manifest `start_url` and `scope` are `/onlyLeveling/`; the service worker is registered under that scope.

**Risks.**
- iOS PWA behaviour needs a real iPhone. The dev machine is Windows, no Mac. Manual check in standalone mode is
  required before the phase is called done.
- GitHub Pages must be enabled for the repo (Settings → Pages, source: GitHub Actions). **User action.** See the
  manual steps below.
- Service worker caching can serve a stale build. Use `registerType: 'prompt'` or autoUpdate, and say which.
- **Manual steps for the user (Phase 1):**
  1. Repo Settings → Pages → Source: **GitHub Actions**.
  2. Repo Settings → Branches: protect `main`, require the CI check (test, lint, typecheck, build).
  3. Confirm the Pages URL is `https://guynuri.github.io/onlyLeveling/`. If the repo name differs, tell Claude
     first: `base`, manifest scope and the CORS origin in Phase 4 all depend on it.
  4. On a real iPhone: Safari → Share → Add to Home Screen, then open it in standalone mode (manual check).
  No Cloudflare secrets are needed in Phase 1. The `CLOUDFLARE_*` secrets are only needed when the Phase 4
  Worker deploy workflow is added.

---

## Phase 2: Exercise library import (free-exercise-db, text only), credits

**Goal.** A bundled exercise catalogue with licence fields, an exercise detail screen, a dumbbell-compatible
filter, and a Credits screen. Movement pattern labels derived where possible. No images in v1 (see Risks).

**Files (create).**
- `scripts/import-exercises.ts`: one-off script. Reads free-exercise-db JSON and writes `src/data/exercises.json`
  (committed). Copies no images (DATA_SOURCES §1: free-exercise-db images are unlicensed). Not run in the browser.
- `src/domain/exercise.ts`: `Exercise` type (SPEC §7); `isDumbbellCompatible(ex)` (equipment `dumbbell` or
  `body only`, D9); `movementPattern(ex)` returns `push | pull | static | unknown`. `known` means any value other
  than `unknown`. Unknown is returned when `force`/`mechanic` cannot decide; squat vs hinge is never derived.
  Source of the labelling rule: SPEC §11 item 7 (decided, derive from free-exercise-db fields).
- `src/data/exercises.ts`: read API (`listExercises()`, `getExercise(id)`), no direct import of JSON from modules.
- `src/modules/library/` (`register.ts`, `ExerciseList.tsx`, `ExerciseDetail.tsx`, `CreditsScreen.tsx`).
- `docs/CREDITS.md`: append the free-exercise-db entry (Unlicense, data only) and the data-import note.

**Data model and migrations.**
- Static bundle, not in D1. User-created exercises come later (SPEC §8.3 mentions custom).
- Fields per SPEC §7 Exercise: `id, name, aliases[], equipment, force, mechanic, level, category,
  primaryMuscles[], secondaryMuscles[], movementPattern, instructions[], source, textSource, license,
  author, sourceUrl`. No `images[]` in v1.
- `source`: `'free-exercise-db'`. `license`: `'Unlicense'`.

**Tests.**
- Import on a 3-exercise fixture: fields mapped, licence fields set on every record, no image fields written.
- `isDumbbellCompatible`: table test, with barbell, machine and kettlebell rows rejected.
- `movementPattern`: table test, with unknown returned for ambiguous rows. Never returns `squat` or `hinge`.
- Guard test: no `https://raw.githubusercontent.com` or other hotlink in the bundle or source.
- CI guard: fail if `public/exercises/` exists or any exercise record has a non-empty `images` field.

**Acceptance (SPEC §8.3, §10).**
- Every exercise shows its source, licence and author. The Credits screen lists each source's licence
  (free-exercise-db: Unlicense, data only).
- No image is shipped or hotlinked from free-exercise-db. No Gym visual media file exists in the repo
  (grep check in CI).

**Risks.**
- free-exercise-db muscle and category fields are inconsistent. Unknown mapping must be visible, not guessed.
- Exercise images are deferred. Licensed images (wger or Everkinetic, CC-BY-SA, credited) come in a later
  import phase with their own size budget.
- Pattern labels are weak (SPEC §11 item 7). Swaps (Phase 5) only use `known` patterns.

---

## Phase 3: Settings, plans, workout logging, double progression

**Goal.** Local-first training core: settings (dumbbells, rest, days, units, bodyweight), a plan builder with a
rules-based template, one-handed logging with rest timer, double progression, e1RM, PRs, history. No network.

**Ported from openGym (CREDITS rows required).**
- `frontend/src/lib/dumbbells.js` → `src/domain/dumbbells.ts`: `ownedUp`, `ownedDown`, `stepOwned` (double jump
  = two bells), `bellsIn` (one arm = 1 bell, else 2), `isOneArm`, `dbLoad` `as | each | total`. Unit test.
- `frontend/src/lib/onerm.js` → `src/domain/onerm.ts`: Epley only, null above 12 reps, `is1RMRecord` against
  history excluding the current session. Drop the formula blend and the 15-rep cap.
- `frontend/src/lib/progression.js` → `src/domain/progression.ts`: pure `nextPrescription(history, config,
  routine)`, `readSession` (hit = done at ≥ target reps; only first N planned sets decide). Double policy only.
  Stall/deload code is **not** here (Phase 5).
- `frontend/src/sheets.jsx` PR logic (~4092) → `src/domain/prs.ts` (pure). Rewrite, not port of UI.
- `frontend/src/store/useUI.js` rest timer → `src/modules/training/rest-timer.ts`: rewrite from the
  `endsAt` idea. Starting a rest abandons any running hold. `restSec = 0` means off.

**Files (create).**
- `src/domain/{dumbbells,onerm,progression,prs,session,template}.ts`: `session.ts` builds the finished
  workout record and stamps `planned` and `dbLoad`. `template.ts`: rules-based plan from settings (days,
  length, exclusions, owned dumbbells, known patterns). Used again as the AI fallback in Phase 7.
- `src/config/thresholds.ts`: `training` section: `restSec: 90`, `restPauseSec: 15`, double-progression
  defaults, rep ranges (compound 6–10, isolation 10–15, calves and core 10–20).
- `src/data/repo.ts`: the module-facing API (§3.2). `src/data/idb-repo.ts`: local implementation.
- `src/modules/training/`: `register.ts`, `PlanScreen.tsx`, `WorkoutScreen.tsx` (one-handed, big buttons,
  pre-filled values, rest timer front and centre), `HistoryScreen.tsx`, `SettingsScreen.tsx` (core settings
  per D5), `BodyweightLog.tsx`.

**Data model and migrations.**
- IndexedDB v2 (upgrade from v1): stores `settings` (single record), `plans`, `workouts`, `bodyweight`
  (`{date, kg}`). Also create **empty** stores reserved for later waves: `suggestions` (Phase 5), `badges`
  (Phase 6), `aiCache` (Phase 7). Creating them now means later phases need no IDB version bump (§3.3).
- Shapes follow SPEC §7: `Workout { id, userId, routineIds[], start, end, entries[], prs[],
  excludeFromProgression? }`, `Entry { id, sets[], planned, note? }`, `SetRow { w, r, done, rir?, phase, at }`.
  Drop openGym's drop-set, rest-pause, per-side and warm-up fields (not in SPEC v1).
- `userId`: a fixed local id until Phase 4 (`'local'`). Phase 4 maps it.
- No D1 migration in this phase.

**Tests (Vitest; this is the domain-test-heavy phase).**
- Dumbbells: next and previous owned bell; double jump = two bells up; one-arm = 1 bell; result never off the
  owned list; `as / each / total` changes the volume count correctly.
- e1RM: 12 reps returns a value; 13 returns null; uses `w` and `r`, never `topW`.
- Progression: all working sets at top of range → weight to next owned bell, reps to bottom. Partial → reps
  only, weight unchanged. Extra sets beyond plan never move weight. Editing a logged set changes the next
  target with no drift (recompute from history, same answer). Output weight is always owned.
- Session judging: a set below target reps is a miss.
- PRs: current session excluded from history; new PR only when strictly beats.
- Rest timer (fake clock): `endsAt` math; backgrounded catch-up ends the rest; starting a rest abandons a hold;
  `restSec = 0` never starts.
- Template: day count equals days-per-week; excludes avoided exercises; never picks non-dumbbell equipment.

**Acceptance (SPEC §10).**
- A set logs in three taps or fewer, with pre-filled values.
- Progression with owned weights picks the next owned bell, never an off-list weight.
- Changing a logged set changes the next target with no drift.
- Extra sets beyond the plan never move the weight.
- e1RM is null above 12 reps and present for 12 and below.
- Plan day count equals the days-per-week setting. No plan contains an excluded exercise or non-dumbbell
  equipment.
- Onboarding is **not** here (Phase 7). Phase 3 uses the Settings screen to set the owned list and days.

**Risks.**
- Largest phase. Split recommended (D7): 3a domain (`src/domain/**` + tests, no UI), 3b screens.
- Phase 3 bumps IndexedDB to v2: add `blocked`/`blocking` handlers in `openAppDb` (src/db/idb.ts), and type the
  database handle with a schema generic instead of `IDBPDatabase` plus casts (PR #5 review).
- Progression defaults come from coaching guides, not trials (SPEC §3.3). Tune with real logs.
- Compound/isolation split is judgment (SPEC §11 item 1). Revisit after logs exist.
- One-handed logging and rest timers need a real-iPhone test: iOS suspends backgrounded pages.
- The Plan screen is where users edit exercises. Keep the rules as the only writer of numbers.

---

## Phase 4: Worker, D1, sync and auth

**Goal.** Cloudflare D1 becomes the source of truth. Outbox pushes on change. App pulls on open. Password
sign-in (no passkeys, decided in PR #3). Invite-only sign-up with recovery. Full JSON export. Scoped by `userId`.

**Recommended split (D7).** 4a: Worker, D1 schema, sync (push/pull), last-synced, export, with sign-in by
one bootstrap account. 4b: password sign-in, invite codes, recovery, rate limit. Both still one phase.

**Files (create).**
- `worker/src/index.ts`: router. Each module's routes come from a reserved slot (§3.4).
- `worker/src/sync.ts`: `POST /api/sync/push` (idempotent per op id), `GET /api/sync/pull?since=`.
- `worker/src/auth/password.ts` (4b, PBKDF2 or scrypt via Web Crypto),
  `worker/src/auth/invites.ts` (4b: codes stored as hashes, ≥128-bit random, single-use, IP rate limit).
- `worker/src/export.ts`: `GET /api/export` (full account JSON).
- `worker/migrations/0001_core.sql`: all Wave 1 tables (§4).
- `wrangler.toml`: D1 binding (`DB`), Worker route. Secrets set by user, never committed.
- `src/data/sync.ts`: flush outbox with backoff; pull on open; `lastSyncedAt` in `meta`.
- `src/data/remote-repo.ts`: the same module-facing API, backed by the Worker.
- `src/modules/account/`: sign-in, sign-up (invite), recovery, invite-code management, export button,
  last-synced indicator, Credits link.

**Data model and migrations.**
- D1 `0001_core.sql` mirrors SPEC §7 plus: `users`, `passwords` (hash only), `invites` (`code_hash`,
  `issued_by`, `used_by`, `used_at`), `sessions`, `ops_applied` (idempotency: op id → applied).
- Conflicts: **last write wins per workout session.** Push replaces the whole session row (`updated_at` set by
  the client; server keeps latest). Spec §6.2.
- Client IDB stores (v2) already exist from Phase 3. `userId` now comes from the session, not `'local'`.
- Local data kept on first sync: the client uploads local-only data once (migration of `'local'` rows).

**Tests.**
- Worker (Vitest pool for Workers with a local D1): **two accounts**; A cannot read B's workouts or settings
  (SPEC §10). Push is idempotent (same op id twice = one row). LWW: later write wins, earlier does not resurrect.
- Transport: a request without `Authorization: Bearer` gets 401; a response never sets a cookie; CORS echoes
  only `https://guynuri.github.io` and `http://localhost:5173` (other origins get no `Access-Control-Allow-Origin`);
  `OPTIONS` preflight allows the `Authorization` header.
- Invite: a used code is rejected; codes are not stored in plain text; redemption rate limit per IP.
- Export: row counts per table match account counts (automated in test; manual check in v1 per SPEC §10).
- Client sync (fake fetch): a failed push keeps the item in the outbox, retries with backoff, never drops it,
  and sets the visible error state.
- Recovery: password path works; invite path works when password is forgotten; no path when all codes are lost
  (accepted, SPEC §6.1, tested as documented behaviour).

**Acceptance (SPEC §10).**
- A new user cannot register without a valid, unused invite code.
- A user cannot read another user's workouts or settings (two accounts).
- Password sign-in works on iPhone Safari in standalone mode (manual).
- Offline logging works; the record appears in D1 after reconnect.
- A failed push shows an error and retries; it never disappears silently.
- Last-synced time updates after each successful sync.
- JSON export contains every record of the account.

**Risks.**
- **Hosting and sign-in decided (PR #3): GitHub Pages, password-only.** GitHub Pages cannot bind passkeys
  (github.io is a public suffix). CLAUDE.md now matches (Cloudflare Pages removed). SPEC §6.1, §7, §8 and §10
  still require passkeys and must be updated before Phase 4 merges. See `docs/SPEC.md` open items list.
- **Auth transport: bearer token only.** The Worker reads `Authorization: Bearer <token>`. No `Set-Cookie`, no
  cookie-based session. CORS allows exactly `https://guynuri.github.io` and `http://localhost:5173`.
  Cross-origin cookies from `github.io` to `workers.dev` are blocked by Safari.
- Bootstrap: the first user needs a seed invite created by a script with a Worker secret. Document it.
- Phase is large (D7). Auth and sync can fail independently; ship 4a first.
- D1 write limits and cold starts: batch pushes per session, not per set.
- Last write wins per session loses the earlier device's sets when one session is edited on two devices.
  Accepted by the user (PR #3, §5 item 12). Revisit if it bites.
- Lost password plus lost invite codes = no recovery (accepted in SPEC §6.1). Tell the user in
  the UI, and in the Phase 4 PR description.

---

## Contracts freeze (PR C, end of Wave 1, before Wave 2 starts)

Small PR. Nothing new in behaviour. It locks what Wave 2 depends on.

**Contents.**
1. `src/domain/types.ts`: all shared domain types (SPEC §7). Frozen. Changes after this need a PR touching
   the contract owner (the Wave 1 maintainer) and a note here.
2. `src/data/repo.ts`: module-facing API (§3.2), frozen.
3. `src/modules/registry.ts`: per-module registration (§3.1), with Wave 2 slots reserved and empty.
4. `src/config/thresholds.ts`: one section per Wave 2 module, with the SPEC default values. Each Wave 2 module
   edits only its own section.
5. `worker/src/routes/index.ts`: reserved slots for `coach`, `xp`, `ai`, `push`, `nutrition`. Each slot is a
   one-line import, so Wave 2 adds only its own file.
6. §3.5 ownership table filled in and checked against the actual tree.
7. This PLAN.md: all Wave 1 statuses set to `merged`, Wave 2 statuses to `not started`.

**Acceptance.** No Wave 2 phase needs to edit a Wave 1 file except the lines listed in §3.5. A dry run:
an empty `src/modules/coach/register.ts` (stub) is added and CI is green with no other change.

---

# Shared contracts (defined at the freeze; referenced by Wave 2)

## 3.1 Module registration

Each module has one file `src/modules/<name>/register.ts` that default-exports a `ModuleDef`:
`{ id, routes: [{path, component}], nav?: {label, icon, path, order}, settings?: [{section, component}],
homeCards?: [{component, order}] }`.

`src/modules/registry.ts` discovers these with `import.meta.glob('./*/register.ts', { eager: true })`. Result:
**no module edits a shared file to be registered.** Duplicate `id` throws at startup (tested).

## 3.2 Module-facing data API (`src/data/repo.ts`)

Modules call this only. They never import `idb` or the Worker client.

- Settings: `getSettings(): Promise<Settings>`, `saveSettings(patch: Partial<Settings>): Promise<void>`
- Exercises (read-only): `listExercises(): Promise<Exercise[]>`, `getExercise(id): Promise<Exercise | undefined>`
- Plans: `listPlans()`, `savePlan(plan: Plan)`, `deletePlan(id)`
- Workouts: `saveWorkout(w: Workout)` (whole-session upsert), `listWorkouts(range?: {from, to}): Promise<Workout[]>`
- Bodyweight: `addBodyweight(kg, date)`, `listBodyweight(range?)`
- Suggestions (Phase 5): `saveSuggestion(s)`, `listSuggestions({status?})`, `setSuggestionStatus(id, status, until?)`
- Badges (Phase 6): `awardBadge(badgeKey): Promise<boolean>` (true only on first award), `listBadges()`
- AI (Phase 7): `getAiCache(key)`, `putAiCache(key, value, ttl)`, `recordAiCall(day)`, `getAiCallsToday()`
- Sync status: `getSyncStatus(): {lastSyncedAt, pending, lastError}`, `subscribeSync(cb)`

Every write goes through the outbox. Every read returns local data first.

## 3.3 IndexedDB stores (v2, created in Phase 3, all listed up front)

`meta`, `outbox`, `settings`, `plans`, `workouts`, `bodyweight`, `suggestions`, `badges`, `aiCache`.
No later phase bumps the IDB version. If a Wave 2 phase truly needs a new store, it writes a Contracts-change
note here first.

## 3.4 Worker route slots and D1 migration numbers

Pre-assigned migrations (one file per phase; no renumbering):

| Migration | Owner | Contents |
|---|---|---|
| `0001_core.sql` | Phase 4 | users, passwords, invites, sessions, ops_applied, settings, plans, workouts (incl. entries and sets as JSON or child tables, decided in Phase 4), bodyweight |
| `0010_coach.sql` | Phase 5 | `suggestions` |
| `0020_xp.sql` | Phase 6 | `badges` (XP and ranks are derived, not stored) |
| `0030_ai.sql` | Phase 7 | `ai_usage` (daily counter), `plan_proposals` (audit: prompt hash, provider, result status) |
| `0040_nutrition.sql` | Later | reserved |
| `0050_push.sql` | Phase 9 | `push_subscriptions`, `reminders` |
| `0060_weekly_review.sql` | Later (Phase 2 of SPEC) | reserved |

Worker route slots, reserved in the freeze: `coach` (none), `xp` (none), `ai` (`/api/ai/*`), `push`
(`/api/push/*`), `nutrition` (`/api/usda/*`, `/api/foods/*`, later).

## 3.5 File ownership table (Wave 2)

Each Wave 2 phase owns its folders. Shared files are touched only in the listed lines.

| Phase | Owns (folders) | May touch (shared, one line or own section only) |
|---|---|---|
| 5 Coach | `src/modules/coach/**`, `worker/migrations/0010_coach.sql` | `src/config/thresholds.ts` (`coach` section); `src/modules/coach/register.ts` (already exists) |
| 6 XP | `src/modules/xp/**`, `src/modules/progress/**`, `worker/migrations/0020_xp.sql` | `src/config/thresholds.ts` (`xp` section); `package.json` only if a new dependency is needed |
| 7 AI | `src/modules/ai/**`, `src/modules/onboarding/**`, `worker/src/ai/**`, `worker/src/routes/ai.ts`, `worker/migrations/0030_ai.sql` | `src/config/thresholds.ts` (`ai` section); `worker/src/routes/index.ts` (ai slot, one line); `wrangler.toml` (AI binding, one block) |
| 9 Push | `src/modules/push/**`, `worker/src/routes/push.ts`, `worker/migrations/0050_push.sql` | `src/config/thresholds.ts` (`push` section); `worker/src/routes/index.ts` (push slot); `public/sw.ts` or the vite-plugin-pwa injectManifest file (**shared with the PWA setup; the Phase 9 PR rebases last**) |
| Later: Nutrition | `src/modules/nutrition/**`, `worker/src/routes/usda.ts`, `worker/migrations/0040_nutrition.sql` | Same as above |

Rule: a Wave 2 PR that needs to change a file outside its row stops and asks in its PR description.

---

# WAVE 2: independent modules (parallel after the freeze)

## Dependency map (answers the "flag any dependency" request)

- **5 Coach** needs Phase 3 (history, e1RM, progression, `readSession`). Needs Phase 2 (movement patterns).
  Does **not** need 6 or 7.
- **6 XP** needs Phase 3 (workouts, bodyweight, owned weights) and Phase 2 (benchmark lift ids). Does **not**
  need 5 or 7. Acceptance numbers are blocked by SPEC §11 items 11 and 12 (open).
- **7 AI, first-plan scope** needs Phase 1 (Worker exists), Phase 2 (library), Phase 3 (plan model, settings, rules
  template as fallback), Phase 4 (Worker deployed with auth, to call with a user id). Does **not** need 5 or 6.
  Its client and validators can be built in parallel once Phase 3 merges, using fixtures.
- **Weekly AI review (SPEC Phase 2, not MVP)** needs 5 (coach card outputs). It must wait for 5, or stub the
  coach input with fixtures. Not in Wave 2.
- **9 Push** needs Phase 4 (subscriptions stored in D1; Worker up). Rest-timer end is in-app first (Phase 3);
  push is an addition.
- **Nutrition** needs Phase 4 (USDA calls through the Worker) and the Phase 3 settings model (targets). Later
  phase, not in Wave 2.

**Wave 2 order is parallel, with one collision risk:** 5, 6 and 7 all touch `thresholds.ts` (own sections; trivial
merge) and the reserved Worker slot file (already reserved, so no edit). Merge order if conflicts: 5, 6, 7, 9.

## Phase 5: Coach rules (stalled, too easy, stale) and swap suggestions

**Goal.** Pure detectors for stall, too-easy, stale and missed-session deload; swap candidates; coach cards on
Home with Accept / Not now / Never, storing reason and user choice.

**Files (create).**
- `src/modules/coach/domain/stall.ts`: 14-day window (SPEC §4, not the 21 days in REFERENCE_NOTES §2). Stall step = session's best e1RM at
  that weight does not beat the best from before the window. Fires only with ≥2 sessions in the 14-day window
  and ≥1 session before it.
- `src/modules/coach/domain/tooEasy.ts`: RIR ≥ 3 at top of range on 2 consecutive sessions. RIR null → rule off.
- `src/modules/coach/domain/stale.ts`: same exercise ≥ 8 weeks.
- `src/modules/coach/domain/deload.ts`: `selectDeloadCandidate` (port, REFERENCE_NOTES §2); factor 0.9 (config,
  0.5–0.95). Missed-session rule: 3 missed sessions in a row, reset on weight or plan change (SPEC §4.1).
- `src/modules/coach/domain/swap.ts`: same pattern, same primary muscle, owned equipment, `known` pattern only,
  not avoided, prefer not used recently.
- `src/modules/coach/domain/suggest.ts`: runs all rules over history; applies Not-now (7 days) and Never
  filters. Pure.
- `src/modules/coach/ui/CoachCards.tsx` (+ `register.ts` `homeCards` slot), `src/modules/coach/ui/` shows the numbers
  on each card.

**Data model and migrations.**
- IDB `suggestions` (reserved). Shape: SPEC §7 `Suggestion { id, userId, rule, exerciseId, reason, createdAt,
  status, until? }`. Stored for later review (SPEC §4.2).
- D1 `0010_coach.sql`: `suggestions` table with the same fields, scoped by `userId`.
- Config `coach`: `stallWindowDays: 14`, `stallMinSessions: 2`, `tooEasyRir: 3`, `tooEasyConsecutive: 2`,
  `staleWeeks: 8`, `deloadFactor: 0.9`, `deloadMinFactor: 0.5`, `deloadMaxFactor: 0.95`,
  `deloadMissedSessions: 3`, `notNowDays: 7`.

**Tests.**
- Stall: fires at 14 days, not at 13 (boundary). Needs ≥2 in window and ≥1 before; fewer → no fire.
- Too easy: 2 consecutive RIR ≥ 3 at top → fires; 1 session → no; RIR not logged → no.
- Stale: fires at 8 weeks, not 7.
- Deload candidate: lexicographic order (closest e1RM, then fewer rep changes, then heavier).
- Missed-session counter: 3 in a row fires; a weight or plan change resets it.
- Swap: excludes avoided, non-dumbbell, unknown patterns, and same exercise; prefers not-recently-used.
- Not now returns after exactly 7 days; Never does not reappear.
- Each suggestion stores reason and user choice.
- UI copy test: no forbidden internal terms on card text (SPEC §4.2).

**Acceptance (SPEC §10 Coach).**
- Each suggestion card shows the numbers behind it.
- Stall fires at 2 weeks with no e1RM gain; not before.
- Too easy fires only after 2 consecutive sessions with RIR ≥ 3 at top of range.
- Stale fires at 8 weeks on the same exercise.
- Accept applies the change; Never-exercises do not reappear.
- Footer shown on every suggestion screen.

**Risks.**
- Sparse data: most users will see no cards for weeks. Say so in the empty state.
- RIR is optional; too-easy may never fire. Document it.
- Pattern labels are weak, so swaps are limited (SPEC §11 item 7). A swap list may be empty. That is correct.
- SPEC §4 says stall 2 weeks; REFERENCE_NOTES §2 says ~3 weeks. Use the spec. Do not port the 3-week default.

## Phase 6: XP, ranks, streaks, badges, Progress screen

**Goal.** Derived XP per set and session, per-muscle volume and strength ranks, weekly streak, badges, and the
gamified Progress screen with a muscle picker.

**Files (create).**
- `src/modules/xp/domain/setXp.ts`: `load × reps` only for sets at or above target reps; reps beyond target earn
  less each (config fraction); weight-drop penalty if below the exercise's best recent weight; sets over 30 reps
  earn 0 and are flagged. Load uses `dbLoad` (`each` ×2 unless one-arm).
- `src/modules/xp/domain/sessionXp.ts`: small credit per primary muscle, secondary at 0.4 (REFERENCE_NOTES §6);
  progression bonus on new owned weight or top-of-range reps; per-session cap.
- `src/modules/xp/domain/rank.ts`: F E D C B A S SS SSS. Muscle rank = lower of volume rank (XP curve) and strength
  rank (bodyweight multiple, config table). Rank-up needs threshold met on **2 separate sessions**. No bodyweight
  on the day → no rank-up, rank unchanged.
- `src/modules/xp/domain/streak.ts`: week Monday 00:00 to Sunday 23:59 local; counts when all planned sessions are
  done; a miss resets.
- `src/modules/xp/domain/badges.ts`: milestones (first session, 10 and 100 sessions, first PR, first rank-up) and
  per-muscle and per-lift achievements. `awardBadge` never revokes.
- `src/modules/progress/` (`register.ts`, `ProgressScreen.tsx`, `BodyFigure.tsx`): hand-drawn SVG body
  figure (own drawing, no copied artwork), muscle bars, rank, streak, badges. Home shows only an XP link.

**Data model and migrations.**
- XP events and muscle ranks are **derived** from workouts; not stored (SPEC §7 says derived; SPEC §4b says
  recompute on edit). This is a deliberate reduction of the SPEC §7 list.
- IDB `badges` (reserved). D1 `0020_xp.sql`: `badges (id, userId, badgeKey, earnedAt, unique(userId, badgeKey))`.
- Config `xp`: per-rep fraction, weight-drop factor, per-session cap, progression bonus, rank XP curve,
  strength-standard table (**placeholder until SPEC §11 items 11 and 12 are decided**), overreps cap (30).

**Tests.**
- Below target → 0 XP. Above 30 reps → 0 and flagged.
- Each extra rep earns strictly less than the previous (monotonic decrease).
- Weight below recent best lowers that set's XP.
- Rank = min(volume, strength). Rank-up needs 2 separate sessions (one lucky set does not count).
- No bodyweight on the lift day → no rank-up.
- Streak: 3-of-3 week counts; a missed week resets; DST week handled in local time.
- Editing a past session recomputes XP and ranks. Badges already earned are not revoked.
- Fixture: a 12-week planned run moves trained muscles to about B. **Blocked** until strength-standard and XP numbers
  are decided (SPEC §11 items 11, 12). Write the fixture; mark the test `todo` until numbers exist.

**Acceptance (SPEC §4b, §10 XP and ranks).**
- All XP rules above. Streak counts only completed planned sessions.
- Progress screen shows muscle bars, ranks, streak, badges. Home shows XP only as a link.

**Risks.**
- The numbers are undecided. Phase 6 can ship the mechanism with placeholder config, but the B-rank acceptance
  test cannot pass until numbers exist. Decide before the phase starts.
- Gamification can encourage gaming. Anti-cheese rules are tested, but expect tuning.
- Body figure is custom SVG work; keep it simple (one silhouette, tappable regions).

## Phase 7: AI client (provider-agnostic), validation, copy-paste fallback, onboarding, first-plan proposal

**Goal.** A provider-agnostic AI client in the Worker with fallback chain (Workers AI → Gemini → Claude, SPEC §5.2),
strict JSON validation (SPEC §5.5), retry-once then rules-based fallback with "Built by rules; AI unavailable"
label, copy-paste fallback as a manual option, daily cap, onboarding interview, first-plan proposal. **Weekly review
is not in this phase** (D2).

**Files (create).**
- `worker/src/ai/client.ts`: one OpenAI-compatible client; base URL and model from config; no provider name outside
  this file and `chain.ts`.
- `worker/src/ai/chain.ts`: ordered providers; retry once with next provider on invalid or unreachable.
- `worker/src/routes/ai.ts`: `POST /api/ai/plan` (auth, daily cap, returns validated JSON or fallback flag).
- `src/modules/ai/domain/schema.ts`, `validate.ts`: SPEC §5.5 checks in order. Returns corrected values and
  reports each correction (snap weight to owned list, clamp reps to range). Pure.
- `src/modules/ai/domain/summary.ts`: compact summary (SPEC §5.3). Pure. No DOB, no free text, no raw logs.
- `src/modules/ai/ui/CopyPasteFallback.tsx`: prompt copy and paste-back box (settings, manual).
- `src/modules/onboarding/`: interview screens and answers → Settings (SPEC §2, §8.2 screen 1). Questions are written
  here at build time (SPEC §11 item 14). Blocker for this phase's UI, not its domain.
- `src/modules/ai/ui/ProposePlan.tsx`: shows plan, corrections, and label when rules-based.
- `src/modules/ai/register.ts`, `src/modules/onboarding/register.ts`.

**Data model and migrations.**
- IDB `aiCache` (reserved). D1 `0030_ai.sql`: `ai_usage (userId, day, calls)`, `plan_proposals (id, userId,
  promptHash, provider, status, createdAt)`. No prompt text or response stored beyond the hash.
- Config `ai`: provider order, base URLs, model names, per-day cap, timeouts, `summaryMaxRows`.
- Secrets (user action): `WORKERS_AI` binding (in `wrangler.toml`), `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` as Worker
  secrets. Never in `.env` committed.

**Tests.**
- Validator (table): non-JSON rejected; missing key; type wrong; length over (name 60, reason 200, note 400); unknown
  `exerciseId`; avoided exercise; non-dumbbell exercise; day count ≠ setting; exercises per day over session length;
  HTML or Markdown link in text → rejected.
- Corrections: off-list weight snaps to owned bell and is reported; reps clamped to range and reported.
- Chain: invalid → next provider once; both invalid → fallback to rules template with label; unreachable treated same.
- Cap: over daily cap → no provider call, rules fallback.
- Summary: output contains only the SPEC §5.3 fields (snapshot test).
- Guard: no provider key or `api.anthropic.com`/`generativelanguage` string in frontend bundle.

**Acceptance (SPEC §10 Plans).**
- AI-proposed plan passes all §5.5 checks, or the rules-based fallback is shown with the "Built by rules" label.
- No plan contains an excluded exercise or non-dumbbell equipment.
- Plan day count equals the days-per-week setting.
- Onboarding completes in under 2 minutes and saves every answer.
- Copy-paste fallback works when the Worker is unreachable (manual).

**Risks.**
- Free-tier quotas change (CLAUDE.md). The chain is config, and the fallback path is always available.
- AI now returns numbers (SPEC §5.4) against CLAUDE.md's current golden rule. **D8: update CLAUDE.md in the same
  PR or before it.**
- Onboarding questions are undecided (SPEC §11 item 14). Phase 7 UI waits for them. Domain and validation do not.
- Prompt injection from text fields: summary contains only structured fields, which limits this.

## Phase 8: Nutrition MVP. **Moved to Later (D1).** Blueprint only.

Not planned in detail. Scope per SPEC §9 Phase 3 and CLAUDE.md module 4: calorie and protein log against a daily
target; bundled USDA starter list (~100–150 foods, Hebrew names); recents and favourites; USDA search through the
Worker; custom foods; quick-add kcal; targets from Mifflin-St Jeor × activity, goal-adjusted, protein 1.6–2.2 g/kg.
Weekly calorie adjustment from the 7-day weight trend, and Open Food Facts with barcodes, come after that.
Depends on Phase 4 (Worker, USDA key secret) and the Phase 3 settings model.

## Phase 9: Push notifications and reminders (added, D4)

**Goal.** Rest-timer-end and workout-reminder push on iOS when installed; visible fallback when denied (SPEC §6.4).

**Files.** `src/modules/push/**`, `worker/src/routes/push.ts`, `worker/migrations/0050_push.sql`. Shared PWA service worker
file: rebase last.

**Data model.** `push_subscriptions (userId, endpoint, keys, createdAt)`, `reminders (userId, weekdays, time)`. D1 only.

**Tests.** Subscription stored once per endpoint; reminder fires only on training days at the set time (fake clock);
denied permission shows on-screen fallback (UI test).

**Acceptance (SPEC §10 Push).** Rest-timer alert fires when installed and backgrounded. Workout reminder fires at the
chosen time on training days. Denied permission shows the fallback.

**Risks.** iOS push only works when installed to Home Screen. Test on real device. Reminder timing depends on iOS
background scheduling, which is not exact.

---

# Wave 3: UX overhaul (U1–U8)

Source: `docs/superpowers/specs/2026-11-06-ux-overhaul-design.md` (approved 2026-11-06, PR #20). Section numbers
below (§n) refer to that design. One phase = one branch = one PR, in order: each phase uses what the previous one
ships. A phase's **detailed task plan** is written at its start into `docs/superpowers/plans/` (U1's is already
there), because it depends on the real code the earlier phases left behind.

Every phase: tests + lint + typecheck + build green; new domain rules are pure and tested; thresholds only in
`src/config/thresholds.ts`; new records save locally first and sync through the outbox; checked on a real iPhone
in standalone mode before its status says done.

## U1: Design foundation, navigation, exercise sheet shell (§6.1, §6.3, §7)
- Game-like tokens (dark first, glowing accent, light theme kept) and base styles, mobile first (375 px, 16 px
  gutters, 44 px targets, safe areas).
- Icon set (Lucide, ISC) and the shared components in `src/ui/`.
- Tabs Home · Plan · ▶ · Progress · More; More holds Library, History, Settings, Credits. Home temporarily shows
  today's existing screen until U6.
- Exercise sheet opened from every exercise name in Plan, Workout, History and coach cards (text content for now).
- Screens not rewritten later (Settings, History, Library list, Credits, coach and review cards, push settings,
  plan proposal) move onto the components. Onboarding, Workout, Home and Progress are left as they are; their
  phases rewrite them.
- **Done when:** no raw colours or ad-hoc sizes outside `src/styles.css` and `src/ui/`; every tab works one-handed
  on an iPhone; tapping an exercise name in Plan, Workout, History or a coach card opens its sheet (Library rows
  open the detail page).
- Detailed plan: `docs/superpowers/plans/2026-11-06-u1-design-foundation.md`.

## U2: Library and media (§3)
- `scripts/fetch-repdb.ts`: downloads the RepDB free tier at a pinned URL + SHA-256 into a gitignored folder;
  the deploy workflow runs it before `vite build`. No zip, index or listing in the build output.
- Import merge (pure, tested): RepDB core; free-exercise-db and openGym catalogue text-only extras; de-duplicate by
  normalised name + alias table; `fx_*` ids kept, new `rp_*` / `og_*` ids. Muscle-name table to body-map slugs
  and XP groups. Exercise model gains `media?: { stills?: string[]; clip?: string }`, `tips?`, `unilateral?`,
  `mode: 'reps' | 'time'`, and the full equipment list (§3.3).
- Port MuscleMap body geometry (male/female × front/back) with its MIT notice; `BodyMap` component (primary strong,
  secondary light). `ExerciseMedia` component: start/peak crossfade, reduced-motion still, clip slot.
- Exercise sheet gets media, body map, tips, last sessions/best set, Watch a demo (YouTube search link), Swap.
- Library screen: search, filter by owned equipment and muscle, pictures first.
- Credits: RepDB line, MuscleMap MIT notice, openGym catalogue text. CLAUDE.md licence table already corrected.
- **Done when:** every RepDB exercise shows its loop and muscles offline after first load; no RepDB file is in git;
  the AI prompt carries no RepDB text.

## U3: Onboarding v2 and settings model (§4, §8 existing data)
- Settings: `goals: Goal[]` (old `goal` read as a one-item list), `about?: { sex, age, heightCm }`,
  `equipment: EquipmentKind[]`, `owned` (dumbbells) + `ownedKettlebells`, `limits: { parts: BodyPart[]; note }`.
  D1 migration `0070_settings_v2.sql` if settings columns need it.
- Goal-blend table and joint→exercise limits table in config, pure functions `blendGoals(goals)` and
  `excludedByLimits(exercise, limits)`, tested. Equipment filter `usableWith(exercise, equipment)`.
- Nine-step onboarding on `ChoiceCard` / `ChipGroup` / weights chip grid (1–50 kg) with progress dots and a fixed
  Continue. Accounts missing the new fields see only the new steps, pre-filled.
- Settings screen edits the same fields with the same controls.
- **Done when:** a new account finishes onboarding in under two minutes with multi-picks, and an old account sees
  only the new steps.

## U4: Plan v2 (§5, §6.5 planning)
- Plan model gains `block: { weeks: 4|6|8|12; startedAt; deloadLastWeek }`, `schedule: 'rotation' | 'weekdays'`,
  per-exercise sets and rep range, cardio days and post-lift cardio / mobility blocks. Existing plan → 8-week
  block from ship date. Migration `0080_plan_v2.sql`.
- Pure: `blockWeek(plan, now)`, `isDeloadWeek`, `nextSession(plan, history)` for rotation and weekdays,
  starter templates filtered by equipment, validation of AI plans against equipment, limits, blend table.
- Plan screen: Generate/regenerate (existing AI chain + preview + accept), templates, Week X of N, edit in place
  (add from library, remove, reorder, sets/reps, swap). End-of-block offer: review + next block, or extend.
- Limits added later → coach cards proposing swaps (existing accept flow).
- **Done when:** the user can build, edit and regenerate a plan without leaving the Plan screen, and Home/Plan show
  the block week.

## U5: Workout v2 and cardio logging (§6.4, §6.5)
- Focus view (default) and list view (setting), current exercise and set highlighted, `Stepper` on `stepOwned`,
  one-tap ✓ on pre-filled sets (3-tap rule kept), timed sets for `mode: 'time'`.
- RIR picker 0–4+ with colours and one plain line per level. Rest timer as pinned bar/overlay (existing timer).
- Live PR badge (`prs.ts`). Finish summary: duration, volume, PRs, XP, muscles hit on the body map, rank-ups.
- Cardio session log (type, duration, distance?, effort?) and post-lift cardio blocks; record type and migration
  `0090_cardio.sql`; synced.
- XP: bodyweight-fraction and band-load table (§3.3) feeding existing volume/strength maths; cardio XP =
  duration × effort rule; streak counts planned cardio days as sessions.
- **Done when:** a full session logs one-handed with no typing in the common case, and a planned cardio day counts
  for the streak.

## U6: Home hub and Progress v2 (§6.2, §6.6)
- Home tiles: next workout (name, Week X of N, thumbnails, mini body map, Start), Level & XP, Streak, Coach count;
  each opens its screen.
- Progress: body map with Ranks and Recovery/neglect modes (thresholds in config), tap a muscle for rank, XP to
  next, benchmark lift, exercises; bodyweight chart with 7-day average and weigh-in; badges and streak.
- **Done when:** Home fits one iPhone screen without scrolling and every tile leads somewhere.

## U7: Game layer (§6.7)
- Rank-up / level-up celebration (CSS only) after the finish summary.
- Streak freezes: earn 1 per 4 completed weeks, hold max 2, auto-spent on a missed week (config).
- Weekly quests: 2–3 per week from rules over plan + history, bonus XP, deterministic.
- Monthly recap card on the first open of a month, with block position.
- Stored records (freezes, quests, recaps) with migration `0100_game.sql`.
- **Done when:** each rule has tests including week and month boundaries, and celebrations respect reduced motion.

## U8: Restyle from inspirations (§7)
- The user brings inspirations; a design drill-down session decides the look; this phase changes tokens and
  `src/ui/` CSS only. Any screen change needed is a defect in an earlier phase and is listed in the PR.

---

# 4. Status

| Phase | Wave | Status |
|---|---|---|
| 1 Scaffold, cache, CI, Pages | 1 | merged (PR #5), deployed; real-iPhone check not done |
| 2 Exercise library | 1 | merged (PR #6); iPhone check not done |
| 3 Settings, plans, logging, progression | 1 | merged (PR #7, #8); rest-timer iPhone check not done |
| 4 Worker, D1, sync, auth | 1 | 4a merged (PR #9); 4a-2 app wiring merged (PR #10); Worker deploy from Actions merged (PR #11); 4b server (password sign-in, invites, recovery, per-IP rate limits, sessions) on `phase-4b-auth`, PR pending; 4b app sign-in screen not started; end-to-end iPhone check not done |
| Contracts freeze | 1 | in progress (this PR): registry Wave 2 ids, Worker route slots, Coach defaults in thresholds |
| PR C Contracts freeze | 1 | not started |
| 5 Coach rules | 2 | implemented on `worktree-phase-5` (5a domain, data and sync; 5b Today cards and actions), not yet merged or checked on iPhone. Added: saved plan (built once, changed only by settings days or accepted suggestions; `0004_plans.sql`), suggestions sync (`0010_coach.sql`) |
| 6 XP and Progress | 2 | implemented on `phase-6` (XP per set and session, volume and strength ranks, streak, badges in `0020_xp.sql`, Progress screen with body figure). Numbers are set in `src/config/thresholds.ts` `XP` (SPEC §11 items 11 and 12 decided by the owner: hundreds and thousands, B is a guide, F → B takes well over 12 weeks). Strength uses one dumbbell lift per muscle; hamstrings, glutes and core rank on volume only. Not yet on an iPhone |
| 7 AI client, onboarding, first plan | 2 | implemented on `phase-7`: Workers AI only (binding, no key), retry-once chain with rules fallback, daily cap of 5 (`0030_ai.sql`), shared validator (`shared/ai-plan.ts`), onboarding (core six plus bodyweight), first-plan proposal with copy-paste fallback, plan replace. Gemini and Claude not wired. Not yet deployed or checked on an iPhone |
| 8 Nutrition | Later (D1) | blueprint only |
| Weekly AI review (SPEC Phase 2) | after 9 | implemented: one stored review per closed week (`0060_weekly_review.sql`), shown on the first open of each week, generated through the same chain and daily cap as the first plan, rules text stored when the AI does not answer. Coach suggestions stay on the coach cards. Not yet checked on an iPhone |
| 9 Push | 2 | implemented: rest-end push scheduled at rest start (cron every minute), one workout reminder per day on training days until the week's sessions are done, Web Push (RFC 8291 and 8292) on WebCrypto, custom service worker (`src/sw.ts`), Settings section with the install and denied fallbacks, `0050_push.sql`. Needs the Worker secret `VAPID_PRIVATE_JWK` before anything is sent. Not yet checked on an iPhone |
| U1 Design foundation, navigation | 3 | implemented (PR #22): tokens, `src/ui/` components, tab bar, exercise sheet, kept screens moved over; Settings save no longer drops onboarding answers. Browser-checked at 375 px; iPhone standalone check not done |
| U2 Library and media | 3 | implemented: 1,984 exercises (876 free-exercise-db, 399 RepDB, 709 openGym text), 442 with RepDB pictures fetched at build (never committed), MuscleMap body map, exercise sheet v2, library filters, pictures cached on first view. Browser-checked at 375 px incl. offline; iPhone standalone check not done |
| U3 Onboarding v2 | 3 | implemented: settings v2 (goals, about, equipment, kettlebell weights, limits); nine-step onboarding with multi-picks and the weight chip grid; pre-v2 accounts get only the five new steps; Settings edits the same answers; limits filter plans, swaps, the AI list and replace lists; library defaults to owned equipment. Browser-checked; iPhone standalone check not done |
| U4 Plan v2 | 3 | not started |
| U5 Workout v2, cardio | 3 | not started |
| U6 Home hub, Progress v2 | 3 | not started |
| U7 Game layer | 3 | not started |
| U8 Restyle | 3 | not started, waits for the user's inspirations |

Phase numbers 5 to 8 keep your original list. Phase 9 is the push phase added in D4. The Contracts freeze is
called PR C so it does not clash with Phase 5.

---

# 5. Open questions (blocking or shaping)

1. **Confirm D1 to D10** in §0. Especially D1 (nutrition later) and D2 (weekly review later).
2. **Sign-in and hosting**: **decided** (PR #3). Password-only sign-in, GitHub Pages hosting. SPEC §6.1 and
   CLAUDE.md need updating to match before Phase 4 merges (follow-up, not in this PR).
3. **SPEC §11 items 11 and 12** (strength-standard table and XP numbers). Blocks the Phase 6 B-rank acceptance test,
   not the mechanism.
4. **Onboarding questions** (SPEC §11 item 14). Blocks the Phase 7 onboarding UI.
5. **Split of Phase 3 and Phase 4** into two PRs each (D7).
6. **Kettlebells** (D9): confirm excluded.
7. **Compound/isolation mapping** from free-exercise-db `mechanic` (D10): confirm.
8. **CLAUDE.md update** for the first-plan AI numbers (D8): confirm it lands in the Phase 7 PR.
9. **Cloudflare and GitHub setup** (Phase 1 deploy, Phase 4 D1, Phase 7 AI secrets): user actions.
10. **Account recovery**: **accepted for now** (user, PR #3). The spec's invite-code recovery path is kept as
    written. Still to define before Phase 4b: which account an invite code reopens.
11. **Provider chain**: **decided** (user, PR #3). Workers AI → Gemini → Claude, per SPEC §5.2. Groq and OpenRouter
    dropped. CLAUDE.md updated to match. Claude is not a free tier; watch its cost in Phase 7.
12. **Sync conflicts**: **accepted** (user, PR #3). Last write wins per whole session (SPEC §6.2). Two devices
    editing one session will lose the earlier device's sets. Revisit only if this bites in use.
