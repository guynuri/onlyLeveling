// Home hub (UX design §6.2): next workout, level and XP, streak, coach. Each tile opens its screen. Fits one iPhone
// screen: one card plus three compact tiles.
import { useEffect, useState } from 'react';
import { Flame, MessageCircle, Trophy } from 'lucide-react';
import { getExercise } from '../data/exercises';
import { blockWeek, isDeloadWeek, nextSession, sessionsInBlock } from '../domain/block';
import type { BodySlug } from '../domain/muscle-map';
import { loadProgress, type Loaded } from '../modules/progress/load';
import { loadCoachCards } from '../modules/coach/actions';
import { levelOf } from '../modules/xp/domain/hub';
import { BodyMap } from '../ui/body/BodyMap';
import { Card, ProgressBar, Tile } from '../ui/primitives';

const thumb = (path: string) => import.meta.env.BASE_URL + path;

export default function HomeScreen() {
  const [data, setData] = useState<{ loaded: Loaded; now: number } | null>(null);
  const [coach, setCoach] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    loadProgress(now)
      .then((loaded) => setData({ loaded, now }))
      .catch(() => setError('Could not load your data. Reload to try again.'));
    // Coach count is a bonus: a failure leaves the tile without a number.
    loadCoachCards(now)
      .then((c) => setCoach(c.length))
      .catch(() => undefined);
  }, []);

  if (error) return <p className="muted">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { loaded, now } = data;
  const { plan, state, settings } = loaded;
  const day = nextSession(plan, sessionsInBlock(plan, loaded.slotStarts.map((start) => ({ start }))), now, loaded.slotStarts);
  const week = blockWeek(plan, now);
  const exercises = (day?.exerciseIds ?? []).map(getExercise).filter((e) => e !== undefined);
  const slugs = [...new Set(exercises.flatMap((e) => e.muscles.primary))] as BodySlug[];
  const lvl = levelOf(loaded.totalXp);

  return (
    <section className="ui-stack home">
      <Card
        title={day ? (day.kind === 'cardio' ? 'Next: cardio day' : `Next: ${day.label ?? `Day ${day.index + 1}`}`) : 'No plan yet'}
        action={
          <span className="muted small">
            Week {week.week} of {week.of}
            {isDeloadWeek(plan, now) ? ' · deload' : ''}
          </span>
        }
      >
        {day && day.kind !== 'cardio' && (
          <div className="home-next">
            <BodyMap primary={slugs} size="sm" sex={settings.about?.sex} />
            <div className="home-thumbs">
              {exercises.slice(0, 4).map((e) => (
                <span key={e.id} className="ui-ex-thumb" title={e.name}>
                  {e.media ? <img src={thumb(e.media.stills[e.media.stills.length - 1])} alt={e.name} decoding="async" /> : <span className="small">{e.name}</span>}
                </span>
              ))}
              {exercises.length > 4 && <span className="muted small">+{exercises.length - 4}</span>}
            </div>
          </div>
        )}
        <a className="ui-btn ui-btn--primary ui-btn--md ui-btn--block" href={day ? '#/workout' : '#/plan'}>
          {day ? 'Start' : 'Build a plan'}
        </a>
      </Card>

      <a className="ui-tile home-level" href="#/progress">
        <span className="ui-tile-icon">
          <Trophy />
        </span>
        <span className="ui-tile-text">
          <span className="ui-tile-label">Level {lvl.level}</span>
          <ProgressBar value={Math.round(lvl.into)} max={lvl.span} label={`Level ${lvl.level} progress`} />
          <span className="ui-tile-value">
            {Math.round(lvl.span - lvl.into).toLocaleString()} XP to level {lvl.level + 1}
          </span>
        </span>
      </a>
      <Tile
        href="#/progress"
        icon={<Flame />}
        label="Streak"
        value={state.streak > 0 ? `${state.streak} ${state.streak === 1 ? 'week' : 'weeks'} in a row` : 'Finish this week’s sessions to start one'}
      />
      <Tile
        href="#/workout"
        icon={<MessageCircle />}
        label="Coach"
        value={coach === null ? 'Suggestions and weekly review' : coach === 0 ? 'Nothing new' : `${coach} ${coach === 1 ? 'suggestion' : 'suggestions'}`}
        badge={coach ?? undefined}
      />
    </section>
  );
}
