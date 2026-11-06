# U5b: Cardio logging and unweighted XP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log cardio (planned cardio days, post-lift blocks and extra sessions), give bodyweight and band sets XP, and let a finished planned cardio day count for the weekly streak.

**Architecture:** Cardio is a new record type that follows the workout path end to end: IndexedDB store (v3), `Repo`, outbox op, Worker op kind with a D1 table (`0090_cardio.sql`, additive), pull and export. XP and streak stay derived (`computeProgress`), never stored. A standalone cardio day is a plan day with `kind: 'cardio'` and no exercises. Rules and tables are pure, tested and in `src/config/thresholds.ts`.

**Tech Stack:** React 18 + TS, Vitest (node + Worker pool). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-06-ux-overhaul-design.md` §3.3 (XP for unweighted work, timed exercises), §6.5 (cardio, streak). Roadmap: `docs/PLAN.md` U5b. Part of PR #30 with U5a.

## Global Constraints

- Cardio types: run, walk, bike, rower, jump rope, HIIT, other. Duration (minutes) required; distance (km) and effort (1–10) optional. Saved locally first, synced like workouts.
- Cardio XP = duration × effort rule from config (default effort 5 when none). It never counts toward muscle XP or ranks.
- **Streak (owner, UX design §6.5):** a plan's weekly session count includes its cardio days. A finished cardio **day** is a finished session. A post-lift cardio block belongs to its lifting session and is not counted separately. An unplanned extra cardio session earns XP but does not count toward the week's target.
- XP for unweighted work: a bodyweight exercise counts as a share of the latest bodyweight (table by exercise name, with a default); a band set counts as a fixed per-band load. That load feeds the existing volume XP unchanged. No bodyweight logged → a config default is used and the finish summary says so. Timed sets (`mode: 'time'`) earn no muscle XP.
- D1 migrations only add (CLAUDE.md "expand, then contract"): the new table and op kind must not break the live Worker or an older app (the app tolerates a Worker that returns no `cardio`).
- All numbers in `src/config/thresholds.ts`. Training guidance, not medical advice.

## Review Focus

1. **A Worker without cardio yet** (old Worker, new app): pull has no `cardio` → the app must not crash; an unknown op kind from the outbox stays queued, never dropped → test in Task 3.
2. **Rotation after a cardio day:** the next session advances (cardio days count in `sessionsInBlock`) → test in Task 5.
3. **Weekdays plan after adding or removing a day:** the old weekday list no longer fits, so the plan falls back to rotation instead of mis-scheduling → test in Task 5.
4. **An extra cardio session must not inflate the streak**; a planned cardio day must → test in Task 4.
5. **A timed hold (plank) must earn no muscle XP** even though its seconds look like reps → test in Task 1.
6. **Cardio with 0 minutes, effort 11, negative distance** are rejected with a plain message → test in Task 2.

---

### Task 1: XP for unweighted and timed work

**Files:**
- Modify: `src/config/thresholds.ts`, `src/modules/xp/domain/sessionXp.ts`, `src/modules/xp/domain/progress.ts`, `src/modules/xp/domain/sessionSummary.ts`, `src/modules/training/FinishSummary.tsx`
- Create: `src/modules/xp/domain/effectiveLoad.ts`
- Test: `src/modules/xp/domain/effectiveLoad.test.ts`, `src/modules/xp/domain/progress.test.ts`, `src/modules/xp/domain/sessionSummary.test.ts`

**Interfaces:**
- Produces:
  - `UNWEIGHTED_XP = { defaultBodyweightKg: 70, bandLoadKg: 10, defaultFraction: 0.5, fractions: [{ match: string (regex source, case-insensitive), fraction: number }…] }` — push-up 0.65, pull-up / chin-up 1.0, dip 0.9, squat (bodyweight) 0.6, lunge / split squat 0.5, sit-up / crunch / leg raise 0.3.
  - `effectiveLoad(ex: Pick<Exercise,'name'|'equipment'|'requires'|'mode'>, bodyweightKg: number | null): { kg: number; usedDefault: boolean } | null` — null for a timed exercise; the weight is used as entered for dumbbell/kettlebell moves (returns null too: callers keep the entered weight); band → `bandLoadKg`; bodyweight → fraction × (bodyweightKg ?? default).
  - `sessionXp(entries, recentBest, repMaxFor, bodyweightKg: number | null)` — for an entry where `effectiveLoad` is non-null, each set is scored with `w` replaced by that kg and one bell; timed exercises score 0 and no bonus.
  - `ProgressState.usedDefaultBodyweight: boolean` and `SessionSummary.usedDefaultBodyweight: boolean`; `FinishSummary` shows "Log your weight in Progress so bodyweight sets earn exact XP." when true.

- [ ] **Step 1: Failing tests:** `effectiveLoad` (push-up 0.65 × 80 kg, pull-up 1.0, band 10, unknown bodyweight exercise uses the default fraction, no bodyweight uses 70 and says so, dumbbell and timed return null); `sessionXp`: a 3 × 10 push-up session earns XP > 0 and a plank (timed, 45 "reps") earns 0 (Review Focus 5); `computeProgress` credits chest XP for push-ups using the logged bodyweight; `summarize` reports `usedDefaultBodyweight`.
- [ ] **Step 2: Run** `npx vitest run src/modules/xp` → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(xp): bodyweight and band sets earn XP, timed sets earn none`.

