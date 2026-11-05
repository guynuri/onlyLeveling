// Module-facing data API (PLAN Phase 3). Screens talk to this, never to IndexedDB directly.
import type { BodyweightEntry, Settings, Workout } from '../domain/types';
import type { Plan } from '../domain/plan';
import type { Suggestion } from '../domain/suggestion';

export interface Repo {
  getSettings(): Promise<Settings | undefined>;
  saveSettings(s: Settings): Promise<void>;
  saveWorkout(w: Workout): Promise<void>; // whole-session upsert
  listWorkouts(): Promise<Workout[]>; // newest first
  addBodyweight(date: string, kg: number): Promise<void>;
  listBodyweight(): Promise<BodyweightEntry[]>; // newest first
  getPlan(): Promise<Plan | undefined>;
  savePlan(p: Plan): Promise<void>;
  listSuggestions(): Promise<Suggestion[]>;
  saveSuggestion(s: Suggestion): Promise<void>;
}
