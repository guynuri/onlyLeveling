# UX overhaul: design

Status: draft for approval. From the grill session of 2026-11-06. Builds on `docs/SPEC.md` (draft v1) and the
code on `main` at `5047261` (Phases 1–7, 9 and weekly review merged). Where this document and SPEC.md disagree,
this document wins and SPEC.md is updated in the first PR.

Decisions are marked **(user)** when the user made them and **(call)** when they are the author's call, open to
change.

## 1. Why

The logic works, but the app looks and feels like a developer tool. Specifically, from the user's first scan:

- Buttons are chunky, screens are cramped, and nothing was designed for a phone.
- Onboarding allows one pick per question and asks for weights and exclusions as typed comma lists.
- There is no visible way to generate a plan after onboarding.
- The library is an island: you cannot tap an exercise in your plan or workout to see how it is done.
- No pictures. 876 exercises (123 dumbbell) feels thin next to openGym.
- The Progress "body figure" is six rectangles, not a muscle diagram.

**Success** = the user opens the app on their iPhone and wants to train: the next workout is one tap away, every
exercise shows how it is done and which muscles it hits, and progress feels like levelling up a character.

**Anti-goals** (failure even if it works): media we have no licence for; a design that only works on a desktop
browser; a restyle that forces every screen to be rewritten again when the real visual design lands.

## 2. Scope

**In:** design foundation, navigation, onboarding, exercise library and media, plan screen (generate, templates,
edit, blocks), workout screen, cardio, home hub, progress (muscle map, bodyweight), game layer, a later restyle
phase.

**Out (user):** nutrition (stays Later), e1RM charts, screen wake lock, swipe actions on sets, preferred
weekdays, likes/dislikes in onboarding, Hebrew/RTL, GPS for cardio.

## 3. Exercise visuals and library

### 3.1 Media sources (user)
- **RepDB free tier** (`github.com/RepDB/exercise-dataset`, licence `LICENSE-DATA.md` v1.0): 701 exercises with
  512 px flat WebP start and peak images. Free for in-app use with a visible credit
  "Exercise data by RepDB (repdb.co)". No redistribution as a dataset; no generative-AI use of the images.
- **Consequence:** RepDB images and JSON are **never committed** to this public repo. The deploy workflow downloads
  them at build time (pinned URL + checksum) into the build output only. Local dev runs the same script into a
  gitignored folder. **(call)**
- **Hosting check (call):** RepDB's pricing page lists "bundling assets with your app, caching them, and hosting
  them on your own CDN" as ordinary use and forbids bulk redistribution (public archives, open buckets, bulk-download
  endpoints). So the images are served as individual app assets from GitHub Pages, with **no** zip, index page or
  listing endpoint, and the bundled metadata only includes the fields the app uses. Optional: the user emails
  support@repdb.co to confirm in writing.
- **No AI use of RepDB content (call):** the LLM prompt carries exercise ids and names only, never RepDB images,
  descriptions or tips.
- **Loop:** an exercise with start + peak images shows them crossfading on a loop (CSS only, ~1.2 s per pose,
  respects `prefers-reduced-motion` by showing the peak still). Single-pose exercises show one still.
- **Muscle highlight:** the MuscleMap body geometry (MIT, Melih Colpan, as converted in openGym
  `frontend/src/lib/body-paths.js`; male/female × front/back) is ported with its MIT notice into
  `docs/CREDITS.md`. Every exercise view shows the figure with primary muscles strong and secondary muscles light.
- **YouTube link:** "Watch a demo" opens a YouTube search for the exercise name. No embed.
- **Upgrade path:** the media component takes `{ stills?, clip? }`. RepDB Standard ($499, looping clips with muscle
  highlight) can drop in later by adding `clip`, with no screen changes. Not bought now (user).
