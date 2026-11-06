# U1: Design Foundation, Navigation, Exercise Sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a game-like, mobile-first design system, the new Home · Plan · ▶ · Progress · More tab bar, and an exercise sheet that opens from every exercise name, without rewriting the screens later phases replace.

**Architecture:** Design tokens live on `:root` in `src/styles.css`; shared components live in `src/ui/` with their CSS in `src/ui/ui.css`. Screens use components and tokens only, so U8's restyle touches `src/styles.css` and `src/ui/` alone. Navigation stays hash-routed (`src/app/route.ts`). The exercise sheet is opened by a window event so any screen can open it without prop drilling.

**Tech Stack:** React 18 + TypeScript + Vite PWA, Vitest (node environment: pure helpers are tested, components are checked by build + iPhone), `lucide-react` for icons (new dependency).

**Spec:** `docs/superpowers/specs/2026-11-06-ux-overhaul-design.md` §6.1, §6.3, §7. Roadmap: `docs/PLAN.md` "Wave 3", U1.

## Global Constraints

- Feel: dark first, deep background, one glowing accent, rank letters and XP bars prominent; light theme keeps working (`prefers-color-scheme` + `data-theme`).
- Mobile first: 375 px baseline, 16 px side gutters, touch targets ≥ 44 px, `env(safe-area-inset-*)` respected, no horizontal page scroll.
- Buttons are normal size, not full-width by default (the user called the current ones "chunky").
- After this phase, screens contain no raw colours (`#…`, `rgb(`) and no ad-hoc pixel sizes in inline styles; only tokens and `src/ui/` components.
- Hash routing only (GitHub Pages). Tests + lint + typecheck + build green before the PR. Check on a real iPhone in standalone mode.
- Do not touch `Onboarding.tsx`, `WorkoutScreen.tsx` internals, `ProgressScreen.tsx`, `BodyFigure.tsx` beyond what a task names: U3, U5 and U6 rewrite them.
- New dependency versions are pinned exactly and were published at least two weeks before install.

## Review Focus

1. **Old links `#/today`** (onboarding redirect, push-notification click URLs, bookmarks) must still land on Home, not on an unknown-route fallback → test in Task 4.
2. **Tab highlight on sub-screens:** Library, History, Settings, Credits and an exercise detail must highlight More; onboarding highlights Home → test in Task 4.
3. **Stepper at the ends of the owned list:** − at the lightest bell and + at the heaviest stay put; an empty owned list falls back to the numeric step and never goes below 0 → tests in Task 3.
4. **Sheet on iOS:** opening the exercise sheet over a scrolled page must not scroll the page behind it, and it must close by the close button and by tapping the backdrop → manual check in Task 5 (listed in the PR's iPhone checklist).
5. **An unknown exercise id** passed to the sheet (deleted or renamed exercise in old history) shows "Exercise not found" instead of crashing → handled in Task 5 by reusing the existing not-found branch.

---

### Task 1: Tokens and base styles

**Files:**
- Modify: `src/styles.css` (full rewrite of the token block and base rules; keep the existing class names working until Tasks 6–7 migrate them)

**Interfaces:**
- Produces (CSS custom properties on `:root`, used by every later task):
  - Colour: `--bg`, `--surface`, `--surface-2`, `--border`, `--fg`, `--muted`, `--accent`, `--accent-glow`, `--on-accent`, `--danger`, `--success`, `--warn`, and `--rank-F`, `--rank-E`, `--rank-D`, `--rank-C`, `--rank-B`, `--rank-A`, `--rank-S`, `--rank-SS`, `--rank-SSS`.
  - Space: `--s-1` 4px, `--s-2` 8px, `--s-3` 12px, `--s-4` 16px, `--s-5` 24px, `--s-6` 32px.
  - Radius: `--r-sm` 8px, `--r-md` 12px, `--r-lg` 20px, `--r-pill` 999px.
  - Type: `--font`, `--fs-xs` .75rem, `--fs-sm` .875rem, `--fs-md` 1rem, `--fs-lg` 1.25rem, `--fs-xl` 1.75rem, `--fs-xxl` 2.5rem; `--fw-bold` 700.
  - Effects: `--glow` (accent box-shadow), `--shadow` (card shadow), `--tap` 44px, `--tabbar-h` 64px.

- [ ] **Step 1: Write the token block.** Dark values are the default on `:root`; light values go under `@media (prefers-color-scheme: light) { :root:not([data-theme='dark']) {…} }` and again under `:root[data-theme='light']`. Accent is a saturated electric blue/violet with `--accent-glow` as the same hue at ~45% alpha. Rank colours climb from grey (F) through green, blue, purple to gold (S+).
- [ ] **Step 2: Write base rules.** `body` uses `--bg`/`--fg`/`--font`; `.content` gets `padding: var(--s-4)` plus `padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + var(--s-4))`; headings use the type scale; `a` uses `--accent`; `:focus-visible` shows a 2px accent outline; `@media (prefers-reduced-motion: reduce)` disables transitions and animations globally.
- [ ] **Step 3: Re-point existing classes at tokens** (`.muted`, `.small`, `.error`, `.field`, `.row`, `.rest`, `.exercise-card`, etc.) so nothing on screen loses its styling before migration. Replace every hex value in the file outside the token block with a token.
- [ ] **Step 4: Verify.** Run `npm run build` → succeeds. Run `npm run dev`, open at 375 px width in a browser and in light and dark mode → every existing screen renders with no horizontal scroll.
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): game-like design tokens and base styles"`.

