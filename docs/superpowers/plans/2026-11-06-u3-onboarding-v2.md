# U3: Onboarding v2 and Settings Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A warm, multi-pick onboarding (goals, about you, experience, days, session length, equipment, weights grid, limits, plan) and a Settings screen that edits the same answers, with limits and equipment actually filtering what the app offers.

**Architecture:** Settings stay one JSON record synced as a whole (no D1 migration). New fields are optional and read through pure accessors, so old records keep working. Step UIs live in one file and are reused by onboarding and Settings. Rules tables (goal blend, joint limits, weight grids) live in `src/config/thresholds.ts`.

**Tech Stack:** React 18 + TS, Vitest (node). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-06-ux-overhaul-design.md` §4, §3.3, §8 (existing data, limits added later). Roadmap: `docs/PLAN.md` Wave 3, U3.

## Global Constraints

- Goals are a set with equal weight: `build-muscle`, `strength`, `lose-fat`, `endurance`, `mobility`, `health`. Old `goal` reads as a one-item list.
- About you (sex, age, height) is optional and never leaves the device; weight becomes a bodyweight log entry (already never sent to AI). Sex picks the body figure.
- Equipment: multi-select of `none` (always implied), `dumbbell`, `kettlebell`, `bench`, `pullup_bar`, `band`. Plans and swaps stay dumbbell/equipment-free until U4 (U1/U2 rule); U3 uses equipment for the library default only.
- Weights: chip grid only (user decision), dumbbells 1–50 kg; kettlebells shown only when owned.
- Limits: tappable body parts + optional note. A limit removes exercises from plans, the AI candidate list, swaps and Plan's replace list. A limit never edits a saved plan (coach cards for that are U4). Wording: training guidance, not medical advice.
- Existing accounts (onboarded before v2) re-run all nine steps on next open, pre-filled with what they have (owner decision, 2026-11-06); the plan and `onboardedAt` are never reset.
- The approved design says the limits note goes to the AI. It is capped at 200 characters and sent as `limitsNote`; nothing else free-text leaves the device.
- Tests + lint + typecheck + build green; iPhone standalone check before done.

## Review Focus

1. **An account saved before U3** (only `goal`, `owned`, `onboardedAt`): app opens to all nine steps, pre-filled with goal and dumbbells → covered by `onboardingDone` in `profile.test.ts`.
2. **Skipping About you** leaves no partial record and never blocks Continue → test in Task 1 (`parseAbout` with all blanks).
3. **A limit plus an exercise already in the saved plan:** the plan keeps it (no silent edit), but it is gone from swaps, replace lists and new plans → test in Task 2 (`blockedIds` used by `candidates`).
4. **Deselecting every dumbbell weight** cannot be saved while Dumbbells is selected (empty owned list breaks progression) → test in Task 1 (`validateWeights`).
5. **Re-running onboarding steps from Settings** never clears `onboardedAt` or the plan → covered by `applySettingsForm`-style merge in Task 5.

---

### Task 1: Settings model v2, config tables, pure rules

**Files:**
- Modify: `src/domain/types.ts`, `src/config/thresholds.ts`
- Create: `src/domain/profile.ts`, `src/domain/profile.test.ts`

**Interfaces:**
- `types.ts` `Settings` gains: `goals?: Goal[]`, `about?: { sex?: 'male' | 'female'; age?: number; heightCm?: number }`, `equipment?: EquipmentChoice[]`, `ownedKettlebells?: number[]`, `limits?: { parts: BodyPart[]; note: string }`, `onboardedV2At?: number`. `goal` stays (read-only legacy).
  - `type Goal = 'build-muscle' | 'strength' | 'lose-fat' | 'endurance' | 'mobility' | 'health'`
  - `type EquipmentChoice = 'dumbbell' | 'kettlebell' | 'bench' | 'pullup_bar' | 'band'`
  - `type BodyPart = 'shoulder' | 'elbow' | 'wrist' | 'lower-back' | 'hip' | 'knee' | 'ankle' | 'neck'`
- `thresholds.ts` gains `PROFILE = { dumbbellGrid: number[], kettlebellGrid: number[], about: { age: [13, 100], heightCm: [100, 250], weightKg: [30, 300] }, limitsNoteMax: 200 }`, `GOAL_BLEND` and `LIMIT_RULES`:
  - `dumbbellGrid`: 1, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9, 10, 11, 12, 12.5, 13, 14, 15, 16, 17.5, 18, 20, 22, 22.5, 24, 25, 26, 27.5, 28, 30, 32, 32.5, 34, 35, 36, 37.5, 40, 42.5, 44, 45, 47.5, 50.
  - `kettlebellGrid`: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48.
  - `GOAL_BLEND`: per goal `{ cardioSessions: number; cardioMinutes: number; mobilityMinutes: number; repBias: 'none' | 'heavier' | 'lighter' }` — build-muscle `{0,0,0,'none'}`, strength `{0,0,0,'heavier'}`, lose-fat `{2,20,0,'none'}`, endurance `{2,30,0,'lighter'}`, mobility `{0,0,5,'none'}`, health `{1,20,5,'none'}`.
  - `LIMIT_RULES: Record<BodyPart, { slugs: BodySlug[]; safeTag?: string }>` — shoulder `{['deltoids'], 'shoulder_safe'}`, elbow `{['triceps','biceps']}`, wrist `{['forearm']}`, lower-back `{['lower-back'], 'lower_back_safe'}`, hip `{['gluteal','adductors','hip-flexors']}`, knee `{['quadriceps'], 'knee_safe'}`, ankle `{['calves','tibialis']}`, neck `{['trapezius']}`.
- `profile.ts` (pure):
  - `goalsOf(s): Goal[]` — `goals` if non-empty, else `[s.goal]` if set, else `['build-muscle']`.
  - `equipmentOf(s): EquipmentChoice[]` — `equipment` if set, else `['dumbbell']` when `owned` is non-empty, else `[]`.
  - `blendGoals(goals): { cardioSessions; cardioMinutes; mobilityMinutes; repBias }` — max of each number across goals; `repBias` is `'heavier'` if strength is in and endurance is not, `'lighter'` if endurance is in and strength is not, else `'none'`.
  - `excludedByLimits(ex, parts): boolean` — true when any part's rule lists a slug in `ex.muscles.primary` and the exercise does not carry that rule's `safeTag`.
  - `blockedIds(s, catalogue): Set<string>` — `s.avoid` ∪ ids excluded by `s.limits.parts`.
  - `ALL_STEPS` (`type Step = 'goals' | 'about' | 'experience' | 'days' | 'session' | 'equipment' | 'weights' | 'limits' | 'plan'`) and `onboardingDone(s)` (`!!s.onboardedV2At`); everyone without `onboardedV2At` runs all nine.
  - `parseAbout(f: { sex: string; age: string; heightCm: string; weightKg: string }): Parsed<{ about: NonNullable<Settings['about']>; weightKg: number | null }>` — blanks allowed (all blank → `about: {}`, `weightKg: null`); out-of-range numbers → error naming the field and range.
  - `validateWeights(equipment, owned, ownedKettlebells): string | null` — error when Dumbbells is selected with no dumbbell weight, or Kettlebell with no kettlebell weight.

- [ ] **Step 1: Failing tests** in `profile.test.ts`: `goalsOf` (legacy `goal`, empty `goals`, default); `equipmentOf` (legacy owned → dumbbell); `blendGoals` (`['build-muscle','lose-fat']` → 2 sessions × 20 min, bias none; `['strength','endurance']` → bias none; `['strength']` → heavier); `excludedByLimits` (knee + squat with quadriceps primary → true; same with `tags: ['knee_safe']` → false; knee + curl → false); `blockedIds` unions avoid and limits; `onboardingDone` (Review Focus 1); `parseAbout` all blank → ok `{about:{}, weightKg:null}`, age `"7"` → error, `"180"` cm ok (Review Focus 2); `validateWeights` (Review Focus 4).
- [ ] **Step 2: Run** `npx vitest run src/domain/profile.test.ts` → FAIL. **Step 3: Implement. Step 4: Run** → PASS; `npm run typecheck` clean.
- [ ] **Step 5: Commit** `feat(profile): settings v2 model, goal blend, limits and onboarding rules`.

### Task 2: Wire goals, limits and equipment into the app

**Files:**
- Modify: `src/domain/template.ts`, `src/modules/training/data.ts` (`currentPlan` passes `blockedIds`), `src/modules/training/PlanScreen.tsx`, `src/modules/library/ExerciseInfo.tsx` + `sheet-context.ts` (avoid → blocked, adds `sex`), `src/modules/coach/actions.ts` / `domain/suggest.ts` (swap avoid set), `src/modules/ai/domain/request.ts`, `src/modules/ai/actions.ts`, `src/modules/library/ExerciseList.tsx`, tests next to each.

**Interfaces:**
- `TemplateInput.avoid` keeps its meaning (ids or names); callers pass `[...blockedIds(s, catalogue)]`.
- `summaryOf(s)` sends `goals: goalsOf(s)`, `equipment: equipmentOf(s)`, `limits: s.limits?.parts ?? []`, `limitsNote: (s.limits?.note ?? '').slice(0, PROFILE.limitsNoteMax)`; drops `goal`. Never `about` or bodyweight.
- `candidatesOf(catalogue, avoid)` receives the blocked set.
- `SheetContext` gains `sex: 'male' | 'female'` (default male); `ExerciseInfo` passes it to `BodyMap`.
- Library default kit chips: `['none', ...equipmentOf(settings)]`, read once on mount.

- [ ] **Step 1: Failing tests:** `template.test.ts` — with `avoid` from `blockedIds` for a knee limit, no quadriceps-primary candidate remains (Review Focus 3); `ai.test.ts` — summary has `goals` and `limits`, `limitsNote` is capped at 200, and still matches nothing in `/kg|birth|bodyweight|heightCm|age/`; `sheet-context.test.ts` — `blocked` includes limit-excluded ids and `sex` defaults to male.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS**, full `npm test` green.
- [ ] **Step 5: Commit** `feat(profile): limits, goals and equipment reach plans, swaps, AI and the library`.

### Task 3: Step components

**Files:**
- Create: `src/modules/onboarding/steps.tsx`
- Modify: `src/ui/ui.css`

**Interfaces** (each a controlled component; `value` + `onChange`, no saving inside):
- `GoalsStep({ value: Goal[]; onChange })` — `ChoiceCard` per goal with icon + one-line subtitle, multi-select (toggle).
- `AboutStep({ value: { sex; age; heightCm; weightKg }: strings; onChange })` — sex as `SegmentedControl` (Male / Female / Skip), three numeric inputs with units, a "Skip this" note.
- `ExperienceStep`, `SessionStep` — single-choice `ChoiceCard`s / chips (30, 45, 60, 75, 90 min).
- `DaysStep({ value: number; onChange })` — 1–7 number row (chips).
- `EquipmentStep({ value: EquipmentChoice[]; onChange })` — `ChipGroup` with icons, "Floor space and your body weight are always included".
- `WeightsStep({ grid: number[]; value: number[]; onChange; label })` — chip grid of the given weights plus two buttons, "Select all" and "Clear".
- `LimitsStep({ value: { parts: BodyPart[]; note: string }; onChange })` — `ChipGroup` of body parts, `textarea` (maxLength 200), the guidance-not-medical-advice line.
- Every step renders inside `StepFrame({ eyebrow, title, why, children })`: small label, headline, one "why we ask" line.

- [ ] **Step 1: Implement** with `src/ui` components only. **Step 2: Verify** typecheck/lint/build. **Step 3: Commit** `feat(onboarding): step components`.

### Task 4: Onboarding v2 flow and gate

**Files:**
- Modify: `src/modules/onboarding/Onboarding.tsx` (rewrite), `src/App.tsx` (gate uses `onboardingDone`)

**Interfaces:**
- Steps are `ALL_STEPS`; progress dots; fixed bottom bar with Back (ghost) and Continue (primary, disabled until the step is answerable: goals ≥ 1, equipment any, weights pass `validateWeights`). About and Limits are skippable.
- Each Continue saves the step's fields merged into the stored settings (fresh read, like `saveSettingsForm`). The about weight adds a bodyweight entry for today. The last v2 step sets `onboardedV2At`; a full run also sets `onboardedAt` after the plan step (existing `ProposePlan`).
- Pre-fill: goals from `goalsOf`, equipment from `equipmentOf`, weights from `owned`.
- App gate: redirect to `#/onboarding` when `!onboardingDone(s)`.

