// The Wave 2 module ids, reserved at the contracts freeze (PLAN). One list, imported by the app and the Worker,
// so the two cannot drift. A Wave 2 phase claims its id; nothing else may use it.
export const WAVE2_MODULE_IDS = ['coach', 'xp', 'ai', 'push', 'nutrition'] as const;
export type Wave2ModuleId = (typeof WAVE2_MODULE_IDS)[number];
