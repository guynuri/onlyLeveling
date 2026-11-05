-- Phase 4b: accounts, passwords, invite codes, sessions, rate limits (PLAN Phase 4).
-- Additive only (CLAUDE.md, expand then contract). Invite codes and session tokens are stored as SHA-256 hashes.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT    NOT NULL PRIMARY KEY,
  username   TEXT    NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS passwords (
  user_id    TEXT    NOT NULL PRIMARY KEY,
  hash       TEXT    NOT NULL,           -- PBKDF2-SHA256, hex
  salt       TEXT    NOT NULL,           -- hex, random per user
  iterations INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  code_hash  TEXT    NOT NULL PRIMARY KEY, -- SHA-256 of the code; the code itself is shown once
  issued_by  TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  used_by    TEXT,
  used_at    INTEGER                       -- NULL = unused; single use
);
CREATE INDEX IF NOT EXISTS invites_issuer ON invites (issued_by, used_at);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    NOT NULL PRIMARY KEY, -- SHA-256 of the bearer token
  user_id    TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT    NOT NULL PRIMARY KEY, -- "<action>:<ip>"
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
