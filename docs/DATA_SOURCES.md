# Data sources

Four sources plus one later phase. Checked against live docs and sample data on 2026-11-05.
Licences and field names follow CLAUDE.md.

**Rule for images (from CLAUDE.md):** free-exercise-db is used for structured data only. Its photos
are treated as unlicensed and never committed. Images come from wger (per-image author and licence)
and Everkinetic (CC-BY-SA, credit required). An exercise with no licensed image shows text only.

## 1. free-exercise-db: structured data only

Repo: `github.com/yuhonas/free-exercise-db`. Data licence: **Unlicense**. Image licence: **none
stated**, so its images are not used.

Fields used (schema: `schema.json`):

| Field | Type | Values / notes |
|---|---|---|
| `id` | string | `^[0-9a-zA-Z_-]+$`, e.g. `Alternate_Incline_Dumbbell_Curl` |
| `name` | string | |
| `force` | string or null | `static`, `pull`, `push`, null |
| `level` | string | `beginner`, `intermediate`, `expert` |
| `mechanic` | string or null | `isolation`, `compound`, null |
| `equipment` | string or null | `barbell`, `dumbbell`, `kettlebells`, `cable`, `machine`, `body only`, `bands`, `medicine ball`, `exercise ball`, `e-z curl bar`, `foam roll`, `other`, null |
| `category` | string | `powerlifting`, `strength`, `stretching`, `cardio`, `olympic weightlifting`, `strongman`, `plyometrics` |
| `primaryMuscles` / `secondaryMuscles` | string[] | `abdominals`, `abductors`, `adductors`, `biceps`, `calves`, `chest`, `forearms`, `glutes`, `hamstrings`, `lats`, `lower back`, `middle back`, `neck`, `quadriceps`, `shoulders`, `traps`, `triceps` |
| `instructions` | string[] | |

`images` is not read.

Coverage (measured): 876 exercises. 123 are dumbbell. Nulls: `equipment` 77, `mechanic` 87, `force` 30.

## 2. Everkinetic (images and text, CC-BY-SA)

Repo: `github.com/everkinetic/data`. Licence: **CC-BY-SA 4.0** (`LICENSE.md`). Attribution: "Open
data project based on http://everkinetic.com created by Greg Priday." Credit Everkinetic on the
Credits screen.

Format: `exercises.json` (293 entries), plus `map.json`. Fields per entry: `id`, `id_num`, `id_hex`,
`name`, `title`, `url`, `primer`, `type`, `primary`, `secondary[]`, `equipment[]`, `images[]`,
`img[]`, `steps[]`.

- `images[]` are **hotlinked URLs** on `img.everkinetic.com`. Copy them into our storage; never
  hotlink (CLAUDE.md).
- `img[]` are repo-relative paths (`_images/web/...`). Not verified that the files exist in the repo.
- `type` is `compound`, `isolation`, `isometric`, or combinations. Some are null.

Quality issues to clean on import:
- Typos in muscle names: `gluts`, `forerm`, `bicpes`, `should`, `hamstring` (singular).
- Comma-joined values: `triceps, biceps`, `shoulders, lats`, `neck extensors, neck flexors`. Split
  on commas, then map each part.
- Generic values: `arms`, `back`, `core`. Dropped, and each drop is written to the import log.
- Dumbbell spelling varies: `dumbbell` (67), `dumbbells` (23), `dumbell` (2). Normalised dumbbell
  count: **92** unambiguous, of which **90 have images**. One row, `barbell or dumbbell`, is ambiguous
  and is counted separately: with it, the total is **93** and **91 have images**. Its equipment is
  held for review.

## 3. wger exercise API (images and text, CC-BY-SA)

API: `https://wger.de/api/v2/exerciseinfo/`, paginated (`limit`, `offset`). Filter by equipment with
`?equipment=<id>`.

Exercise licence per exercise. Values seen: `CC-BY-SA 3`, `CC-BY-SA 4`, `CC0`.

Result fields used: `id`, `uuid`, `category` (`{id, name}`), `muscles` and `muscles_secondary`
(each `{id, name, name_en, is_front, image_url_main, image_url_secondary}`), `equipment` (`[{id,
name}]`), `license` (`{id, full_name, short_name, url}`), `license_author`, `images[]`,
`translations[]`.

Image fields: `id`, `uuid`, `image` (URL), `thumbnails`, `is_main`, `style`, `license` (**integer
id**), `license_title`, `license_object_url`, `license_author`, `license_author_url`,
`license_derivative_source_url`, `author_history`, `is_ai_generated`.

Image licence ids, from `/api/v2/license/`:

| id | licence |
|---|---|
| 1 | CC-BY-SA 3 |
| 2 | CC-BY-SA 4 |
| 3 | CC0 |
| 4 | CC-BY 4 |
| 5 | ODbL |

An id outside this list stops the import, the same rule as for muscles and equipment.

