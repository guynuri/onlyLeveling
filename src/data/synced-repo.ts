// Every write goes to the local store first, then is queued for the server (CLAUDE.md: local first, always).
// Reads pass straight through. The queue is the outbox: pushing it later is the sync engine's job.
import type { Repo } from './repo';
import type { Outbox } from './outbox';

export function createSyncedRepo(local: Repo, outbox: Outbox, now: () => number = Date.now): Repo {
  return {
    getSettings: () => local.getSettings(),
    listWorkouts: () => local.listWorkouts(),
    listBodyweight: () => local.listBodyweight(),
    getPlan: () => local.getPlan(),
    listSuggestions: () => local.listSuggestions(),

    async saveWorkout(w) {
      await local.saveWorkout(w);
      await outbox.enqueue('saveWorkout', w, now(), w.id);
    },
    async saveSettings(s) {
      await local.saveSettings(s);
      await outbox.enqueue('saveSettings', s, now(), 'settings');
    },
    async addBodyweight(date, kg) {
      await local.addBodyweight(date, kg);
      await outbox.enqueue('saveBodyweight', { date, kg }, now(), date);
    },
    async savePlan(p) {
      await local.savePlan(p);
      await outbox.enqueue('savePlan', p, now(), 'plan');
    },
    async saveSuggestion(s) {
      await local.saveSuggestion(s);
      await outbox.enqueue('saveSuggestion', { ...s }, now(), s.id);
    },
    listBadges: () => local.listBadges(),
    async awardBadge(badgeKey, earnedAt) {
      const first = await local.awardBadge(badgeKey, earnedAt);
      if (first) await outbox.enqueue('awardBadge', { badgeKey, earnedAt }, now(), `badge:${badgeKey}`);
      return first;
    },
  };
}
