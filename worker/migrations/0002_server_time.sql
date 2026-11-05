-- Pull cursors are server receive times, not client clocks (PR #9 review). A phone whose clock runs behind
-- must still get its records. Existing rows get 0, so a first pull after this migration returns them all.
ALTER TABLE workouts ADD COLUMN server_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN server_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bodyweight ADD COLUMN server_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS workouts_user_server ON workouts (user_id, server_at);
CREATE INDEX IF NOT EXISTS settings_user_server ON settings (user_id, server_at);
CREATE INDEX IF NOT EXISTS bodyweight_user_server ON bodyweight (user_id, server_at);
