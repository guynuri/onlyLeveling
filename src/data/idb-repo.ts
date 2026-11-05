// Local implementation of Repo over IndexedDB v2 (PLAN Phase 3). Phase 4 adds the D1-backed one.
import type { Db } from '../db/idb';
import type { BodyweightEntry, Settings, Workout } from '../domain/types';
import type { Plan } from '../domain/plan';
import type { Suggestion } from '../domain/suggestion';
import type { Repo } from './repo';

const SETTINGS_KEY = 'settings';
const PLAN_KEY = 'plan';

export function createRepo(db: Db): Repo {
  return {
    async getSettings() {
      return (await db.get('settings', SETTINGS_KEY)) as Settings | undefined;
    },
    async saveSettings(s) {
      await db.put('settings', s, SETTINGS_KEY);
    },
    async saveWorkout(w) {
      await db.put('workouts', w, w.id);
    },
    async listWorkouts() {
      const all = (await db.getAll('workouts')) as Workout[];
      return all.sort((a, b) => b.start - a.start);
    },
    async addBodyweight(date, kg) {
      await db.put('bodyweight', { date, kg }, date);
    },
    async listBodyweight() {
      const all = (await db.getAll('bodyweight')) as BodyweightEntry[];
      return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    },
    async getPlan() {
      return (await db.get('plans', PLAN_KEY)) as Plan | undefined;
    },
    async savePlan(p) {
      await db.put('plans', p, PLAN_KEY);
    },
    async listSuggestions() {
      return (await db.getAll('suggestions')) as Suggestion[];
    },
    async saveSuggestion(s) {
      await db.put('suggestions', s, s.id);
    },
  };
}
