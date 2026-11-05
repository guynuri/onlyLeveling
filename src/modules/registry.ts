// Module registration. Order of registration is kept; duplicate ids are a programming error.
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
