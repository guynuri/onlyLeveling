-- Coach suggestions (PLAN Phase 5). One row per rule and exercise per user; the JSON holds the whole Suggestion.
CREATE TABLE IF NOT EXISTS suggestions (
  user_id    TEXT    NOT NULL,
  id         TEXT    NOT NULL,           -- `${rule}:${exerciseId}`
  data       TEXT    NOT NULL,           -- JSON of the whole Suggestion
  updated_at INTEGER NOT NULL,           -- client clock, ms; last write wins
  server_at  INTEGER NOT NULL DEFAULT 0, -- server receive time; the pull cursor
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS suggestions_user_server ON suggestions (user_id, server_at);