- **Never:** Gym Visual media (openGym clips, hasaneyldrm/ExerciseDB GIFs), free-exercise-db photos.
  CLAUDE.md's licence table is corrected to say free-exercise-db photos are not used (DATA_SOURCES.md already says so).

### 3.2 Library composition (user: RepDB core + text extras)
- RepDB exercises are the core. Exercises from free-exercise-db (already imported) and openGym's catalogue
  (AGPL/MIT text, `reference/opengym/catalogue/exercises/*.json`, 757 dumbbell) that RepDB lacks are added as
  text-only entries. De-duplicated by normalised name plus an alias list.
- **IDs stay stable (call):** existing `fx_*` ids keep their id; a RepDB match attaches its media and text to that
  record. Unmatched RepDB entries get `rp_*` ids, openGym-only entries `og_*`. This keeps logged workouts, the XP
  benchmark table and avoid lists valid with no data migration.
- Every record keeps `source`, `license`, `author`, `sourceUrl` (CLAUDE.md). RepDB credit and MuscleMap MIT notice
  appear on the Credits screen.
- Plan building prefers exercises that have pictures when two candidates are otherwise equal.
- Muscle names from all three sources map onto (a) the body-map slugs and (b) the ten XP groups, in one table.

### 3.3 Equipment (user: all, user picks)
Supported: dumbbells, bodyweight, bench, pull-up bar, resistance/loop bands, kettlebell. Onboarding and Settings
ask which are owned (multi-select). Library, templates, AI plan validation and swaps only offer exercises whose
equipment is all owned. Dumbbell and kettlebell loads snap to owned weights; band and bodyweight exercises
progress on reps only (double progression without a weight step). SPEC §1's "dumbbells only" is replaced.

**XP for unweighted work (user: bodyweight fraction):** a bodyweight exercise counts as a share of the user's latest
bodyweight (e.g. push-up ≈ 0.65, pull-up ≈ 1.0; table in config, by exercise or by movement with a default); a band
set counts as a fixed per-band load from config. That effective load feeds the existing volume XP and strength-rank
maths unchanged. No bodyweight logged → a config default bodyweight is used and the UI asks for one.

**Timed exercises (call):** the exercise model gains `mode: 'reps' | 'time'`. Holds, stretches and mobility moves are
library exercises (RepDB stretches/mobility) in time mode; mobility blocks in a plan are 3–5 such exercises with a
duration each. Timed sets earn no muscle XP **(call)**.

## 4. Onboarding (user)

Steps, one per screen, each with a small label, a headline, one line on why it is asked, big tappable choice cards
or chips, progress dots and a fixed bottom Continue button:

1. **Goals** – multi-select, equal weight: build muscle, get stronger, lose fat, endurance, mobility, general health.
2. **About you** – sex, age, height, weight (weight is also the first bodyweight log entry). Sex picks the body
   figure (male/female). Optional, skippable.
3. **Experience** – as today.
4. **Days per week** – 1–7 number row.
5. **Session length** – quick chips (30/45/60/75/90 min).
6. **Equipment** – multi-select chips (§3.3).
7. **Weights you own** – a chip grid of common weights 1–50 kg; tap to toggle. Shown for dumbbells, and again for
   kettlebells if owned.
8. **Limits** – tappable body parts (shoulder, elbow, wrist, lower back, hip, knee, ankle, neck) plus optional free
   text. A body-part limit excludes exercises that load that joint (a mapping table in config) **(call)**; free text
   goes to the AI prompt only.
9. **Your plan** – block length (4/6/8/12 weeks), then Generate (AI → rules) or pick a starter template.

