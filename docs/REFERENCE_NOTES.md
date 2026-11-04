# openGym reference notes

Source studied: `reference/opengym/` (gitignored in this repo). Paths below are relative to that
folder. openGym is AGPL-3.0-or-later. This project is also AGPL-3.0, and CLAUDE.md allows porting.
Every ported file goes in `docs/CREDITS.md`. Where we change a trigger or default, this document says so.

## 1. Data model

**Exercise (catalogue)**: `catalogue/exercises/<id>.json`, 6,554 files. Fields: `id`, `name`,
`bodyPart`, `equipment`, `target` (primary muscle), `secondaryMuscles[]`, `category`,
`description`, `instructions[]`, `femaleVariant`/`maleVariant`, `variantOf`, `muscleMap`, `needs`,
`hold`, `textSource`. The app reads a generated bundle, `frontend/src/lib/exercises-data.js`
(built by `scripts/catalogue/build.mjs`; never edit it by hand). Runtime lookup: `EXIDX[id]` in
`frontend/src/lib/exercises.js`.

**Session (history)**: `S.workouts[]` in the store, written by `frontend/src/lib/finish-workout.js`
`buildCompletedWorkout`:

```
workout { id, d, start, end, routineIds[], name, bw, entries[], prs[], gym?, note?, excludeFromProgression? }
entry   { id (exercise), sets[], topW, target, planned, rid?, noProg?, sg?, note?, muscleSnapshot? }
set row { w, r, done, phase: 'work'|'warmup', type: 'straight'|'dropset'|'restpause',
          drops[]?, clusters[]?, failure?, sides: {L,R}?, rir?, at, sec?, min?, restSec? }
```

- Only what was logged is kept. Live-only bookkeeping (`planSec`, `weightOrigin`, own rest) is
  stripped at finish (`finishedRow`).
- Per-side (unilateral) rows keep `sides.L`/`sides.R`; the row's `w`/`r`/`done` are a summary
  recomputed by `syncSideAggregate` (`workout-model.js`).
- Drop-sets and rest-pause rows keep their extra volume on the row itself (`dropsOf`,
  `clustersOf`, `extraVolumeOf` in `workout-model.js`). Only the row's own `w`/`r` feed 1RM and
  progression.

**Routine / plan config (`cfg`)**: `sets`, `reps` or `repsMin` (range), `setsMax` (triple),
`sec` (holds), `weight`, `prog` (policy), `inc` (load step), `side`, `warmup` (`auto|own|none`),
`warmupRows`. Each session stamps `entry.planned` (`plannedOf`, `progression.js`) so a later
edit of sets/reps can be told apart from a progression.

## 2. Progression (`frontend/src/lib/progression.js`, 837 lines)

- **Pure and derived.** Nothing writes a counter back. `nextPrescription(S, cfg, routine)`
  (line ~451) recomputes the next target from history every time. Fixing a mistyped set changes
  the next target with no drift. **Port this structure.**
- **Policies**: `off`, `linear`, `greyskull`, `double`, `triple`, `time`. Allowed per mode in
  `POLICIES_FOR` (time only for holds, cardio gets `off`).
  **Our default is double progression.** openGym defaults to linear (`profileRule`, line ~99).
