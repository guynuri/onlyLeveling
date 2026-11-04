# Data sources

Three sources, checked against their live docs and sample data on 2026-11-05. Counts for
free-exercise-db come from its `dist/exercises.json` (876 entries).

## 1. free-exercise-db (exercises, offline JSON)

Repo: `github.com/yuhonas/free-exercise-db`. Data licence: **Unlicense** (public domain). Images:
**no licence stated**.

Fields per entry (schema: `schema.json`):

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
| `images` | string[] | paths like `Air_Bike/0.jpg`; prefix with the repo's raw `exercises/` URL |

Coverage (measured):
- 876 exercises, 873 with at least one image, 1,746 images in total.
- **Dumbbell: 123 exercises, all 123 have images.** The dumbbell image gap we expected is not
  here.
- Nulls: `equipment` 77, `mechanic` 87, `force` 30.

## 2. wger exercise API

API: `https://wger.de/api/v2/exerciseinfo/` (paginated, 930 results at check time). Licence per
exercise and per translation. The exercise data is **CC-BY-SA**, so derived data stays under
share-alike.

Result fields used: `id`, `uuid`, `category` (`{id, name}`), `muscles` and `muscles_secondary`
(each `{id, name, name_en, is_front, image_url_main, image_url_secondary}`), `equipment`
(`[{id, name}]`), `license` (`{id, full_name, short_name, url}`), `license_author`, `images`,
`videos`, `translations[]`.

Translations: `{id, name, description, language, aliases, license, license_author, ...}`. Use
the `language` id to pick English (id 2 in the sample; confirm against `/api/v2/language/`).

Licence values (from `/api/v2/license/`): 1 CC-BY-SA 3, 2 CC-BY-SA 4, 3 CC0, 4 CC-BY 4, 5 ODbL.

Images: not fetched. Check each image's own `license` field before storing it.

## 3. USDA FoodData Central (food search and portions)

Docs: `fdc.nal.usda.gov/api-guide/`. Endpoints: `GET|POST /foods/search` (`query`, `dataType`
array, `sortBy`, `sortOrder`), `GET /food/{fdcId}`, `GET /foods` (by ids), `GET /foods/list`.

- **Licence: CC0 1.0** (public domain). USDA asks for attribution to FoodData Central.
- **API key required** (data.gov). Limit 1,000 req/hour per IP. `DEMO_KEY` is for trying it out
  only (30/hour, 50/day). Store the key server-side; never ship it in the client.
- `dataType` values: `Foundation`, `SR Legacy`, `Survey (FNDDS)`, `Branded`, `Experimental`.

**Gap:** the API guide page does not document the `foodPortions` field names (`gramWeight`,
`measureUnit`, `modifier`, `portionDescription`, `amount`). Those names come from the OpenAPI spec
(linked from the guide) and must be checked there before coding the mapper.

## Target model

```ts
Exercise {
  id: string                      // our id, e.g. "ex_<uuid>"
  name: string
  aliases: string[]               // wger translation aliases, other languages later
  equipment: 'barbell'|'dumbbell'|'kettlebell'|'cable'|'machine'|'bodyweight'|'band'|'other'|'unknown'
  force: 'push'|'pull'|'static'|null
  mechanic: 'compound'|'isolation'|null
  level: 'beginner'|'intermediate'|'expert'|null
  category: string
  primaryMuscles: Muscle[]        // our canonical list (below)
  secondaryMuscles: Muscle[]
  movementPattern: Pattern|null   // OURS: squat, hinge, lunge, horizontal_push, vertical_push,
                                  // horizontal_pull, vertical_pull, carry, rotation, isolation
  instructions: string[]
  images: { path, sourceUrl, licence }[]
  source: { provider, sourceId, url, licence, licenceUrl, author, fetchedAt }
}

Food {
  id: string
  name: string
  source: { provider: 'usda-fdc', fdcId, dataType, licence: 'CC0-1.0', fetchedAt }
  per100g: { kcal, protein, carbs, fat, ... }   // from nutrients in the food detail
  portions: { label, gramWeight, amount }[]     // from foodPortions (verify names)
}
```

**Muscle mapping** (the three sources use different names):

| Canonical | free-exercise-db | wger `name_en` |
|---|---|---|
| quadriceps | `quadriceps` | `Quads` |
| hamstrings | `hamstrings` | `Hamstrings` |
| glutes | `glutes` | `Glutes` |
| abdominals | `abdominals` | `Abs` |
| lats | `lats` | `Lats` (check) |
| lower back | `lower back` | `Lower back` (check) |
| shoulders | `shoulders` | `Shoulders` |
| chest | `chest` | `Chest` |
| biceps | `biceps` | `Biceps` |
| triceps | `triceps` | `Triceps` |

Check the wger rows marked "(check)" against `/api/v2/muscle/` before relying on them. wger
also has `is_front`, which we can keep for a front/back body map.

Equipment: map `kettlebells` → `kettlebell`, `body only` → `bodyweight`, `bands` → `band`,
`e-z curl bar` → `barbell`, `exercise ball` → `other`. wger equipment names need the same
treatment.

## Licence fields to store

Per exercise: `source.provider`, `source.sourceId`, `source.licence` (short name, e.g.
`CC-BY-SA 4`, `Unlicense`), `source.licenceUrl`, `source.author`. Per image: its own
`licence` and `sourceUrl`. Per food: `licence: 'CC0-1.0'` and the attribution string.

Share-alike matters: wger-derived exercise text must carry `CC-BY-SA` with it. Mixing wger
text into a closed app needs a decision, not an assumption.

## Gaps and what we must add ourselves

1. **Movement pattern.** None of the three sources has squat/hinge/push/pull as a pattern.
   free-exercise-db's `force` and `mechanic` are close but not the same. We need our own tags
   (`movementPattern`), probably a one-off labelling pass with review.
2. **Images.** free-exercise-db covers dumbbells. The 3 entries without images need a fallback
   (no image, not a broken one). Image licence is unstated, so either get a licence answer or
   ship without images.
3. **Muscle vocabulary.** Two vocabularies to map (see table). Unmapped muscles should fail loudly
   at import, not be dropped.
4. **Null fields.** About 30 to 90 entries lack `equipment`, `force` or `mechanic`. Store null,
   don't guess. The UI should say "unknown".
5. **Food portions.** Branded and Foundation portions differ. Some foods have no portions at all;
   the app then needs a grams input.
6. **Language.** Only English is in scope for the first pass; wger translations are optional.
