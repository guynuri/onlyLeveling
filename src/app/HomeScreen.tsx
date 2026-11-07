// Home hub (UX design §6.2): monthly recap (first open of a month), next workout, streak, quests, coach. No player
// level (owner decision 2026-11-07): progress lives in the muscle ranks. Each tile opens its screen. Fits one iPhone
// screen: one card plus three compact tiles.
import { useEffect, useState } from 'react';
import { Flame, MessageCircle, Swords } from 'lucide-react';
import { RecapCard } from '../modules/progress/GameCards';
import { getExercise } from '../data/exercises';
import { blockWeek, isDeloadWeek, nextSession, sessionsInBlock } from '../domain/block';
import type { BodySlug } from '../domain/muscle-map';
import { loadProgress, type Loaded } from '../modules/progress/load';
import { loadCoachCards } from '../modules/coach/actions';
import { BodyMap } from '../ui/body/BodyMap';
import { Card, Tile } from '../ui/primitives';

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

  return (
    <section className="ui-stack home">
      {loaded.recap && <RecapCard recap={loaded.recap} plan={plan} now={now} onDismiss={() => setData({ now, loaded: { ...loaded, recap: null } })} />}
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
                  {e.media ? <img src={thumb(e.media.stills[e.media.stills.length - 1])} alt={e.name} decoding="async" /> : <BodyMap primary={e.muscles.primary} size="sm" sex={settings.about?.sex} label={e.name} />}
                </span>
              ))}
              {exercises.length > 4 && <span className="muted small">+{exercises.length - 4}</span>}
            </div>
          </div>
        )}
        {exercises.slice(0, 4).some((e) => e.media) && <p className="muted small">Pictures: Exercise data by RepDB (repdb.co)</p>}
        <a className="ui-btn ui-btn--primary ui-btn--md ui-btn--block" href={day ? '#/workout' : '#/plan'}>
          {day ? 'Start' : 'Build a plan'}
        </a>
      </Card>

      <Tile
        href="#/progress"
        icon={<Flame />}
        tone="red"
        label="Streak"
        value={`${state.streak > 0 ? `${state.streak} ${state.streak === 1 ? 'week' : 'weeks'} in a row` : 'Finish this week’s sessions to start one'}${state.freezes > 0 ? ` · ${state.freezes} ${state.freezes === 1 ? 'freeze' : 'freezes'}` : ''}`}
      />
      <Tile
        href="#/progress"
        icon={<Swords />}
        tone="cyan"
        label="Weekly quests"
        value={`${loaded.quests.filter((q) => q.have >= q.quest.need).length} of ${loaded.quests.length} done`}
      />
      <Tile
        href="#/coach"
        icon={<MessageCircle />}
        tone="green"
        label="Coach"
        value={coach === null ? 'Suggestions and weekly review' : `${coach === 0 ? 'No suggestions' : `${coach} ${coach === 1 ? 'suggestion' : 'suggestions'}`} · weekly review`}
        badge={coach ?? undefined}
      />
    </section>
  );
}