- Store each image's `license`, `author` and `sourceUrl` (from `license_object_url` /
  `license_author_url`).
- **`is_ai_generated`**: 6 of the 75 images in the dumbbell sample are AI-generated. Decide whether
  to show or exclude them before the import.

Translations: pick English by the `language` id (2 in the sample; confirm via `/api/v2/language/`).

Muscle and equipment mapping: see section 6.

Coverage for dumbbells (equipment id 3, 147 exercises): **54 have images**, 75 images in total.

## 4. USDA FoodData Central (food search and portions, CC0)

Docs: `fdc.nal.usda.gov/api-guide/`. Endpoints: `GET|POST /foods/search` (`query`, `dataType`
array, `sortBy`, `sortOrder`), `GET /food/{fdcId}`, `GET /foods` (by ids), `GET /foods/list`.

- **Licence: CC0.** Attribution is requested, not required. Credit FoodData Central.
- **API key required** (data.gov). Limit 1,000 req/hour per IP. `DEMO_KEY` is for trying it out
  only (30/hour, 50/day). The key lives in a Worker secret, never in the client.
- `dataType` values: `Foundation`, `SR Legacy`, `Survey (FNDDS)`, `Branded`, `Experimental`.

**Gap:** the API guide does not document the `foodPortions` field names (`gramWeight`,
`measureUnit`, `modifier`, `portionDescription`, `amount`). Check the OpenAPI spec before coding the
mapper.

**Hebrew names are not in USDA.** Starter foods get `nameHe`, which we write ourselves (decision 6).

## 5. Open Food Facts (later phase, not designed for now)

Packaged foods and barcodes. Data ODbL. Images CC BY-SA. Obligations: attribution on every screen
showing OFF data and a legal page, share-alike for derived databases, contribute back. Israeli
packaged foods are poorly covered, so every lookup miss must offer "create custom food". Out of MVP
scope. Nothing in the current model is designed around it.

## 6. Target model

Field names follow CLAUDE.md: `source`, `license`, `author`, `sourceUrl`. One record can mix sources:
the text and each image keep their own provenance.

```ts
Exercise {
  id: string                      // our id, e.g. "ex_<uuid>"
  name: string
  aliases: string[]
  equipment: 'barbell'|'dumbbell'|'kettlebell'|'cable'|'machine'|'bodyweight'|'band'|'other'|'unknown'
  force: 'push'|'pull'|'static'|null
  mechanic: 'compound'|'isolation'|null
  level: 'beginner'|'intermediate'|'expert'|null
  category: string
  primaryMuscles: Muscle[]        // canonical list (below)
  secondaryMuscles: Muscle[]
  movementPattern: Pattern|null   // OURS: squat, hinge, lunge, horizontal_push, vertical_push,
                                  // horizontal_pull, vertical_pull, carry, rotation, isolation
  instructions: string[]
  images: Image[]                 // empty = text only
  source: 'free-exercise-db'|'wger'|'everkinetic'|'custom'   // where the record was created from
  textSource: 'free-exercise-db'|'wger'|'everkinetic'|'custom' // where name, muscles, equipment, instructions came from
  license: string                 // licence of the TEXT (from textSource): 'Unlicense' | 'CC-BY-SA 3' | 'CC-BY-SA 4' | 'CC0' | 'custom'
  author: string | null           // author of the text
  sourceUrl: string | null        // page the text came from
}
// The Credits screen lists the text licence and the licence of every image.

Image {
  path: string                    // our storage, never the upstream URL
  source: 'wger'|'everkinetic'
  license: string                 // from the table in section 3, or 'CC-BY-SA 4' for Everkinetic
  author: string | null
  sourceUrl: string | null
}

Food {
  id: string
  name: string                    // English
  nameHe: string | null           // ours, written by us (decision 6)
  source: 'usda-fdc'|'custom'
  license: 'CC0' | 'custom'
  author: null
  sourceUrl: string               // fdc.nal.usda.gov link for the fdcId
  fdcId: number | null
  dataType: string | null
  per100g: { kcal, protein, carbs, fat, ... }
  portions: { label, gramWeight, amount }[]   // verify field names (section 4)
}
```

**Canonical muscles.** `Muscle` is this list and nothing else:

quadriceps, hamstrings, glutes, calves, adductors, abductors, abdominals, obliques, lower back,
middle back, lats, traps, chest, shoulders, biceps, triceps, forearms, neck (18).

**Mapping.** Each row lists every source value that maps to the canonical muscle. A source value with
no row fails the import. A canonical muscle with no value in a source is simply absent from that
source's exercises.