### Task 2: Cardio record and XP (pure)

**Files:**
- Create: `src/domain/cardio.ts`
- Modify: `src/config/thresholds.ts` (`CARDIO`)
- Test: `src/domain/cardio.test.ts`

**Interfaces:**
- Produces:
  - `type CardioType = 'run' | 'walk' | 'bike' | 'rower' | 'jump-rope' | 'hiit' | 'other'`
  - `interface CardioSession { id: string; start: number; minutes: number; type: CardioType; distanceKm?: number; effort?: number; planDay?: number; afterWorkoutId?: string }` — `planDay`: the plan day index of a planned cardio day (the only kind that counts for the streak); `afterWorkoutId`: a post-lift block.
  - `CARDIO = { types: [{ value, label }…], minutesMax: 600, distanceMax: 500, defaultEffort: 5, xpPerEffortMinute: 3 }`
  - `parseCardio(f: { type: string; minutes: number; distanceKm: number | null; effort: number | null }): { ok: true; value: Omit<CardioSession,'id'|'start'|…> } | { ok: false; error: string }` — minutes 1–`minutesMax`, effort 1–10 or null, distance > 0 and ≤ `distanceMax` or null, type in the list.
  - `cardioXp(c: Pick<CardioSession,'minutes'|'effort'>): number` — `minutes × (effort ?? defaultEffort) × xpPerEffortMinute / 10`, rounded.
  - `countsForStreak(c: CardioSession): boolean` — `planDay !== undefined`.

- [ ] **Step 1: Failing tests:** `parseCardio accepts a minimal session and a full one`; `rejects 0 minutes, effort 11, negative distance, unknown type` (Review Focus 6); `cardioXp scales with minutes and effort and defaults the effort`; `countsForStreak is true only for a planned cardio day` (Review Focus 4).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(cardio): cardio record, validation and XP`.

### Task 3: Storage and sync

**Files:**
- Create: `worker/migrations/0090_cardio.sql`
- Modify: `src/db/idb.ts` (v3, store `cardio`), `src/data/repo.ts`, `src/data/idb-repo.ts`, `src/data/synced-repo.ts`, `src/data/sync-client.ts`, `src/data/sync-engine.ts`, `worker/src/sync.ts`
- Test: `src/db/idb.test.ts`, `src/data/synced-repo.test.ts` (extend or create), `src/data/sync-engine.test.ts`, `worker/src/sync.test.ts`

**Interfaces:**
- Produces: `Repo.saveCardio(c: CardioSession): Promise<void>` and `Repo.listCardio(): Promise<CardioSession[]>` (newest first); outbox op `saveCardio` (key = id) → server kind `cardio`; D1 table `cardio_sessions (user_id, id, data, updated_at, server_at, PRIMARY KEY (user_id, id))` with index on `(user_id, server_at)`; `Pulled.cardio: unknown[]`; Worker `parseOps` validates `data.id` (string), `data.minutes` (number > 0), `data.type` (string).

- [ ] **Step 1: Failing tests:** idb opens at version 3 with a `cardio` store; synced repo saves locally and queues `saveCardio`; `toOp` maps it to kind `cardio`; sync engine applies pulled cardio, skips one with a write still queued, and does not crash when the pull has no `cardio` (Review Focus 1); Worker round-trips a cardio op through push, pull and export; Worker rejects a cardio op without minutes.
- [ ] **Step 2: Run** `npm test` → FAIL. **Step 3: Implement** (migration, op parse, upsert, pull, export). **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(cardio): store and sync cardio sessions (migration 0090)`.

### Task 4: Progress and streak

**Files:**
- Modify: `src/modules/xp/domain/progress.ts`, `src/modules/progress/ProgressScreen.tsx`
- Test: `src/modules/xp/domain/progress.test.ts`