### Task 2: Primitive components

**Files:**
- Create: `src/ui/select.ts`, `src/ui/select.test.ts`, `src/ui/primitives.tsx`, `src/ui/ui.css`
- Modify: `src/main.tsx` (import `./ui/ui.css` after `./styles.css`)

**Interfaces:**
- Produces:
  - `toggleIn<T>(list: readonly T[], v: T): T[]` — removes `v` if present, else appends it; returns a new array.
  - `pct(value: number, max: number): number` — `value / max * 100` clamped to `[0, 100]`; `max <= 0` → `0`.
  - Components (named exports from `src/ui/primitives.tsx`):
    - `Button(props: { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; block?: boolean; icon?: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>)` — default `variant='primary'`, `type='button'`, not full width unless `block`.
    - `Card(props: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string })`
    - `Tile(props: { href: string; icon?: React.ReactNode; label: string; value?: React.ReactNode; badge?: number })` — a link; `badge` renders a count bubble when `> 0`.
    - `Chip(props: { selected: boolean; onToggle: () => void; children: React.ReactNode })` — `aria-pressed`.
    - `ChipGroup<T extends string | number>(props: { options: readonly { value: T; label: string }[]; value: readonly T[]; onChange: (next: T[]) => void; label: string })` — uses `toggleIn`; `role="group"` + `aria-label`.
    - `ChoiceCard(props: { selected: boolean; onSelect: () => void; title: string; sub?: string; icon?: React.ReactNode })`
    - `ProgressBar(props: { value: number; max: number; label?: string })` — uses `pct`; `role="progressbar"` with `aria-valuenow`.
    - `RankBadge(props: { rank: string })` — letter on `var(--rank-<rank>)` with `--glow` for S and above.
    - `EmptyState(props: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode })`