| Canonical | free-exercise-db | wger (`name_en`, else `name`) | Everkinetic (after cleaning) |
|---|---|---|---|
| quadriceps | `quadriceps` | `Quads` | `quadriceps` |
| hamstrings | `hamstrings` | `Hamstrings` | `hamstrings`, `hamstring` |
| glutes | `glutes` | `Glutes` | `gluts`, `glutes` |
| calves | `calves` | `Calves` (Gastrocnemius) | `calves` |
| adductors | `adductors` | — (none) | — (none seen) |
| abductors | `abductors` | — (none) | `hip abductors` |
| abdominals | `abdominals` | `Abs` | `abdominals`, `lower abdominals` |
| obliques | — (none) | `Obliquus externus abdominis` | `obliques` |
| lower back | `lower back` | — (none) | `lower back` |
| middle back | `middle back` | — (none) | `middle back` |
| lats | `lats` | `Lats` (Latissimus dorsi) | `lats` |
| traps | `traps` | `Trapezius` | `trapezius` |
| chest | `chest` | `Chest` (Pectoralis major) | `chest` |
| shoulders | `shoulders` | `Shoulders` (Anterior deltoid) | `shoulders`, `should`, `lateral deltoid`, `rear deltoid`, `posterior deltoid` |
| biceps | `biceps` | `Biceps` (Biceps brachii) | `biceps`, `bicpes` |
| triceps | `triceps` | `Triceps` (Triceps brachii) | `triceps` |
| forearms | `forearms` | — (none) | `forearm`, `forerm` |
| neck | `neck` | — (none) | `neck extensors`, `neck flexors`, `neck side flexors` |

Values the table drops on purpose, written to the import log: Everkinetic `arms`, `back`, `core`.

wger muscles with no canonical row, marked "not tracked" and not an error: `Brachialis`, `Serratus
anterior`, `Soleus`.

**Equipment.** The same fail-loudly rule applies. Any value not in the list below stops the import.

| Source value | Canonical |
|---|---|
| free-exercise-db `barbell`, `e-z curl bar` | `barbell` |
| free-exercise-db `dumbbell`; Everkinetic `dumbbell`, `dumbbells`, `dumbell` | `dumbbell` |
| free-exercise-db `kettlebells`; wger `Kettlebell`; Everkinetic `kettlebell` | `kettlebell` |
| free-exercise-db `cable`; Everkinetic `cable`, `cable machine` | `cable` |
| free-exercise-db `machine`; Everkinetic `machine`, `smith machine`, `t-bar machine`, `butterfly machine`, `chest machine`, `bench press machine` | `machine` |
| free-exercise-db `body only`; Everkinetic `body` | `bodyweight` |
| free-exercise-db `bands`; Everkinetic `band`, `bands`, `exercise band` | `band` |
| free-exercise-db `medicine ball`, `exercise ball`, `foam roll`, `other`; Everkinetic `swiss ball`, `exercise ball`, `stability ball`, `bosu ball`, `balance board`, `medicine ball`, `v-bar`, `parallel bars`, `weight plate`, `weight`, `bar` | `other` |
| Everkinetic `bench`, `flat bench`, `incline bench`, `decline bench`, `hyperextension bench` | not equipment: "not tracked" |
| Everkinetic `barbell or dumbbell` | held for review (section 2) |
| free-exercise-db null; Everkinetic empty | `unknown` |

wger equipment ids: 1 barbell, 2 SZ-bar, 3 dumbbell, 4 gym mat, 5 Swiss ball, 6 pull-up bar,
7 bodyweight, 8 bench, 9 incline bench, 10 kettlebell, 11 resistance band, 12 cable machine.
Map them the same way: `SZ-bar` → `barbell`, `gym mat` / `pull-up bar` → `other`, `bench` /
`incline bench` → not tracked, `resistance band` → `band`.

## 7. Gaps and what we must add ourselves

1. **Dumbbell images.** Dumbbells are covered: 91 of 93 normalised Everkinetic dumbbell exercises
   have images (90 of 92 unambiguous), plus 54 of 147 on wger. Overlap between them is unknown until we
   match names. The free-exercise-db dumbbell photos are no longer a source.
2. **Image quality.** Everkinetic image URLs need to be copied to our storage. wger has 6 AI-generated
   images in the dumbbell sample; decide the policy before import.
3. **Movement pattern.** No source has squat, hinge, push or pull as a pattern. We tag it ourselves
   (`movementPattern`), probably one labelling pass with review. The "same movement pattern" swap
   rule in CLAUDE.md depends on it.
4. **Vocabularies.** Three muscle and equipment vocabularies, plus Everkinetic typos and
   comma-joined values. A cleaning step with a logged mapping, as in section 6.
5. **Null fields.** Nulls in free-exercise-db (up to 87 per field) and gaps in Everkinetic. Store
   null, don't guess. The UI says "unknown".
6. **Food portions.** Branded and Foundation portions differ. Some foods have none, so the app needs
   a grams input.
7. **Hebrew names.** `nameHe` is ours to write (decision 6). Nothing upstream provides it.
8. **Language.** English only for the first pass.
