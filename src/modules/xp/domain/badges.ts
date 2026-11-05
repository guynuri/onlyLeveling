// Badges (SPEC §4b). Derived from history, then stored once: an earned badge is never revoked (awardBadge).
// Pure: returns the keys a history has earned.
import { XP } from '../../../config/thresholds';
import { GROUPS, type Group } from './muscles';
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