- [ ] **Step 1: Implement. Step 2: Verify** typecheck/lint/build; browser: a fresh profile runs nine steps; a profile with only `goal`, `owned`, `onboardedAt` (set via devtools) runs all nine, pre-filled.
- [ ] **Step 3: Commit** `feat(onboarding): v2 flow with multi-pick goals, equipment, weights grid and limits`.

### Task 5: Settings edits the same answers

**Files:**
- Modify: `src/modules/training/SettingsScreen.tsx`, `src/modules/training/validate.ts` + test

**Interfaces:**
- Settings gains Cards: Goals (`GoalsStep`), About you (`AboutStep`), Equipment (`EquipmentStep`), Weights (`WeightsStep` for dumbbells, and kettlebells when owned — replaces the comma textarea), Limits (`LimitsStep`). Each card saves on its own Save button via `saveProfilePatch(repo, patch)`.
- `saveProfilePatch(repo, patch: Partial<Settings>): Promise<Settings>` in `validate.ts` — merges into a fresh read; never touches `onboardedAt`, `onboardedV2At` or the plan.

- [ ] **Step 1: Failing test** for `saveProfilePatch` (keeps `onboardedAt`, `reminder`, unrelated fields; Review Focus 5). **Step 2: FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(settings): edit goals, about, equipment, weights and limits`.

### Task 6: Docs and close

- [ ] Update `docs/SPEC.md` §2 table (goals list, about, equipment, weights grid, limits) pointing at the design; PLAN.md U3 row; browser pass at 375 px (both onboarding paths, Settings cards, library default chips, sheet body figure follows sex); PR with the iPhone checklist and the two tables (goal blend, limits) for the user to review.
