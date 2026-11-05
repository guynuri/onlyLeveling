-- Earned badges (PLAN Phase 6). XP and ranks are derived from workouts and are not stored. A badge is stored once
-- and never revoked: the first write wins, later ones do nothing.
CREATE TABLE IF NOT EXISTS badges (
  user_id    TEXT    NOT NULL,
  badge_key  TEXT    NOT NULL,           -- e.g. session:10, muscle:chest:C
  earned_at  INTEGER NOT NULL,           -- client clock, ms
  server_at  INTEGER NOT NULL DEFAULT 0, -- server receive time; the pull cursor
  PRIMARY KEY (user_id, badge_key)
);
CREATE INDEX IF NOT EXISTS badges_user_server ON badges (user_id, server_at);
