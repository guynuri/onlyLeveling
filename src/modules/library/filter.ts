// Library search and filters (UX design §3.3, §6). Pure, tested.
import { isEquipmentFree, type Exercise, type Kit } from '../../domain/exercise';
import type { BodySlug } from '../../domain/muscle-map';

export type KitChoice = Kit | 'none';

export interface LibraryQuery {
  text: string;
  kit: readonly KitChoice[]; // empty = any equipment
  muscle: BodySlug | null;
}

// Doable with the selected kit: every item the exercise needs is selected, and an equipment-free exercise shows
// only when "None" is selected. Equipment the app has no chip for (barbell, cable, machine) shows only unfiltered.
function fitsKit(ex: Pick<Exercise, 'equipment' | 'requires'>, kit: readonly KitChoice[]): boolean {
  if (kit.length === 0) return true;
  if (isEquipmentFree(ex)) return kit.includes('none');
  if (ex.requires.length === 0) return false;
  return ex.requires.every((k) => kit.includes(k));
}

export function filterLibrary(all: readonly Exercise[], q: LibraryQuery): Exercise[] {
  const text = q.text.trim().toLowerCase();
  return all
    .filter((ex) => !text || ex.name.toLowerCase().includes(text) || ex.aliases.some((a) => a.toLowerCase().includes(text)))
    .filter((ex) => fitsKit(ex, q.kit))
    .filter((ex) => !q.muscle || ex.muscles.primary.includes(q.muscle))
    .sort((a, b) => (a.media ? 0 : 1) - (b.media ? 0 : 1) || a.name.localeCompare(b.name));
}
