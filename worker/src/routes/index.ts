// Reserved Worker route slots for Wave 2 (PLAN, contracts freeze). Each Wave 2 phase adds its handler to
// SLOT_HANDLERS and its own file. Nothing is routed yet, so every request falls through to the 404 in index.ts.
import type { Env } from '../env';
import type { Principal } from '../auth';
import { WAVE2_MODULE_IDS } from '../../../shared/wave2';
import { aiSlot } from './ai';
import { pushSlot } from './push';
import { reviewSlot } from './review';

export const ROUTE_SLOTS = WAVE2_MODULE_IDS;

export type SlotHandler = (req: Request, env: Env, principal: Principal) => Promise<Response | null>;

// Handlers a Wave 2 phase adds here, one line each.
export const SLOT_HANDLERS: readonly SlotHandler[] = [aiSlot, reviewSlot, pushSlot];

// Runs the handlers in order and returns the first Response. A handler that throws rejects this call, so the
// caller's error handler (JSON body and CORS headers) still applies.
export async function runSlots(
  handlers: readonly SlotHandler[],
  req: Request,
  env: Env,
  principal: Principal,
): Promise<Response | null> {
  for (const handler of handlers) {
    const res = await handler(req, env, principal);
    if (res) return res;
  }
  return null;
}

export function routeSlots(req: Request, env: Env, principal: Principal): Promise<Response | null> {
  return runSlots(SLOT_HANDLERS, req, env, principal);
}
