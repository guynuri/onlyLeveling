// Module registration. Order of registration is kept; duplicate ids are a programming error.
// Wave 2 ids are reserved: only a module that claims its reserved id may register it.
import { WAVE2_MODULE_IDS } from '../../shared/wave2';

export { WAVE2_MODULE_IDS };

export interface ModuleDef {
  id: string;
  label: string;
}

export interface RegisterOptions {
  claimReserved?: boolean; // set only by the Wave 2 phase that owns the id
}

export function createRegistry() {
  const modules: ModuleDef[] = [];
  return {
    register(mod: ModuleDef, opts: RegisterOptions = {}): void {
      if (modules.some((m) => m.id === mod.id)) {
        throw new Error(`Duplicate module id: ${mod.id}`);
      }
      if ((WAVE2_MODULE_IDS as readonly string[]).includes(mod.id) && !opts.claimReserved) {
        throw new Error(`Module id ${mod.id} is reserved for Wave 2`);
      }
      modules.push(mod);
    },
    list(): readonly ModuleDef[] {
      return [...modules];
    },
  };
}
