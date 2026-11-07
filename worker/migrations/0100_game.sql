-- Game records (U7): a week's quests (quests:YYYY-MM-DD) and a seen monthly recap (recap:YYYY-MM). Streak freezes
-- are derived from history and not stored. First write wins. Added only: an older Worker or app is unaffected.
CREATE TABLE IF NOT EXISTS game_records (
  user_id    TEXT    NOT NULL,
  key        TEXT    NOT NULL,
  data       TEXT    NOT NULL,           -- JSON
  at         INTEGER NOT NULL,           -- client clock, ms
  server_at  INTEGER NOT NULL DEFAULT 0, -- server receive time; the pull cursor
  PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS game_user_server ON game_records (user_id, server_at);