- [ ] **Step 1: Write the failing tests** in `src/ui/select.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toggleIn, pct } from './select';

describe('toggleIn', () => {
  it('adds a missing value and removes a present one', () => {
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('does not mutate the input', () => {
    const list = ['a'];
    toggleIn(list, 'b');
    expect(list).toEqual(['a']);
  });
});

describe('pct', () => {
  it('clamps to 0..100', () => {
    expect(pct(50, 200)).toBe(25);
    expect(pct(300, 200)).toBe(100);
    expect(pct(-5, 200)).toBe(0);
  });
  it('is 0 when max is 0 or negative', () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(5, -1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/ui/select.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `toggleIn` and `pct` in `src/ui/select.ts`.
- [ ] **Step 4: Run** `npx vitest run src/ui/select.test.ts` → PASS.
- [ ] **Step 5: Implement the components** in `src/ui/primitives.tsx` with class names prefixed `ui-` (e.g. `ui-btn ui-btn--primary`), styled in `src/ui/ui.css` with tokens only. Every interactive element is at least `var(--tap)` tall. Primary button: accent background, `--on-accent` text, `--glow` on hover/active.
- [ ] **Step 6: Verify** `npm run typecheck && npm run lint` → clean.
- [ ] **Step 7: Commit** — `git add src/ui src/main.tsx && git commit -m "feat(ui): primitive components"`.

### Task 3: Interactive controls

**Files:**
- Create: `src/ui/stepper.ts`, `src/ui/stepper.test.ts`, `src/ui/controls.tsx`
- Modify: `src/ui/ui.css`

**Interfaces:**
- Consumes: `stepOwned(ws: readonly number[], w: number, dir: 1 | -1): number` from `src/domain/dumbbells.ts`.
- Produces:
  - `stepValue(current: number, dir: 1 | -1, opts: { values?: readonly number[]; step?: number; min?: number; max?: number }): number` — with a non-empty `values` list, delegates to `stepOwned`; otherwise `current + dir * (step ?? 1)`; the result is always clamped to `[min ?? 0, max ?? Infinity]`.
  - Components (named exports from `src/ui/controls.tsx`):
    - `Stepper(props: { value: number; onChange: (v: number) => void; label: string; unit?: string; values?: readonly number[]; step?: number; min?: number; max?: number })` — −/value/+, buttons ≥ 44 px, uses `stepValue`.
    - `SegmentedControl<T extends string>(props: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string })` — `role="radiogroup"`.
    - `Sheet(props: { open: boolean; onClose: () => void; title: string; children: React.ReactNode })` — a native `<dialog>` opened with `showModal()`, styled as a bottom sheet (max-height 90dvh, rounded top, safe-area bottom padding, internal scroll); closes on Escape, the close button, and a backdrop click; while open, `document.body` gets `overflow: hidden`.
    - `ToastHost()` and `toast(message: string): void` — `toast` dispatches `new CustomEvent('ui-toast', { detail: message })`; `ToastHost` shows the latest message for 3 s above the tab bar with `role="status"`.

- [ ] **Step 1: Write the failing tests** in `src/ui/stepper.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stepValue } from './stepper';

const owned = [4, 6, 8, 12];