- **Session judging** (`readSession`, line ~267): a set counts as a hit only if checked with at
  least target reps. A miss is a checked set with fewer reps, an unchecked set, or too few sets.
  Only the first N sets of the plan decide the outcome; extra bonus sets never move the weight
  (issue #233). **Port the principle.**
- **Deloads (our trigger):** openGym deloads after `DELOAD_AFTER` consecutive missed sessions
  (`linear: 3, greyskull: 1, double: 3, triple: 3, time: 3`). **We deload on a stall instead:** no
  e1RM improvement over about 3 weeks of sessions (CLAUDE.md). Port `stallCount` as the counting
  mechanism (line ~407): it resets on a weight change, on a plan change (`planned` differs), and
  under double/triple when the session beats the best of its run at that weight. Whether to also
  deload after N missed sessions is an open question for the spec (section 12).
- **Deload size**: `DELOAD_FACTOR = 0.9` (allowed 0.5 to 0.95, per profile). For reps work,
  `selectDeloadCandidate` (line ~161) picks a load/reps pair from the loadable grid by a fixed
  lexicographic order: closest estimated 1RM, then fewer rep changes, then heavier load.
- **Assisted machines** progress by taking help off (lower is harder). Assisted exercises stay out
  of 1RM.

## 3. Estimated 1RM (`frontend/src/lib/onerm.js`, 222 lines)

- openGym default formula is Epley: `w * (1 + r/30)`. **Our rule is Epley only, and only from sets
  of 12 reps or fewer** (CLAUDE.md). Do not port the 7-formula blend, the RIR %1RM table, or
  `WEIGHTED_REP_CAP = 15`.
- `estimate1RM` returns **null** above `REP_CAP = 12` reps. A single rep with no RIR (or RIR 0) is a
  measurement, returned as-is.
- Cardio and timed sets drop out on their own (they have no `w`+`r`).
- Uses only `set.w` and `set.r`, never `topW` (it has no rep count).
- `is1RMRecord` compares a session with history *excluding* that session, so it is never
  self-comparing. Port this.

## 4. PR detection

- **Weight PR** (what the finish screen shows as "New PR"): `frontend/src/sheets.jsx` ~4092-4102,
  `beatsWeight(e.id, mx, bestWeightFor(...))`. Lives in the UI file, not in a pure lib module. Port
  the logic into a pure module, not the UI.
- **e1RM record**: `is1RMRecord` in `onerm.js` (see section 3).
- Results are written to `workout.prs` (exercise ids) at finish.

## 5. Rest timer

- `frontend/src/store/useUI.js` `startRest(sec, forIdx, {kind, forSet})` (~line 342). Stores
  `timer: { left, total, endsAt, forIdx, forSet }`. Ticks off `endsAt` (wall clock), so a
  backgrounded tab catches up. `pageHiddenAt` is reset on each start, so a stale value cannot end
  a rest silently.
- Starting a rest abandons any running hold (`abandonWork`); the two never run together.
- End-of-rest alerts: browser notification / web push (`/api/push/rest-timer`), or native
  `rest-alert.js` on the phone apps.
- Defaults (`useStore.js` line ~92): `restSec: 90`, `restPauseSec: 15`. `0` means Off and
  `startRest` returns without starting.
- **Port the `endsAt` idea.** The rest of the code is tied to Zustand and native bridges, so rewrite it.

## 6. Fatigue and recovery (`frontend/src/lib/recovery.js`, 569 lines)

Not in scope yet. A hard set (near failure, via `effort.js` `rirOf`) counts 1.0 and a
far-from-failure set at least 0.3 (`FATIGUE_RIR_FLOOR_WEIGHT`). Eight hard sets equal one unit
(`FATIGUE_SETS_PER_UNIT`). Each session is capped at 12 sets per muscle. Secondary movers count 0.4.
Acute (7-day) to chronic (28-day) load ratio is clamped to 0.5-2. There is a 90-day RIR window.

## 7. Warm-ups (`frontend/src/lib/warmup-ramp.js`, 212 lines)

Ramp by load (bar for ten, then climbing sets, scaled to the work weight). Each rung is rounded
**down** to what the gym can load (`plates.js` dropGrid), never above the work set. A generated row
remembers its percentage (`wp`), so it rescales when the work weight moves (`history.js`
`rerampWarmups`). Not in scope yet; it depends on the plates model.

## 8. Dumbbell inventory and load meaning (`frontend/src/lib/dumbbells.js`)

This matters for the core product: dumbbells are the only equipment we train with. It is a
**port candidate**. Its header comments explain the reasoning well.

- **The problem it solves.** A dumbbell bench at "20 kg" can mean one 20 kg bell in each hand or two
  10s. openGym asks what a weight means and records that per exercise.
- **Load meaning** `dbLoad` per exercise: `as` (as entered, the default), `each` (one bell's weight,
  so volume counts ×2 unless the exercise is one-arm), `total` (both bells together). Stored on the
  routine's exercise (`cfg.dbLoad`) or as the exercise's default (`S.dbLoad[exId]`). A session stamps
  the meaning it was logged with, so later changes never reinterpret old sets. Records and progression
  halve or double before comparing across meanings.
- **Inventory:** `S.dumbbells[unit] = { weights, _ts }`, the weights you own, per unit. With an
  inventory, progression, deloads, warm-ups, drops and the stepper land on bells you have, not on the
  increment grid. Without one, nothing changes.
- **Functions to port:** `ownedUp` / `ownedDown` / `ownedDeload` / `ownedAround` / `stepOwned`
  (move to the next owned bell; a double jump is two bells up), `ownedWeightsFor`, `ownedKindFor`,
  `bellsIn` (one arm = 1 bell, otherwise 2), `isOneArm`.
- **Presets:** `DB_PRESETS` (kg: 2 to 50 in steps of 2; lb: 5 to 100 in steps of 5).
- **Fit with CLAUDE.md:** "Dumbbell min/max/step are user settings." An owned-weights list covers
  that, and it works better when the bells are not evenly spaced. Our settings should store the list.
- Kettlebells use the same `BELL_EQ` set; keep that in our model too.

## 9. Port vs rewrite

| Area | Decision | Our change |
|---|---|---|
| Pure, derived progression (`nextPrescription`) | **Port** the structure | Our defaults and triggers (sections 2 and 11) |
| Session judging (`readSession`) | **Port** the principle | None |
| Stall counting (`stallCount`) | **Port** the mechanism | Stall trigger, not N missed sessions (section 2) |
| Deload candidate search (`selectDeloadCandidate`) | **Port** | Epley ≤12 only |
| e1RM (`onerm.js`) | **Port** the Epley path, `is1RMRecord` | Drop the formula blend and the 15-rep cap |
| Dumbbell inventory and load meaning (`dumbbells.js`) | **Port** | Our settings store (section 8) |
| Rest timer (`useUI.js`) | **Rewrite** from the `endsAt` idea | Native and Zustand code is tied to their app |
| PR detection (`sheets.jsx`) | **Rewrite** into a pure module | Logic only, not the UI |
| Fatigue model (`recovery.js`) | **Defer** | Not in the first version |
| Warm-up ramp (`warmup-ramp.js`) | **Defer** | Depends on the plates model |
| Catalogue JSON and media (`catalogue/`) | **Do not port** | Media is Gym visual's; text is partly ExerciseDB (MIT). See `DATA_SOURCES.md` |
| Sync, server, PWA, passkeys (`api/`, `sync-*`) | **Do not port** | Our backend is Cloudflare D1 |

Every ported file gets a row in `docs/CREDITS.md`.

## 10. Licence

- openGym code is **AGPL-3.0-or-later**. This project is AGPL-3.0 (CLAUDE.md), so porting is allowed.
  Record every ported file in `docs/CREDITS.md`.
- Catalogue media (`catalogue/media/`) is **not** AGPL. Gym visual licenses it, and its NOTICE
  forbids reuse, hotlinking and AI feeding. Never copy it (CLAUDE.md).
- Catalogue text marked `textSource: "exercisedb"` is MIT (ExerciseDB v1, via
  hasaneyldrm/exercises-dataset). The rest of the text is AGPL.

## 11. New rules with no reference implementation

These are in CLAUDE.md but openGym has no equivalent. Write them from scratch and test them.

- **"Too easy"**: logged RIR ≥ 3 at top of range for 2 consecutive sessions → suggest a bigger jump
  or an extra set.
- **"Stale"**: the same exercise for 8+ weeks → suggest a variation.

## 12. Open question for the spec

- Also deload after N missed sessions in a row, on top of the stall rule? openGym does this. It is
  recorded in CLAUDE.md under "Open questions" and needs an answer in `docs/SPEC.md`.
