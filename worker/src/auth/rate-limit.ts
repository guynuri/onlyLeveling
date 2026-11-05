// Rate limit per (action, IP) in D1 (PLAN Phase 4b: redemption rate limit per IP). Fixed window, one atomic statement.
import { AUTH } from '../config';

export type LimitedAction = 'signin' | 'signup' | 'recover';

// Records one attempt. True when it is within the limit, false when it is refused.
export async function allowAttempt(db: D1Database, action: LimitedAction, ip: string, now: number): Promise<boolean> {
  const windowMs = AUTH.rateLimit.windowSec * 1000;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT (key) DO UPDATE SET
         window_start = CASE WHEN ?2 - rate_limits.window_start >= ?3 THEN ?2 ELSE rate_limits.window_start END,
         count = CASE WHEN ?2 - rate_limits.window_start >= ?3 THEN 1 ELSE rate_limits.count + 1 END
       RETURNING count`,
    )
    .bind(`${action}:${ip}`, now, windowMs)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= AUTH.rateLimit.maxAttempts;
}