describe('stepValue', () => {
  it('moves to the next owned weight', () => {
    expect(stepValue(6, 1, { values: owned })).toBe(8);
    expect(stepValue(8, -1, { values: owned })).toBe(6);
  });
  it('stays put at the ends of the owned list', () => {
    expect(stepValue(12, 1, { values: owned })).toBe(12);
    expect(stepValue(4, -1, { values: owned })).toBe(4);
  });
  it('uses the numeric step when there is no owned list', () => {
    expect(stepValue(10, 1, { step: 2.5 })).toBe(12.5);
    expect(stepValue(10, -1, { values: [] })).toBe(9);
  });
  it('never goes below min', () => {
    expect(stepValue(0, -1, {})).toBe(0);
    expect(stepValue(5, -1, { step: 10, min: 1 })).toBe(1);
  });
  it('never goes above max', () => {
    expect(stepValue(7, 1, { min: 1, max: 7 })).toBe(7);
    expect(stepValue(1, -1, { min: 1, max: 7 })).toBe(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/ui/stepper.test.ts` → FAIL (module not found). (`stepOwned` already returns the input at either end.)
- [ ] **Step 3: Implement** `stepValue` in `src/ui/stepper.ts`.
- [ ] **Step 4: Run** `npx vitest run src/ui/stepper.test.ts` → PASS.
- [ ] **Step 5: Implement the components** in `src/ui/controls.tsx` and their CSS in `src/ui/ui.css`.
- [ ] **Step 6: Verify** `npm run typecheck && npm run lint` → clean.
- [ ] **Step 7: Commit** — `git add src/ui && git commit -m "feat(ui): stepper, segmented control, sheet, toast"`.

### Task 4: Routes, tab bar and More screen

**Files:**
- Modify: `src/app/route.ts`, `src/app/route.test.ts`, `src/App.tsx`, `src/modules/onboarding/Onboarding.tsx` (only the `'#/today'` redirect → `'#/home'`), `src/sw.ts` (`APP_URL`), `package.json` / `package-lock.json` (add `lucide-react`), `docs/CREDITS.md`
- Create: `src/app/MoreScreen.tsx`

**Interfaces:**
- Produces:
  - `type Route = { screen: 'home' } | { screen: 'plan' } | { screen: 'workout' } | { screen: 'progress' } | { screen: 'more' } | { screen: 'library' } | { screen: 'exercise'; id: string } | { screen: 'history' } | { screen: 'settings' } | { screen: 'credits' } | { screen: 'onboarding' }`
  - `parseRoute(hash: string): Route` — `''`, unknown and `'today'` → `{ screen: 'home' }`; the other names map one to one; `library/<id>` keeps its current decoding and malformed-escape behaviour.
  - `tabFor(route: Route): 'home' | 'plan' | 'workout' | 'progress' | 'more'` — moved from `App.tsx` to `route.ts` and exported. `library`, `exercise`, `history`, `settings`, `credits` → `'more'`; `onboarding` → `'home'`; the five tab screens map to themselves.

- [ ] **Step 1: Update the tests** in `src/app/route.test.ts`: change the import to `import { parseRoute, tabFor } from './route';`, change the existing "defaults to today" expectations to `{ screen: 'home' }`, and add:

```ts
it('old #/today links land on home', () => {
  expect(parseRoute('#/today')).toEqual({ screen: 'home' });
});

it('maps the new tab screens', () => {
  expect(parseRoute('#/workout')).toEqual({ screen: 'workout' });
  expect(parseRoute('#/progress')).toEqual({ screen: 'progress' });
  expect(parseRoute('#/more')).toEqual({ screen: 'more' });
});

describe('tabFor', () => {
  it('highlights More for its sub-screens', () => {
    for (const r of [{ screen: 'library' }, { screen: 'history' }, { screen: 'settings' }, { screen: 'credits' }, { screen: 'exercise', id: 'x' }] as const)
      expect(tabFor(r)).toBe('more');
  });
  it('highlights Home during onboarding and the tab itself otherwise', () => {
    expect(tabFor({ screen: 'onboarding' })).toBe('home');
    expect(tabFor({ screen: 'workout' })).toBe('workout');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/app/route.test.ts` → FAIL.
- [ ] **Step 3: Implement** the new `Route`, `parseRoute` and `tabFor` in `src/app/route.ts`.
- [ ] **Step 4: Run** `npx vitest run src/app/route.test.ts` → PASS.
- [ ] **Step 5: Add `lucide-react`** at an exact version published ≥ 2 weeks ago (`npm install --save-exact lucide-react@<version>`). Add a "Libraries" row to `docs/CREDITS.md`: Lucide icons, ISC, https://lucide.dev.
- [ ] **Step 6: Rebuild the shell in `src/App.tsx`.** Tabs, in order, each an icon + label link, with `aria-current="page"` on `tabFor(route)`: Home (`House`, `#/home`), Plan (`ClipboardList`, `#/plan`), ▶ (`Play` in a raised round accent button with `--glow`, label "Train", `#/workout`), Progress (`TrendingUp`, `#/progress`), More (`Menu`, `#/more`). The tab bar is fixed to the bottom with height `--tabbar-h` + safe-area padding. The top bar keeps the sync label. Screens: `home` and `workout` both render `WorkoutScreen` until U6 (add a `// U6 replaces Home` comment); `more` renders `MoreScreen`. Mount `<ToastHost />` once.
- [ ] **Step 7: Create `src/app/MoreScreen.tsx`:** a list of `Tile`s for Library (`BookOpen`), History (`History`), Settings (`Settings`), Credits (`Info`).
- [ ] **Step 8: Change the onboarding redirect** from `'#/today'` to `'#/home'`, and `APP_URL` in `src/sw.ts` (notification click target) from `#/today` to `#/home`. Then `grep -rn "#/today" src worker` → only the alias test in `route.test.ts` remains.
- [ ] **Step 9: Verify** `npm test && npm run typecheck && npm run lint && npm run build` → all green.
- [ ] **Step 10: Commit** — `git add src/app src/App.tsx src/modules/onboarding/Onboarding.tsx src/sw.ts package.json package-lock.json docs/CREDITS.md && git commit -m "feat(nav): Home · Plan · Train · Progress · More tab bar"`.

### Task 5: Exercise sheet shell

**Files:**
- Create: `src/modules/library/ExerciseInfo.tsx`, `src/modules/library/ExerciseSheet.tsx`, `src/modules/library/open-exercise.ts`
- Modify: `src/modules/library/ExerciseDetail.tsx`, `src/App.tsx`, `src/modules/training/PlanScreen.tsx`, `src/modules/training/WorkoutScreen.tsx` (exercise name only), `src/modules/training/HistoryScreen.tsx`, `src/modules/coach/CoachCards.tsx` (exercise names only)

**Interfaces:**
- Produces:
  - `OPEN_EXERCISE_EVENT = 'open-exercise'` and `openExercise(id: string): void` in `open-exercise.ts` — dispatches `new CustomEvent(OPEN_EXERCISE_EVENT, { detail: id })` on `window`.
  - `ExerciseInfo(props: { id: string })` — the body of today's `ExerciseDetail` (facts, instructions, source line); for an unknown id it renders only "Exercise not found." with no link. The "Back to the library" link stays in `ExerciseDetail`. U2 adds media, body map, tips, history and Swap here.
  - `ExerciseSheet()` — listens for `OPEN_EXERCISE_EVENT`, renders `Sheet` titled with the exercise name (or "Exercise") containing `ExerciseInfo`; closes on `hashchange` (a tapped link or browser Back must not leave the modal on top); one instance mounted in `App`.
  - `ExerciseName(props: { id: string; name: string })` — exported from `ExerciseSheet.tsx`; a text-styled button calling `openExercise(id)`.

- [ ] **Step 1: Extract `ExerciseInfo`** from `ExerciseDetail.tsx`; `ExerciseDetail` becomes a back link plus `<ExerciseInfo id={id} />`. Restyle the facts list as a `Card` with chips for equipment, mechanic and level.
- [ ] **Step 2: Implement** `open-exercise.ts`, `ExerciseSheet` and `ExerciseName`; mount `<ExerciseSheet />` in `App`.
- [ ] **Step 3: Replace plain exercise names** with `<ExerciseName …/>` in `PlanScreen.tsx`, `WorkoutScreen.tsx` (the `<h2>{name}</h2>` heading only), `HistoryScreen.tsx` and `CoachCards.tsx` (the card heading and the swap target's name). In the library list, rows keep navigating to the `#/library/<id>` detail page.
- [ ] **Step 4: Verify** `npm run typecheck && npm run lint && npm run build` → green. Manual: in `npm run dev` at 375 px, tap a name in Plan, Workout and History → the sheet opens; it closes via the close button, the backdrop and Escape; the page behind does not scroll; tapping the source link or browser Back closes it; `openExercise('missing')` from the console shows "Exercise not found".
- [ ] **Step 5: Commit** — `git add src/modules/library src/App.tsx src/modules/training/PlanScreen.tsx src/modules/training/WorkoutScreen.tsx src/modules/training/HistoryScreen.tsx src/modules/coach/CoachCards.tsx && git commit -m "feat(library): exercise sheet from every exercise name"`.

### Task 6: Move Settings and push settings onto components

**Files:**
- Modify: `src/modules/training/SettingsScreen.tsx`, `src/modules/push/ui/PushSettings.tsx`, `src/styles.css` (delete rules no longer used)

**Interfaces:**
- Consumes: `Button`, `Card`, `SegmentedControl`, `Stepper`, `toast` from `src/ui/`.

- [ ] **Step 1: Restructure Settings** into `Card` sections (Training, Account & sync, Notifications, Data). Days per week and rest seconds use `Stepper` (days `min: 1, max: 7`, matching `parseSettingsForm`; rest step 15 s, min 0). Theme uses `SegmentedControl` with System / Dark / Light; it sets `document.documentElement.dataset.theme` (removed for System) and saves the choice in `localStorage` key `theme`, read in a try/catch on start in `main.tsx`. Save confirmations use `toast`. Owned weights stay as they are (U3 replaces them with the chip grid).
- [ ] **Step 2: Restyle `PushSettings`** with `Card` + `Button`.
- [ ] **Step 3: Delete** CSS rules in `src/styles.css` that no screen uses any more (`grep -rn "className=\"<name>" src` returns nothing).
- [ ] **Step 4: Verify** `npm test && npm run typecheck && npm run lint && npm run build` → green; manual: Settings at 375 px in dark and light mode, theme switch persists across reload.
- [ ] **Step 5: Commit** — `git commit -am "feat(settings): settings on the design system, theme switch"`.

### Task 7: Move the remaining kept screens onto components

**Files:**
- Modify: `src/modules/training/HistoryScreen.tsx`, `src/modules/training/PlanScreen.tsx`, `src/modules/library/ExerciseList.tsx`, `src/modules/library/CreditsScreen.tsx`, `src/modules/coach/CoachCards.tsx`, `src/modules/review/ui/WeeklyReview.tsx`, `src/modules/ai/ui/ProposePlan.tsx`, `src/modules/ai/ui/CopyPasteFallback.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `Button`, `Card`, `EmptyState`, `Chip` from `src/ui/`; `ExerciseName` from Task 5.

- [ ] **Step 1: History** — each workout as a `Card` (date, duration, exercise names via `ExerciseName`, sets summary); `EmptyState` when there are none, with a Button to `#/workout`.
- [ ] **Step 2: Plan** — each day as a `Card` with its exercises as rows; the plan proposal (`ProposePlan`, `CopyPasteFallback`) uses `Card` + `Button`. No new plan features (U4).
- [ ] **Step 3: Library list** — search input styled with tokens, rows with equipment `Chip`s (display only), sticky search at the top.
- [ ] **Step 4: Credits, coach cards, weekly review** — `Card` + `Button`; coach-card actions are `secondary`/`ghost` buttons side by side, not stacked full-width.
- [ ] **Step 5: Delete** unused CSS from `src/styles.css`, then confirm no raw colours remain in screens: `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(" src --include=*.tsx` → matches only in `src/ui/` or none; `grep -rn "style={{" src --include=*.tsx` → any remaining inline style uses tokens only (`var(--…)`).
- [ ] **Step 6: Verify** `npm test && npm run typecheck && npm run lint && npm run build` → green; manual pass over every screen at 375 px, dark and light.
- [ ] **Step 7: Commit** — `git commit -am "feat(ui): history, plan, library, credits and cards on the design system"`.

### Task 8: Phase close

**Files:**
- Modify: `docs/PLAN.md` (U1 status row)

- [ ] **Step 1: Run** `npm test && npm run typecheck && npm run lint && npm run build` → all green; paste the summary lines into the PR description.
- [ ] **Step 2: iPhone check** (installed to Home Screen, standalone): tab bar clears the home indicator; every tab reachable one-handed; exercise sheet opens and closes from Plan, Workout and History without scrolling the page behind it; theme switch works; no horizontal scroll on any screen. Record the result.
- [ ] **Step 3: Update** the U1 row in `docs/PLAN.md` §4 to `merged (PR #…); iPhone check done|not done`.
- [ ] **Step 4: Commit and open the PR** against `main` with the iPhone checklist from Review Focus items 4 and 5.
