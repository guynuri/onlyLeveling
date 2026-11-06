# Credits

Files ported from openGym (AGPL-3.0-or-later, https://github.com/DuarteSantos8/openGym).
Add one row per ported file.

| our file | ported from | notes |
|---|---|---|
| `src/ui/body/body-paths.js` | `frontend/src/lib/body-paths.js` | Unchanged. The geometry is MuscleMap (MIT, notice below). |

### MuscleMap (body-map geometry)

The muscle outlines in `src/ui/body/body-paths.js` are derived from
[MuscleMap](https://github.com/melihcolpan/MuscleMap) by Melih Colpan, converted to a JS module by openGym.
Used under the MIT License:

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

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
