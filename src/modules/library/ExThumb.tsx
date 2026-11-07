// An exercise's small picture: its last still when it has pictures, else a mini body map of its muscles.
import type { Exercise } from '../../domain/exercise';
import { Lock } from 'lucide-react';
import { BodyMap } from '../../ui/body/BodyMap';

const src = (path: string) => import.meta.env.BASE_URL + path;

// `locked`: the rank that opens it under the difficulty lock; shown greyed with a lock on top.
export function ExThumb({ ex, sex, className, locked }: { ex: Exercise; sex?: 'male' | 'female'; className?: string; locked?: string | null }) {
  return (
    <span className={`ui-ex-thumb${locked ? ' ui-ex-thumb--locked' : ''}${className ? ` ${className}` : ''}`}>
      {ex.media && ex.media.stills.length > 0 ? (
        <img src={src(ex.media.stills[ex.media.stills.length - 1])} alt="" loading="lazy" decoding="async" />
      ) : (
        <BodyMap primary={ex.muscles.primary} size="sm" sex={sex} label={ex.name} />
      )}
      {locked && (
        <span className="ui-ex-lock" aria-label={`Locked until rank ${locked}`}>
          <Lock />
          <span>{locked}</span>
        </span>
      )}
    </span>
  );
}
