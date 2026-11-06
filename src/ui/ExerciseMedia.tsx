// How an exercise moves (UX design §3.1): a looping clip when one is licensed, otherwise RepDB's start and peak
// pictures crossfading, otherwise a single picture. Nothing at all when the exercise has none, and nothing if a file
// fails to load (cache evicted offline, fetch skipped it): the body map and text still explain the exercise.
import { useState } from 'react';
import type { Exercise } from '../domain/exercise';

const src = (path: string) => import.meta.env.BASE_URL + path;

export function ExerciseMedia(props: { media?: Exercise['media']; name: string }) {
  const [broken, setBroken] = useState(false);
  const m = props.media;
  if (!m || broken) return null;
  const fail = () => setBroken(true);

  if (m.clip) {
    return (
      <div className="ui-media">
        <video className="ui-media-item" src={src(m.clip)} autoPlay muted loop playsInline aria-label={`${props.name}, demonstration`} onError={fail} />
      </div>
    );
  }
  const [first, second] = m.stills;
  if (!first) return null;
  return (
    <div className={second ? 'ui-media ui-media--loop' : 'ui-media'} role="img" aria-label={`${props.name}, start and end position`}>
      <img className="ui-media-item" src={src(first)} alt="" loading="lazy" decoding="async" onError={fail} />
      {second && <img className="ui-media-item ui-media-peak" src={src(second)} alt="" loading="lazy" decoding="async" onError={fail} />}
    </div>
  );
}
