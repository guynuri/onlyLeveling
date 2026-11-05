-- The saved training plan (one per user). Stored whole as JSON, like workouts and settings (SPEC §7).
-- Added in Phase 5: plans were rebuilt from settings on every open until the coach needed a plan to change.
CREATE TABLE IF NOT EXISTS plans (
  user_id    TEXT    NOT NULL PRIMARY KEY,
  data       TEXT    NOT NULL,           -- JSON of the whole Plan
  updated_at INTEGER NOT NULL,           -- client clock, ms; last write wins
  server_at  INTEGER NOT NULL DEFAULT 0  -- server receive time; the pull cursor
);
CREATE INDEX IF NOT EXISTS plans_user_server ON plans (user_id, server_at);
