# U2: Library and Media — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every exercise shows how it is done (RepDB start/peak loop, worked muscles on a front/back body map, tips, your history) and the library grows with RepDB and openGym exercises, without committing any RepDB file.

**Architecture:** One pure merge (`src/domain/catalogue-merge.ts`) builds the catalogue at app start from three inputs: the committed free-exercise-db JSON, a committed openGym text-only JSON, and a gitignored RepDB JSON that `scripts/fetch-repdb.ts` writes at build time (picked up with `import.meta.glob`, so the app and tests work without it). RepDB images are written to gitignored `public/media/repdb/` and cached at runtime by the service worker. The body map is MuscleMap geometry (MIT), ported from openGym and lazy-loaded.

**Tech Stack:** React 18 + TS + Vite PWA, Vitest (node), tsx for scripts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-06-ux-overhaul-design.md` §3, §6.3. Roadmap: `docs/PLAN.md` Wave 3, U2.

## Global Constraints

- RepDB (licence `LICENSE-DATA.md` v1.0): **never commit its JSON or images**; fetched at build at a pinned commit (`66c4298af8d99b9dc397dad6699e508fb871d249`) into gitignored paths; no zip, index page or listing endpoint in the build output; visible credit "Exercise data by RepDB (repdb.co)"; its images, descriptions and tips never reach an LLM (the AI prompt carries ids and names only).
- Existing `fx_*` ids never change (workouts, XP benchmarks and avoid lists keep working with no migration). New ids: `rp_<repdb id>`, `og_<opengym id>`.
- openGym: text only from `reference/opengym/catalogue/exercises/*.json`; never `catalogue/media`. Only `equipment === 'dumbbell'` entries that are not `variantOf` stubs and are not matched by an existing exercise.
- `primaryMuscles`/`secondaryMuscles` stay in free-exercise-db vocabulary for every source, so XP (`xp/domain/muscles.ts`) keeps working unchanged.
- Plans and swaps (U4 changes this) stay on exercises that need nothing but dumbbells or nothing at all: `isDumbbellCompatible` must reject anything whose `requires` holds bench, pull-up bar, band or kettlebell.
- Pictures are cached when viewed, not precached (≈13 MB); media must not enter the precache manifest.
- Tests + lint + typecheck + build green; iPhone standalone check before the phase is called done.

## Review Focus

1. **Build without RepDB** (fresh clone, CI test job, offline dev): the app and every test run with zero RepDB data, the library shows text-only entries → test in Task 3 (`exercises.ts` with no generated file).
2. **An fx exercise matched by RepDB** keeps its `fx_` id and its logged history, and gains media → test in Task 2.
3. **Reduced motion:** the loop never animates under `prefers-reduced-motion`; it shows the peak still → CSS in Task 5, manual check listed in the PR.
4. **A missing image file** (fetch skipped an image, cache evicted while offline) shows the body map and text, not a broken-image icon → handled in Task 5 (`onError` hides the media block).
5. **AI prompt** never contains RepDB descriptions, tips or image paths → test in Task 8.

---

### Task 1: Exercise model v2 and muscle tables

**Files:**
- Modify: `src/domain/exercise.ts`, `src/domain/exercise-import.ts`
- Create: `src/domain/muscle-map.ts`, `src/domain/muscle-map.test.ts`
- Test: `src/domain/exercise.test.ts`

**Interfaces:**
- Produces:
  - `type Kit = 'dumbbell' | 'kettlebell' | 'bench' | 'pullup_bar' | 'band'`
  - `type BodySlug = 'trapezius' | 'deltoids' | 'chest' | 'upper-back' | 'serratus' | 'biceps' | 'triceps' | 'forearm' | 'abs' | 'obliques' | 'lower-back' | 'gluteal' | 'quadriceps' | 'hamstring' | 'adductors' | 'hip-flexors' | 'calves' | 'tibialis'` (openGym's MUSCLES list).
  - `Exercise` gains: `requires: Kit[]` (empty = no equipment), `mode: 'reps' | 'time'`, `muscles: { primary: BodySlug[]; secondary: BodySlug[] }`, `media?: { stills: string[]; clip?: string }` (paths relative to the app base), `description?: string`, `tips?: string[]`, `unilateral?: boolean`, `variationGroup?: string`, `tags?: string[]`; `source` widens to `'free-exercise-db' | 'repdb' | 'opengym'`, `textSource` to the same union, `license` to `string`.
  - `isDumbbellCompatible(ex)` = `(equipment === 'dumbbell' || equipment === 'bodyweight') && requires.every(k => k === 'dumbbell')`.
  - In `muscle-map.ts`: `FX_TO_SLUG: Record<string, BodySlug[]>` (free-exercise names → slugs), `REPDB_TO_FX: Record<string, string>` and `REPDB_TO_SLUG: Record<string, BodySlug>` (all 32 RepDB muscle names), `OG_TARGET_TO_FX: Record<string, string>`, and `slugsOf(fxMuscles: readonly string[]): BodySlug[]` (deduped, order kept).
  - `mapFreeExercise` fills `requires` from equipment (`dumbbell`→`['dumbbell']`, `kettlebell`→`['kettlebell']`, `band`→`['band']`, `bodyweight`→`[]`, others `[]`), `mode: category === 'stretching' ? 'time' : 'reps'`, and `muscles` via `slugsOf`.

- [ ] **Step 1: Failing tests** in `src/domain/muscle-map.test.ts`:

```ts
it('maps every RepDB muscle name to a free-exercise name and a body slug', () => {
  const repdb = ['abductors','adductors','anterior_deltoid','biceps_brachii','brachialis','brachioradialis','erector_spinae','forearm_extensors','forearm_flexors','forearms','gastrocnemius','gluteus_maximus','gluteus_medius','hamstrings','hip_flexors','infraspinatus_teres_minor','lateral_deltoid','latissimus_dorsi','obliques','pectoralis_major','posterior_deltoid','quadratus_lumborum','quadriceps','rectus_abdominis','rhomboids','serratus_anterior','soleus','supraspinatus','tibialis_anterior','transverse_abdominis','trapezius','triceps_brachii'];
  for (const m of repdb) {
    expect(REPDB_TO_FX[m], m).toBeTruthy();
    expect(REPDB_TO_SLUG[m], m).toBeTruthy();
  }
});
it('maps every free-exercise muscle used for XP to at least one slug', () => {
  for (const m of ['chest','middle back','lower back','lats','traps','shoulders','biceps','triceps','quadriceps','hamstrings','glutes','calves','abdominals'])
    expect(slugsOf([m]).length, m).toBeGreaterThan(0);
});
it('slugsOf dedupes and keeps order', () => {
  expect(slugsOf(['lats', 'middle back'])).toEqual(['upper-back']);
});
```

and in `src/domain/exercise.test.ts`: `isDumbbellCompatible` is false for `{ equipment: 'dumbbell', requires: ['dumbbell', 'bench'] }` and true for `{ equipment: 'bodyweight', requires: [] }`.

- [ ] **Step 2: Run** `npx vitest run src/domain` → FAIL.
- [ ] **Step 3: Implement** the types, tables and `mapFreeExercise` changes; regenerate nothing yet (Task 3 reruns the import).
- [ ] **Step 4: Run** `npx vitest run src/domain` → PASS; `npm run typecheck` → clean (fix every `Exercise` literal in tests by adding the new required fields).
- [ ] **Step 5: Commit** `feat(library): exercise model v2 and muscle tables`.

### Task 2: Source mappers and the merge

**Files:**
- Create: `src/domain/catalogue-merge.ts`, `src/domain/catalogue-merge.test.ts`, `src/data/aliases.ts`

**Interfaces:**
- Consumes: Task 1 types and tables.
- Produces:
  - `interface RepdbRaw { id; name_en; description_en?; category; force_type?; mechanic?; difficulty?; equipment: string | null; primary_muscles?: string[]; secondary_muscles?: string[]; is_unilateral?; is_bodyweight?; instructions_en?: string[]; tips_en?: string[]; tags?: string[]; variation_group?: string; images: { flat?: { start?: string; peak?: string; main?: string } } }`
  - `interface OpengymRaw { id; name?; equipment?: string | null; target?; secondaryMuscles?: string[]; category?; description?; instructions?: string[]; needs?: string[]; hold?: boolean; variantOf?: string; textSource?: string; muscleMap?: { primaries: string[]; secondaries: string[] } }`
  - `REPDB_KIT: Record<string, Kit[] | null>` — `null` = unsupported equipment (dropped): `None/null`→`[]`, `dumbbell`→`['dumbbell']`, `kettlebell`→`['kettlebell']`, `pull_up_bar`→`['pullup_bar']`, `flat_bench`→`['bench']`, `loop_band`/`resistance_band`→`['band']`, everything else `null`. Tag `requires_bench` adds `'bench'`.
  - `mapRepdb(raw: RepdbRaw, mediaBase: string): Exercise | null` — id `rp_<id>`, `media.stills` = `[start, peak]` when both exist, else `[main]`, each prefixed with `mediaBase` and with `images/flat/` stripped; `mode: 'time'` for category `stretching`; muscles via the tables; `license: 'RepDB Free Tier License v1.0'`, `author: 'RepDB'`, `sourceUrl: 'https://repdb.co'`. Returns null for unsupported equipment.
  - `mapOpengym(raw: OpengymRaw): Exercise | null` — only `equipment === 'dumbbell'` and no `variantOf`; id `og_<id>`; `requires` = `['dumbbell']` plus `needs` mapped (`bench`→`'bench'`, `pull-up bar`→`'pullup_bar'`); `mode: hold ? 'time' : 'reps'`; `muscles` from `muscleMap` (filtered to `BodySlug`); `license: textSource === 'exercisedb' ? 'MIT (ExerciseDB text)' : 'AGPL-3.0 (openGym)'`; `sourceUrl: 'https://github.com/DuarteSantos8/openGym'`; name title-cased.
  - `normaliseName(name: string): string` — lowercase, `dumbbells?`→`dumbbell`, strip punctuation and the words `the`, `a`, collapse spaces.
  - `mergeCatalogue(fx: readonly Exercise[], repdb: readonly Exercise[], og: readonly Exercise[], aliases: Readonly<Record<string, string>>): Exercise[]` — for each RepDB entry: an fx entry with the same normalised name (or `aliases[rp id] === fx id`) gets RepDB's `media`, `tips`, `description`, `unilateral`, `variationGroup`, `tags`, `muscles` and `requires` (fx keeps its id, name, instructions and source); otherwise the RepDB entry is added. Then each og entry is added unless its normalised name matches anything already in. Order: fx, rp, og.
  - `ALIASES` in `src/data/aliases.ts`: `Record<rpId, fxId>`, starts empty with a comment on how to add.

- [ ] **Step 1: Failing tests** in `catalogue-merge.test.ts`, using small made-up fixtures (never real RepDB data):
  - `mapRepdb` drops `equipment: 'barbell'`; maps `pull_up_bar` → `requires: ['pullup_bar']`; `requires_bench` tag adds `'bench'`; start+peak → two stills under the base, `main` → one still.
  - `mapOpengym` drops a `variantOf` stub and a `cable` entry; maps `needs: ['bench']`; `hold: true` → `mode: 'time'`.
  - `normaliseName('Dumbbells Bench-Press')` equals `normaliseName('dumbbell bench press')`.
  - merge: an fx `Dumbbell Bench Press` and an rp `Dumbbell Bench Press` → one record, id `fx_…`, with the rp `media`; an alias links differently named records; an og record whose name matches an fx one is dropped; an unmatched rp record keeps `rp_` id.
- [ ] **Step 2: Run** `npx vitest run src/domain/catalogue-merge.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(library): RepDB and openGym mappers and catalogue merge`.

### Task 3: Data pipeline (scripts, runtime catalogue, deploy, service worker)

**Files:**
- Create: `scripts/fetch-repdb.ts`, `scripts/import-opengym.ts`, `src/data/opengym.json` (generated, committed)
- Modify: `src/data/exercises.ts` (the committed fx JSON is upgraded at load, so it is not regenerated), `src/data/catalogue.test.ts`, `.gitignore`, `.github/workflows/deploy.yml`, `src/sw.ts`, `src/domain/template.ts`, `package.json` (script `media`)

**Interfaces:**
- `scripts/fetch-repdb.ts`: downloads `exercises.json` at the pinned commit, checks its SHA-256 against a constant in the script (computed once when writing the script and pasted in), maps with `mapRepdb` to keep only supported exercises, writes `src/data/generated/repdb.json` (the mapped `Exercise[]`, no German/Spanish text) and downloads each referenced still into `public/media/repdb/` with 8 parallel requests, skipping files already present. Exit non-zero on any failed download. `npm run media` runs it.
- `scripts/import-opengym.ts <catalogue/exercises dir>`: writes `src/data/opengym.json` with `mapOpengym` results (text only).
- `src/data/exercises.ts`: `const generated = import.meta.glob('./generated/repdb.json', { eager: true, import: 'default' })`; the catalogue = `mergeCatalogue(fx.map(upgradeFx), repdbOrEmpty, opengym, ALIASES)`, where `upgradeFx` fills Task 1's new fields for the committed fx records (`requires`, `mode`, `muscles`). Read API unchanged: `listExercises()`, `getExercise(id)`.
- `.gitignore`: `src/data/generated/`, `public/media/`.
- `deploy.yml`: `npm run media` after `npm ci`, before `npm test`.
- `src/sw.ts`: a `fetch` listener for same-origin GETs under `media/repdb/`: cache-first in cache `repdb-media-v1`, network fallback that stores the response; other requests untouched. Confirm the precache manifest has no `.webp`.
- `template.ts` `candidates`: tie-break after compound-first by "has media" before id, so plans prefer exercises with pictures.

- [ ] **Step 1: Failing tests:** in `catalogue.test.ts` replace the "876 records" and "every record Unlicense" tests with: every `fx_` record keeps the Unlicense licence and `free-exercise-db` source; at least one `og_` record exists; every record's `muscles.primary` is non-empty unless its `primaryMuscles` is empty; no committed file under `src/data` except `generated/` contains `.webp` paths. Add to `template.test.ts`: with two otherwise equal candidates, the one with `media` comes first.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the scripts and the runtime merge; run `npx tsx scripts/import-opengym.ts ../../../reference/opengym/catalogue/exercises` and commit `src/data/opengym.json`; run `npm run media` locally (gitignored output).
- [ ] **Step 4: Run** `npm test`, then delete `src/data/generated/` and run `npm test` again → both PASS (Review Focus 1). `npm run build` → the precache list in `dist/sw.js` contains no `.webp`.
- [ ] **Step 5: Commit** `feat(library): build-time RepDB fetch, openGym text, merged catalogue, media cache`.

### Task 4: Body map

**Files:**
- Create: `src/ui/body/body-paths.js` (ported verbatim from `reference/opengym/frontend/src/lib/body-paths.js`, MIT header kept), `src/ui/body/BodyMap.tsx`
- Modify: `src/ui/ui.css`, `docs/CREDITS.md` (ported-file row + MuscleMap MIT notice)

**Interfaces:**
- `BodyMap(props: { primary: readonly BodySlug[]; secondary?: readonly BodySlug[]; sex?: 'male' | 'female'; size?: 'sm' | 'md' })` — front and back side by side; primary muscles filled `--accent`, secondary `--accent` at 40% opacity, others `--surface-2`, silhouette `--border`; geometry loaded with `import('./body-paths.js')` on first render and kept in a module cache; keeps its height while loading; `role="img"` with an `aria-label` listing the primary muscles.

- [ ] **Step 1:** Copy the file; add the CREDITS rows.
- [ ] **Step 2:** Implement `BodyMap` and CSS (`sm` 120 px tall for list rows/tiles, `md` 220 px for the sheet).
- [ ] **Step 3: Verify** `npm run typecheck && npm run lint && npm run build` → green; the geometry is its own chunk in `dist/assets`.
- [ ] **Step 4: Commit** `feat(ui): front/back body map (MuscleMap, MIT)`.

### Task 5: Exercise media

**Files:**
- Create: `src/ui/ExerciseMedia.tsx`
- Modify: `src/ui/ui.css`

**Interfaces:**
- `ExerciseMedia(props: { media?: Exercise['media']; name: string })` — `clip` → muted, looping, inline `<video>`; two stills → both stacked, the second fading in and out on a 2.4 s CSS loop; one still → that image; none → renders nothing. Images use `import.meta.env.BASE_URL + path`, `loading="lazy"`, `decoding="async"`, explicit 1:1 aspect ratio. Any `onError` hides the whole block (Review Focus 4). Under `prefers-reduced-motion: reduce` the loop stops on the peak still.

- [ ] **Step 1: Implement**; **Step 2: Verify** typecheck/lint/build; **Step 3: Commit** `feat(ui): exercise media loop`.

### Task 6: Exercise sheet v2

**Files:**
- Create: `src/modules/library/exercise-facts.ts`, `src/modules/library/exercise-facts.test.ts`
- Modify: `src/modules/library/ExerciseInfo.tsx`, `src/modules/library/ExerciseSheet.tsx`

**Interfaces:**
- `youtubeSearchUrl(name: string): string` → `https://www.youtube.com/results?search_query=` + `encodeURIComponent(name + ' exercise form')`.
- `recentSessions(workouts: readonly Workout[], id: string, n: number): { date: number; best: { w: number; r: number } }[]` — newest first, best = heaviest done set, ties by reps.
- `sourceLine(ex: Exercise): string` — "Text and pictures: RepDB (repdb.co) · RepDB Free Tier License" / "Text: openGym · AGPL-3.0" or "MIT (ExerciseDB text)" / "Text: free-exercise-db · Unlicense".
- `ExerciseInfo` order: `ExerciseMedia`, `BodyMap md`, tags (equipment from `requires`, mechanic, level, unilateral), description, "How to do it", tips, "Your last sessions" (up to 3, from the repo), Swap (only when the exercise is in the current plan: `pickSwap` → "Swap for X" → `replaceExercise` + `savePlan` + toast), "Watch a demo" link (`target="_blank" rel="noopener"`), source line.

- [ ] **Step 1: Failing tests** for the three pure functions (URL encodes spaces and `&`; sessions sorted newest first, best by weight then reps, skips sessions without that exercise; source line per source).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Verify** typecheck/lint/build. **Step 6: Commit** `feat(library): exercise sheet with media, body map, tips, history, swap, demo link`.

### Task 7: Library screen

**Files:**
- Create: `src/modules/library/filter.ts`, `src/modules/library/filter.test.ts`
- Modify: `src/modules/library/ExerciseList.tsx`, `src/ui/ui.css`

**Interfaces:**
- `filterLibrary(all: readonly Exercise[], q: { text: string; kit: readonly (Kit | 'none')[]; muscle: BodySlug | null }): Exercise[]` — text matches name or aliases (case-insensitive); `kit` empty = any, else every `requires` item must be in `kit` (`'none'` selects equipment-free); muscle matches `muscles.primary`; sort: has media first, then name.
- Screen: sticky search, equipment chips (None, Dumbbells, Kettlebell, Bench, Pull-up bar, Bands; default Dumbbells + None), muscle chips (the 18 slugs with plain names), rows with a 56 px first-still thumbnail (or a small body map when there is no picture), first 60 rows then "Show more". Rows still open `#/library/<id>`.

- [ ] **Step 1: Failing tests** for `filterLibrary` (kit subset rule incl. bench exclusion, `'none'`, muscle match, pictures first). **Step 2: FAIL. Step 3: Implement. Step 4: PASS.**
- [ ] **Step 5: Commit** `feat(library): search, equipment and muscle filters, pictures first`.

### Task 8: Credits, AI guard, docs, close

**Files:**
- Modify: `src/data/credits.ts`, `docs/CREDITS.md`, `docs/DATA_SOURCES.md`, `docs/PLAN.md`, `src/modules/ai/domain/ai.test.ts`

- [ ] **Step 1: Failing test** in `ai.test.ts`: a catalogue entry with `description`, `tips` and `media` produces a prompt (`buildPrompt(buildPlanRequest(...))`) that contains its name and none of those strings.
- [ ] **Step 2: Run** → should PASS already (guard, not a fix); if it fails, strip the fields at the request builder.
- [ ] **Step 3:** In-app credits: RepDB entry with the exact text "Exercise data by RepDB (repdb.co)" linked to `https://repdb.co`; MuscleMap (MIT, Melih Colpan); openGym catalogue text (AGPL-3.0 / MIT ExerciseDB). Docs updated to match; DATA_SOURCES gains a RepDB section (pinned commit, what is fetched, where it lands, why it is never committed).
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint && npm run build` green; browser pass at 375 px (sheet with loop + body map, library filters, offline reload shows a viewed exercise's pictures); U2 row in PLAN.md; PR with the iPhone checklist (Review Focus 3, offline pictures).
