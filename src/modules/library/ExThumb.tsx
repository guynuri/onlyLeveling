// An exercise's small picture: its last still when it has pictures, else a mini body map of its muscles.
import type { Exercise } from '../../domain/exercise';
import { BodyMap } from '../../ui/body/BodyMap';

const src = (path: string) => import.meta.env.BASE_URL + path;

export function ExThumb({ ex, sex, className }: { ex: Exercise; sex?: 'male' | 'female'; className?: string }) {
  return (
    <span className={`ui-ex-thumb${className ? ` ${className}` : ''}`}>
      {ex.media ? (
        <img src={src(ex.media.stills[ex.media.stills.length - 1])} alt="" loading="lazy" decoding="async" />
      ) : (
        <BodyMap primary={ex.muscles.primary} size="sm" sex={sex} label={ex.name} />
      )}
    </span>
  );
}
