// Reserved Worker route slots for Wave 2 (PLAN, contracts freeze). Each Wave 2 phase adds one line to its slot
// and its own file. Nothing is routed here yet, so every request falls through to the 404 in index.ts.
import type { Env } from '../env';
import type { Principal } from '../auth';

export const ROUTE_SLOTS = ['coach', 'xp', 'ai', 'push', 'nutrition'] as const;

// Called after authentication. Returns a Response when a slot handles the request, otherwise null.
export async function routeSlots(_req: Request, _env: Env, _principal: Principal): Promise<Response | null> {
  return null;
}