**Goal blending (call):** goals are a set, not a ranking. A deterministic table in `config/thresholds.ts` maps the
goal set to rep-range bias, weekly cardio minutes and whether mobility blocks are added. Example: muscle + strength
→ compounds 6–10, isolation 10–15 (today's table); + lose fat → 2 cardio sessions or post-lift blocks of 15–20 min;
+ mobility → a 5-minute mobility block per session. The user should check the table in review.

Settings migration: `goal` becomes `goals: Goal[]`; an old single value becomes a one-item list on read.

## 5. Plan (user)

- **Plan screen actions:** Generate / regenerate (AI proposes, rules validate, preview, accept), Starter templates
  (Full body, Upper/Lower, Push/Pull/Legs; filtered to owned equipment, loaded as editable plans), edit by hand.
- **Edit in place:** editing works wherever a plan or a session is shown (Plan screen, a session's detail, the
  pre-workout preview), not only in a separate editor: add from library, remove, reorder, change sets and rep range,
  swap.
- **Schedule:** rotation (A → B → C → A) by default **(call)**; fixed weekdays as an option in plan settings.
- **Blocks:** every plan has a length set at creation (4/6/8/12 weeks) and a start date. Home and Plan show
  "Week X of N" with a progress bar. The last week can be a planned deload (toggle, default on **(call)**; deload =
  existing deload factor from config). When the block ends, the app offers: review (weekly-review machinery) and
  build the next block, or extend.
- **Exercise links:** every exercise name in Plan, Workout and History opens the exercise sheet (§6.3).

## 6. Screens

### 6.1 Navigation (user)
Bottom tab bar with icons: **Home · Plan · ▶ · Progress · More**. ▶ starts or resumes the workout. More holds
Library, History, Settings, Credits. Hash routing stays (GitHub Pages).

### 6.2 Home – a hub (user)
Compact tiles, each tapping through to its screen:
- **Next workout** (short): session name, block "Week X of N", exercise thumbnails, mini front/back body map
  lighting the muscles it hits, Start button.
- **Level & XP** bar → Progress.
- **Streak** (with freezes) → Progress.
- **Coach** – count of open coach cards and the weekly review → the cards.
- Monthly recap card when a new month starts; weekly quests tile.

### 6.3 Exercise sheet
Bottom sheet opened from anywhere an exercise appears: media loop, muscle figure, instructions, tips (RepDB), your
last sessions and best set, Swap (same rules as coach swaps), Watch a demo, source and licence line.

### 6.4 Workout (user)
- **Focus view** by default, **list view** as a setting.
- The current exercise and current set are clearly highlighted; done sets are muted; upcoming are dimmed.
- Set rows with −/+ steppers that snap to owned weights; one tap ✓ confirms a pre-filled set (keeps the 3-tap rule).
- **RIR picker:** coloured scale 0–4+ with one plain line per level ("2 = could do 2 more").
- Rest timer as an overlay / pinned bar (existing wall-clock timer and push alert).
- **Live PR** badge when a set beats the exercise's best (existing `prs.ts`).
- **Finish summary:** duration, volume, PRs, XP earned, muscles hit on the body map, rank-ups.

### 6.5 Cardio (user)
Plans may include cardio days or post-lift cardio blocks when goals include lose fat or endurance. Log: type (run,
walk, bike, rower, jump rope, HIIT, other), duration, optional distance, optional effort 1–10. Saved and synced
like workouts. Earns XP by a duration × effort rule in config **(call)**; never toward muscle ranks.

**Streak (user: cardio fills a planned slot):** a plan's weekly session count includes its cardio days. A finished
cardio day is a finished session. A post-lift cardio block belongs to its lifting session and is not counted
separately. An unplanned extra cardio session earns XP but does not count toward the week's target.

### 6.6 Progress (user)
- **Muscle map**, front + back, sex from About you, two modes:
  - **Ranks:** each muscle coloured by its group's rank (F → SSS). The 18 drawn muscles map onto the 10 XP groups.
    Tap a muscle: rank, XP to next rank, its benchmark lift, exercises that train it.
  - **Recovery / neglect:** recently trained (still recovering) vs untrained for N days (thresholds in config).
- **Bodyweight chart** with a 7-day average trend line; log a weigh-in from here.
- Badges and streak detail stay.

### 6.7 Game layer (user)
- **Rank-up / level-up moments:** full-screen celebration (CSS animation, no media) after a session that ranks a
  muscle up or levels the user up.
- **Streak freezes:** earned (rule in config, e.g. one per 4 completed weeks, max 2 held **(call)**), auto-spent to
  protect the weekly streak through one missed week.
- **Weekly quests:** 2–3 small challenges per week generated by rules from the plan and recent history
  (e.g. "train back twice", "log RIR on every set", "one cardio session"), bonus XP. Deterministic, no AI.
- **Monthly recap:** card on the first open of a month: sessions, volume, PRs, XP, ranks gained, most-trained
  muscles; plus "where you are in your block".

## 7. Design system (user: foundation now, skin later; feel: game-like "leveling")

- **Foundation phase first:** tokens (colour, spacing, radius, type scale, shadows/glow) on `:root`, an icon set
  (inline SVG, MIT/ISC-licensed set such as Lucide **(call)**), and components: Button (primary/secondary/ghost,
  normal size, not full-width by default), Card, Tile, Chip/ChipGroup, ChoiceCard, Sheet, Stepper, SegmentedControl,
  ProgressBar, RankBadge, TabBar, Toast, EmptyState.
- **Feel:** dark first, deep background, one glowing accent, rank letters and XP bars prominent; light theme kept
  working. Mobile first: 375 px baseline, 16 px gutters, 44 px touch targets, safe areas, no horizontal scroll.
- **Rule for the later restyle:** screens use components and tokens only, never raw colours or ad-hoc sizes, so the
  restyle phase changes tokens and component CSS without touching screens.
- **Restyle phase (last):** the user brings inspirations; a drill-down session decides the look; the phase re-skins.

## 8. Constraints carried over

- AI suggests, rules decide (plan generation, goals blend, equipment and limits are validated by rules).
- Offline first; every new record type (goals, about-you, equipment, block, cardio, quests, freezes, recaps) saves
  locally first and syncs to D1 through the existing outbox; new D1 migrations follow the numbering in PLAN §3.4.
- Pure, tested domain functions for every new rule (blend table, limits filter, block week, quests, freezes, cardio
  XP, recap totals, equipment filter, library merge).
- Thresholds in config only. Non-medical wording on every suggestion and on the Limits step.
- Test on a real iPhone in standalone mode before a phase is called done.

**Existing data (call):** the user has not trained with the app yet, so no careful migration is needed, only safe
defaults. On first open after Onboarding v2 ships, an account missing the new fields sees only the new onboarding
steps (goals, about you, equipment, weights grid, limits), pre-filled from what exists (`goal` → `goals`, `owned`
→ dumbbell weights, equipment = dumbbells). An existing plan becomes a block of 8 weeks starting on the ship date.
Nothing is reset silently.

**Limits added later (call):** a new limit never edits the plan by itself. Exercises in the active plan that now
conflict show as coach cards proposing a swap (existing accept flow), and they never appear in new plans or swaps.

## 9. Proposed phase order (detail goes in the implementation plan)

1. Design foundation + tab bar + icons + exercise sheet shell.
2. Library: RepDB fetch-at-build, merge with free-exercise-db and openGym text, media loop, body map port.
3. Onboarding v2 + settings model (goals, about you, equipment, weights grid, limits).
4. Plan v2: generate button, templates, blocks, rotation, edit in place, cardio in plans.
5. Workout v2: focus/list, highlight, steppers, RIR picker, live PRs, finish summary, cardio logging.
6. Home hub + Progress v2 (muscle map modes, bodyweight chart).
7. Game layer: celebrations, freezes, quests, monthly recap.
8. Restyle from the user's inspirations.

## 10. Left to the builder

Component internals, file layout inside `src/modules/*`, exact animation timings, the alias list for de-duplication,
the joint-to-exercise limits table (reviewed by the user), quest wording, and the D1 schema for new records.
