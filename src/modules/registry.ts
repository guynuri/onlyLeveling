// Module registration. Order of registration is kept; duplicate ids are a programming error.
// Frozen at the contracts freeze (PLAN). Wave 2 modules register under these ids; they are reserved and empty now.
export const WAVE2_MODULE_IDS = ['coach', 'xp', 'ai', 'push', 'nutrition'] as const;

export interface ModuleDef {
  id: string;
  label: string;
}

export function createRegistry() {
  const modules: ModuleDef[] = [];
  return {
    register(mod: ModuleDef): void {
      if (modules.some((m) => m.id === mod.id)) {
        throw new Error(`Duplicate module id: ${mod.id}`);
      }
      modules.push(mod);
    },
    list(): readonly ModuleDef[] {
      return [...modules];
    },
  };
}
