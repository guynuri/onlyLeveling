// Module-facing data API (PLAN Phase 3). Screens talk to this, never to IndexedDB directly.
import type { BodyweightEntry, Settings, Workout } from '../domain/types';
import type { Plan } from '../domain/plan';
import type { Suggestion } from '../domain/suggestion';
import type { CardioSession } from '../domain/cardio';

export interface Repo {
  getSettings(): Promise<Settings | undefined>;
  saveSettings(s: Settings): Promise<void>;
  saveWorkout(w: Workout): Promise<void>; // whole-session upsert
  listWorkouts(): Promise<Workout[]>; // newest first
  addBodyweight(date: string, kg: number): Promise<void>;
  listBodyweight(): Promise<BodyweightEntry[]>; // newest first
  saveCardio(c: CardioSession): Promise<void>; // whole-session upsert
  listCardio(): Promise<CardioSession[]>; // newest first
  getPlan(): Promise<Plan | undefined>;
  savePlan(p: Plan): Promise<void>;
  listSuggestions(): Promise<Suggestion[]>;
  saveSuggestion(s: Suggestion): Promise<void>;
  listBadges(): Promise<{ badgeKey: string; earnedAt: number }[]>;
  // Stores a badge the first time only. true = newly earned; an earned badge is never revoked (SPEC §4b).
  awardBadge(badgeKey: string, earnedAt: number): Promise<boolean>;
  // Game records (U7): a week's quests (quests:YYYY-MM-DD) and a seen monthly recap (recap:YYYY-MM).
  listGame(): Promise<GameRecord[]>;
  // Stores a record the first time only, like badges: a week's quests never change once picked. true = stored.
  putGame(r: GameRecord): Promise<boolean>;
}

export interface GameRecord {
  key: string;
  data: unknown;
  at: number; // client clock, ms
}
