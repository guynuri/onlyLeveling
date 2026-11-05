-- AI plan proposals (PLAN Phase 7). Counts and an audit row only: no prompt text and no response are stored,
-- just a hash of the prompt, the provider that answered, and the outcome.

-- Calls per user per UTC day, for the daily cap (SPEC §5.7). Failed and invalid calls count too: they cost money.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT    NOT NULL,
  day     TEXT    NOT NULL,           -- YYYY-MM-DD, UTC
  calls   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS plan_proposals (
  id          TEXT    NOT NULL PRIMARY KEY,
  user_id     TEXT    NOT NULL,
  prompt_hash TEXT    NOT NULL,        -- SHA-256 hex of the prompt
  provider    TEXT,                    -- null when no provider answered
  status      TEXT    NOT NULL,        -- ai | fallback | capped
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS plan_proposals_user ON plan_proposals (user_id, created_at);
