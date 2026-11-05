-- Phase 4a core schema (PLAN Phase 4). Every row is scoped by user_id.
-- Workouts and settings store the whole record as JSON (the client owns the shape; SPEC §7).

CREATE TABLE IF NOT EXISTS workouts (
  user_id    TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  data       TEXT    NOT NULL,           -- JSON of the whole Workout
  updated_at INTEGER NOT NULL,           -- client clock, ms; last write wins per session
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS workouts_user_updated ON workouts (user_id, updated_at);

CREATE TABLE IF NOT EXISTS settings (
  user_id    TEXT    NOT NULL PRIMARY KEY,
  data       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bodyweight (
  user_id    TEXT    NOT NULL,
  date       TEXT    NOT NULL,           -- YYYY-MM-DD
  kg         REAL    NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- Idempotency: a push op id is applied once per user, however many times it arrives.
-- Keyed by (user_id, op_id) so one user's op id can never hide another user's op.
CREATE TABLE IF NOT EXISTS ops_applied (
  user_id    TEXT    NOT NULL,
  op_id      TEXT    NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, op_id)
);
