// Badges (SPEC §4b). Derived from history, then stored once: an earned badge is never revoked (awardBadge).
// Pure: returns the keys a history has earned.
import { XP } from '../../../config/thresholds';
import { GROUPS, GROUP_LABEL, type Group } from './muscles';
import { RANKS, rankAtLeast, type Rank } from './rank';

export interface BadgeInput {
  sessions: number;
  firstPr: boolean;
  rankUp: boolean;
  maxRank: Record<Group, Rank>; // the highest rank each muscle ever reached
}

export function earnedBadges(p: BadgeInput): string[] {
  const keys: string[] = [];
  for (const n of XP.badgeSessionMilestones) {
    if (p.sessions >= n) keys.push(`session:${n}`);
  }
  if (p.firstPr) keys.push('pr:first');
  if (p.rankUp) keys.push('rankup:first');
  for (const g of GROUPS) {
    for (const r of RANKS) {
      if (rankAtLeast(r, XP.badgeRankFrom) && rankAtLeast(p.maxRank[g], r)) keys.push(`muscle:${g}:${r}`);
    }
  }
  return keys;
}

// Human label for a badge key (SPEC §4.2 plain words).
export function badgeLabel(key: string): string {
  const [kind, a, b] = key.split(':');
  if (kind === 'session') return `${a} session${a === '1' ? '' : 's'}`;
  if (kind === 'pr') return 'First personal record';
  if (kind === 'rankup') return 'First rank up';
  if (kind === 'muscle') return `${a} reached ${b}`;
  return key;
}

export interface BadgeView {
  key: string;
  label: string;
  hint: string; // how to earn it
  earned: boolean;
  kind: 'session' | 'pr' | 'rankup' | 'muscle';
  rank?: Rank; // muscle badges
}

// Every badge worth showing: the fixed ones, and per muscle its best earned rank badge, or else the first one to earn.
// Earned first, so the grid opens on what the user has.
export function badgeCatalogue(earned: readonly string[]): BadgeView[] {
  const has = new Set(earned);
  const out: BadgeView[] = [];
  for (const n of XP.badgeSessionMilestones) {
    const key = `session:${n}`;
    out.push({ key, label: n === 1 ? 'First session' : `${n} sessions`, hint: n === 1 ? 'Finish a session' : `Finish ${n} sessions`, earned: has.has(key), kind: 'session' });
  }
  out.push({ key: 'pr:first', label: 'First record', hint: 'Lift more than ever before on any exercise', earned: has.has('pr:first'), kind: 'pr' });
  out.push({ key: 'rankup:first', label: 'First rank up', hint: 'Rank up any muscle', earned: has.has('rankup:first'), kind: 'rankup' });
  const ladder = RANKS.slice(RANKS.indexOf(XP.badgeRankFrom));
  for (const g of GROUPS) {
    const best = [...ladder].reverse().find((r) => has.has(`muscle:${g}:${r}`));
    const rank = best ?? ladder[0];
    const name = GROUP_LABEL[g];
    out.push({ key: `muscle:${g}:${rank}`, label: `${name} ${rank}`, hint: `Reach rank ${rank} on ${name}`, earned: best !== undefined, kind: 'muscle', rank });
  }
  return [...out.filter((b) => b.earned), ...out.filter((b) => !b.earned)];
}
