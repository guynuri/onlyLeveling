// The rest countdown, pinned above the tab bar while a rest runs (UX design §6.4). It reads the wall clock through
// `now`, so it is right again as soon as a backgrounded page resumes.
import { remainingMs } from './rest-timer';
import { Button } from '../../ui/primitives';

export function RestBar(props: { endsAt: number; now: number; onSkip: () => void }) {
  const left = Math.ceil(remainingMs({ endsAt: props.endsAt }, props.now) / 1000);
  if (left <= 0) return null;
  return (
    <div className="ui-restbar" role="timer" aria-live="off">
      <span className="ui-restbar-time">
        Rest {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </span>
      <Button size="sm" variant="secondary" onClick={props.onSkip}>
        Skip
      </Button>
    </div>
  );
}
