# Credits

Files ported from openGym (AGPL-3.0-or-later, https://github.com/DuarteSantos8/openGym).
Add one row per ported file.

| our file | ported from | notes |
|---|---|---|

## Libraries

| library | licence | what we use | link |
|---|---|---|---|
| Lucide (`lucide-react`) | ISC | icons in the tab bar and screens | https://lucide.dev |

## Data sources

| source | licence | what we use | link |
|---|---|---|---|
| free-exercise-db | Unlicense (public domain) | exercise text: names, muscles, equipment, instructions. Images not used (no licence stated). Import script: `scripts/import-exercises.ts`. | https://github.com/yuhonas/free-exercise-db |

## openGym reference (read, not copied)

Behaviour for `src/domain/dumbbells.ts`, `onerm.ts` and `progression.ts` was checked against openGym's `frontend/src/lib/` (AGPL-3.0). The code was rewritten from SPEC §3, so no file is ported and no row is needed. If a future change copies code from openGym, add its row here.
