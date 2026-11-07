-- Cardio sessions (U5b). Stored whole as JSON like workouts. Added only: an older Worker or app is unaffected.
CREATE TABLE IF NOT EXISTS cardio_sessions (
  user_id    TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  data       TEXT    NOT NULL,           -- JSON of the whole CardioSession
  updated_at INTEGER NOT NULL,           -- client clock, ms; last write wins
  server_at  INTEGER NOT NULL DEFAULT 0, -- server receive time; the pull cursor
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS cardio_user_server ON cardio_sessions (user_id, server_at);
