-- Push notifications (PLAN Phase 9). Subscriptions are stored once per device endpoint. One reminder setting and one
-- pending rest alert per user. Everything is scoped by user_id.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id    TEXT    NOT NULL,
  endpoint   TEXT    NOT NULL,          -- the push service URL; unique per device
  p256dh     TEXT    NOT NULL,          -- the device's public key (base64url)
  auth       TEXT    NOT NULL,          -- the device's auth secret (base64url)
  created_at INTEGER NOT NULL,
  failures   INTEGER NOT NULL DEFAULT 0, -- sends in a row that did not reach the push service; reset on success
  PRIMARY KEY (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS reminders (
  user_id       TEXT    NOT NULL PRIMARY KEY,
  enabled       INTEGER NOT NULL DEFAULT 1,
  time          TEXT    NOT NULL,      -- HH:MM, local time of the user
  tz            TEXT    NOT NULL,      -- IANA time zone name, e.g. Asia/Jerusalem
  last_sent_day TEXT                   -- YYYY-MM-DD (local) of the last reminder sent
);

-- At most one pending rest alert per user: a new rest replaces the old one.
CREATE TABLE IF NOT EXISTS rest_alerts (
  user_id TEXT    NOT NULL PRIMARY KEY,
  fire_at INTEGER NOT NULL             -- epoch ms
);
CREATE INDEX IF NOT EXISTS rest_alerts_due ON rest_alerts (fire_at);
