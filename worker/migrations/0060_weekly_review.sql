-- The weekly review (PLAN, SPEC Phase 2). One stored review per user per closed week. Text only: the prompt is not
-- stored, only the answer and which provider wrote it. provider is null when the rules wrote the text.
CREATE TABLE IF NOT EXISTS weekly_reviews (
  user_id    TEXT    NOT NULL,
  week       TEXT    NOT NULL,          -- YYYY-MM-DD, the Monday that starts the week
  text       TEXT    NOT NULL,
  provider   TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, week)
);
