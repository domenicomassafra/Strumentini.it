-- 0001_init.sql — accounts, sessions and login throttling.
-- No database has been deployed yet; this is the first and only migration.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
);

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);

-- Sliding-window rate limit: count attempts for one scope newer than a cut-off.
CREATE INDEX idx_login_attempts_scope_time ON login_attempts (scope, attempted_at);

-- Session listing and mass deletion always filter by owner.
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

-- Per-user favourites. The primary key (user_id, tool_id) already covers the
-- `user_id` prefix used by every lookup, so no extra index is needed.
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, tool_id)
);
