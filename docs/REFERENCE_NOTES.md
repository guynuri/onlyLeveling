# openGym reference notes

Source studied: `reference/openGym-main/` (the folder is `openGym-main`, not `opengym`). It is
gitignored in this repo. Paths below are relative to that folder. Licence: **AGPL-3.0-or-later**
(see the licence section at the end before copying any code).

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
  the next target with no drift.
- **Policies**: `off`, `linear`, `greyskull`, `double`, `triple`, `time`. Allowed per mode in
  `POLICIES_FOR` (time only for holds, cardio gets `off`).
- **Session judging** (`readSession`, line ~267): a set counts as a hit only if checked with at
  least target reps. A miss is a checked set with fewer reps, an unchecked set, or too few sets.
  Only the first N sets of the plan decide the outcome; extra bonus sets never move the weight
  (issue #233).
- **Deloads**: `DELOAD_AFTER = { linear: 3, greyskull: 1, double: 3, triple: 3, time: 3 }`
  consecutive misses (`stallCount`, line ~407). `stallCount` resets on a weight change, on a
  plan change (`planned` differs), and under double/triple when the session beats the best of its
  run at that weight.
- **Deload size**: `DELOAD_FACTOR = 0.9` (allowed 0.5 to 0.95, per profile). For reps work,
  `selectDeloadCandidate` (line ~161) picks a load/reps pair from the loadable grid by a fixed
  lexicographic order: closest estimated 1RM, then fewer rep changes, then heavier load.
- **Assisted machines** progress by taking help off (lower is harder). Assisted exercises stay out
  of 1RM.

## 3. Estimated 1RM (`frontend/src/lib/onerm.js`, 222 lines)

- Default formula Epley: `w * (1 + r/30)`. Also Brzycki, Lombardi, O'Conner, Mayhew, Wathan,
  Lander, and a `weighted` blend of all seven plus an RIR %1RM table (Tuchscherer/RTS).
- `estimate1RM` returns **null** above `REP_CAP = 12` reps (single formulas) or `15`
  (`weighted`). A single rep with no RIR (or RIR 0) is a measurement, returned as-is.
- Cardio and timed sets drop out on their own (they have no `w`+`r`).
- `calculate1RMAccuracy`: confidence falls with reps, with RIR (x0.92 when RIR > 0), and with
  formula spread for the blend.
- Uses only `set.w` and `set.r`, never `topW` (it has no rep count).

## 4. PR detection

- **Weight PR** (what the finish screen shows as "New PR"): `frontend/src/sheets.jsx` ~4092-4102,
  `beatsWeight(e.id, mx, bestWeightFor(...))`. Lives in the UI file, not in a pure lib module.
- **e1RM record**: `is1RMRecord` in `onerm.js` compares the session with history *excluding* the
  session (`best1RM` over the rest), so it is never self-comparing.
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

## 6. Fatigue and recovery (`frontend/src/lib/recovery.js`, 569 lines)

Not asked for, but worth knowing: a hard set (near failure, via `effort.js` `rirOf`) counts 1.0
and a far-from-failure set at least 0.3 (`FATIGUE_RIR_FLOOR_WEIGHT`). Eight hard sets equal one
unit (`FATIGUE_SETS_PER_UNIT`). Each session is capped at 12 sets per muscle. Secondary movers count
0.4. Acute (7-day) to chronic (28-day) load ratio is clamped to 0.5-2. There is a 90-day RIR window.

## 7. Warm-ups (`frontend/src/lib/warmup-ramp.js`, 212 lines)

Ramp by load (bar for ten, then climbing sets, scaled to the work weight). Each rung is rounded
**down** to what the gym can load (`plates.js` dropGrid), never above the work set. A generated row
remembers its percentage (`wp`), so it rescales when the work weight moves (`history.js`
`rerampWarmups`).

## 8. Port vs rewrite

| Area | File | Decision | Why |
|---|---|---|---|
| Epley/Brzycki and other formulas | `onerm.js` | **Rewrite** (small) | The formulas are public facts. The file is short and has a clear spec in its comments. |
| Deload candidate search | `progression.js` `selectDeloadCandidate` | **Rewrite from the rule** | Lexicographic order is documented. Easy to test. |
| Stall/deload counting | `progression.js` `stallCount` | **Rewrite from the rules above** | Good rule set; most of the logic is edge cases for their UI. |
| Session judging (`readSession`) | `progression.js` | **Rewrite** | Core idea: only planned sets decide. Keep the principle, not the code. |
| Rest timer | `useUI.js` `startRest` / `runRest` | **Rewrite the idea** | `endsAt`-based timer is the key point. Their code is tied to Zustand and native bridges. |
| Fatigue model | `recovery.js` | **Defer** | Large, and tied to their muscle map. Do later if wanted. |
| Warm-up ramp | `warmup-ramp.js` | **Defer** | Good, but depends on the plates model. |
| Catalogue JSON and media | `catalogue/` | **Do not port** | Media is licensed by Gym visual; text is partly ExerciseDB v1 (MIT). See `DATA_SOURCES.md`. |
| Sync, server, PWA, passkeys | `api/`, `frontend/src/lib/sync-*` | **Do not port** | Out of scope for the first version. |

## 9. Licence (read before copying anything)

- openGym code is **AGPL-3.0-or-later**. Copying or closely translating its functions into a
  project under a different licence creates AGPL obligations. Writing from the behaviour
  described in this document is the safer route.
- Catalogue media (`catalogue/media/`) is **not** AGPL. Gym visual licenses it, and the NOTICE
  forbids reuse, hotlinking and AI feeding.
- Catalogue text marked `textSource: "exercisedb"` is MIT (ExerciseDB v1, via
  hasaneyldrm/exercises-dataset). The rest of the text is AGPL.