**Interfaces:**
- Consumes: `CardioSession`, `cardioXp`, `countsForStreak`.
- Produces: `ProgressInput.cardio?: readonly CardioSession[]`; `ProgressState.cardioXp: number` (sum of `cardioXp`, never added to a muscle) and `ProgressState.cardioSessions: number`; the streak counts workouts plus cardio sessions that `countsForStreak`. `ProgressScreen` passes `cardio` and, when a plan exists, `daysPerWeek = plan.days.length`; shows "Cardio XP" and sessions.

- [ ] **Step 1: Failing tests:** `cardio XP is a separate total and no muscle changes`; `a planned cardio day fills a streak slot, an extra cardio session does not` (Review Focus 4); `a week with 2 lifting sessions and 1 planned cardio day meets a 3-day target`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(cardio): cardio XP and the cardio streak slot`.

### Task 5: Cardio days in the plan

**Files:**
- Modify: `src/domain/template.ts` (`TemplateDay.kind?: 'cardio'`, `cardio?: { type: CardioType; minutes: number }`), `src/domain/plan-edit.ts`, `src/domain/block.ts`
- Test: `src/domain/plan-edit.test.ts`, `src/domain/block.test.ts`

**Interfaces:**
- Produces: `addCardioDay(plan, cardio: { type: CardioType; minutes: number }, now): Plan` (appends a day with `kind: 'cardio'`, empty `exerciseIds`, and clears an unusable `weekdays` list back to rotation); `removeDay(plan, dayIndex, now): Plan` (refused when it is the last day; re-indexes the rest; same weekday fallback); `setCardioDay(plan, dayIndex, cardio, now): Plan` (only on a cardio day, validated with `parseCardio` limits); `sessionsInBlock(plan, items: readonly { start: number }[])` unchanged — callers pass workouts plus planned cardio.

- [ ] **Step 1: Failing tests:** `addCardioDay appends a cardio day and drops weekdays that no longer fit` (Review Focus 3); `removeDay refuses the last day, re-indexes the rest and adjusts weekdays`; `setCardioDay only edits cardio days and rejects 0 minutes`; `rotation advances past a cardio day when planned cardio sessions are counted` (Review Focus 2).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5: Commit** `feat(plan): standalone cardio days`.

### Task 6: Cardio screens

**Files:**
- Create: `src/modules/training/CardioLog.tsx`, `src/modules/training/CardioScreen.tsx`
- Modify: `src/app/route.ts` (`#/cardio`), `src/App.tsx` (route), `src/app/MoreScreen.tsx` (link "Log cardio"), `src/modules/training/WorkoutScreen.tsx`, `src/modules/training/PlanScreen.tsx`, `src/modules/training/DayEditor.tsx` (cardio day editor), `src/modules/training/FinishSummary.tsx`

**Interfaces:**
- Produces: `CardioLog({ defaults: { type; minutes; effort? }, onSave(c: parsed values) })` — type chips, minutes `Stepper` (step 5), distance `Stepper` (step 0.5 km, 0 = none), effort `Stepper` 1–10; the save button shows the XP it will earn. `CardioScreen` — an extra (unplanned) session: saved via `getRepo().saveCardio`, shows XP, "does not count toward this week's target".
- Workout screen: when today's plan day is a cardio day the preview shows its type and minutes and a `CardioLog` (saved with `planDay`); after a lifting Finish, a day with `postCardioMinutes` shows a "Log your cardio" card (saved with `afterWorkoutId`, not counted for the streak). `nextSession` and `sessionsInBlock` get workouts plus planned cardio. Plan screen: "Add cardio day" and, for a cardio day, a small editor (type, minutes) and Remove day.

- [ ] **Step 1: Implement.** **Step 2: Verify** `npm run typecheck && npm run lint && npm run build && npm test`; browser (production build): add a cardio day, log it from Train, see the rotation advance, log an extra session from More, see Cardio XP on Progress, post-lift cardio after a lifting session.
- [ ] **Step 3: Commit** `feat(cardio): log cardio days, post-lift cardio and extra sessions`.

### Task 7: Docs and status

- [ ] `docs/PLAN.md`: U5b status "implemented …, iPhone check not done"; `docs/SPEC.md` §3.3 note if a value moved. Verify everything; commit `docs: U5b status`; push to PR #30.

---

## Rulings made while planning

1. One PR (#30) for U5a and U5b (owner request).
2. Cardio XP is a separate total (level maths is U6); it never touches muscle ranks.
3. The streak target is the plan's day count (cardio days included) when a plan exists, else Settings' days per week.
4. Rules-built plans keep post-lift cardio blocks; standalone cardio days are added by hand on the Plan screen.
5. Unweighted XP fractions and the band load are proposals in config, to be tuned like the rest of the XP table.
