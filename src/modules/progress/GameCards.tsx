// Game layer UI (UX design §6.7): weekly quests, the monthly recap card, and the rank-up / level-up celebration.
import { useEffect, useState } from 'react';
import { GAME } from '../../config/thresholds';
import { blockWeek } from '../../domain/block';
import type { Plan } from '../../domain/plan';
import { GROUP_LABEL, type Group } from '../xp/domain/muscles';
import type { MonthlyRecap, Quest } from '../xp/domain/game';
import { Button, Card, ProgressBar, RankBadge } from '../../ui/primitives';
import { dismissRecap } from './load';
import { playLevelUp } from '../../ui/sound';
import { badgeCatalogue, badgeLabel } from '../xp/domain/badges';
import { Medal } from 'lucide-react';

export function questLabel(q: Quest): string {
  switch (q.kind) {
    case 'sessions':
      return `Finish ${q.need} ${q.need === 1 ? 'session' : 'sessions'}`;
    case 'group':
      return `Train ${GROUP_LABEL[q.group]} ${q.need === 2 ? 'twice' : `${q.need} times`}`;
    case 'rir':
      return `Log how hard (RIR) on every set in ${q.need} sessions`;
    case 'cardio':
      return q.need === 1 ? 'Do one cardio session' : `Do ${q.need} cardio sessions`;
    case 'pr':
      return 'Beat a personal record';
    case 'cardioMinutes':
      return `${q.need} minutes of cardio`;
    case 'timed':
      return `${q.need} holds or stretches`;
    case 'variety':
      return `Train ${q.need} different muscle groups`;
  }
}

export function QuestsCard({ quests }: { quests: { quest: Quest; have: number }[] }) {
  if (quests.length === 0) return null;
  return (
    <Card title="This week’s quests" action={<span className="muted small">+{GAME.questBonusXp} muscle XP each</span>}>
      <ul className="ui-list">
        {quests.map(({ quest, have }) => (
          <li key={quest.kind} className="ui-list-stack">
            <span>
              {have >= quest.need ? '✓ ' : ''}
              {questLabel(quest)}
            </span>
            <ProgressBar value={have} max={quest.need} label={`${have} of ${quest.need}`} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RecapCard(props: { recap: { key: string; month: number; recap: MonthlyRecap }; plan: Plan; now: number; onDismiss: () => void }) {
  const r = props.recap.recap;
  const week = blockWeek(props.plan, props.now);
  const name = new Date(props.recap.month).toLocaleDateString(undefined, { month: 'long' });
  return (
    <Card title={`${name} recap`}>
      <ul className="ui-list">
        <li>
          <span>Sessions</span>
          <span>{r.sessions}</span>
        </li>
        <li>
          <span>Volume</span>
          <span>{Math.round(r.volumeKg).toLocaleString()} kg</span>
        </li>
        <li>
          <span>Sessions with a record</span>
          <span>{r.prs}</span>
        </li>
        <li>
          <span>XP</span>
          <span>+{Math.round(r.xp).toLocaleString()}</span>
        </li>
        {r.ranksGained.map((g) => (
          <li key={g.group}>
            <span>{GROUP_LABEL[g.group]}</span>
            <span>
              <RankBadge rank={g.from} /> → <RankBadge rank={g.to} />
            </span>
          </li>
        ))}
      </ul>
      {r.topGroups.length > 0 && <p className="muted small">Most trained: {r.topGroups.map((g: Group) => GROUP_LABEL[g]).join(', ')}.</p>}
      <p className="muted small">
        {week.over ? `Your ${week.of}-week block is over: review it on the Plan tab.` : `Now: week ${week.week} of ${week.of} of your block.`}
      </p>
      <Button
        variant="ghost"
        block
        onClick={() => {
          void dismissRecap(props.recap.key).finally(props.onDismiss);
        }}
      >
        Got it
      </Button>
    </Card>
  );
}

// Full-screen moment after a session that levels the user up or ranks a muscle up. CSS only; reduced motion keeps it
// still (ui.css).
// Rank-ups and newly earned badges after a session (owner request 2026-11-07: badges get a moment too).
export function Celebration(props: { rankUps: readonly { group: Group; to: string }[]; badges: readonly string[]; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  useEffect(() => playLevelUp(), []);
  const { onClose } = props;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const close = () => {
    setOpen(false);
    onClose();
  };
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-label={props.rankUps.length > 0 ? 'Rank up' : 'New badge'} onClick={close}>
      <div className="celebrate-burst" aria-hidden="true" />
      <div className="celebrate-body">
        {props.rankUps.length > 0 && <p className="celebrate-eyebrow">Rank up</p>}
        {props.rankUps.map((r) => (
          <p key={r.group} className="celebrate-rank">
            {GROUP_LABEL[r.group]} <RankBadge rank={r.to} />
          </p>
        ))}
        {props.badges.length > 0 && (
          <>
            <p className="celebrate-eyebrow">{props.badges.length === 1 ? 'New badge' : 'New badges'}</p>
            <div className="celebrate-badges">
              {props.badges.map((key) => {
                const b = badgeCatalogue([key]).find((x) => x.key === key) ?? { key, label: badgeLabel(key), kind: 'session' as const };
                return (
                  <span key={key} className="celebrate-badge">
                    <span className="badge-medal" style={{ ['--medal' as string]: 'var(--tone-amber)' }} aria-hidden="true">
                      <Medal />
                    </span>
                    <span className="celebrate-badge-label">{b.label}</span>
                  </span>
                );
              })}
            </div>
          </>
        )}
        <Button onClick={close} autoFocus>
          Continue
        </Button>
      </div>
    </div>
  );
}
