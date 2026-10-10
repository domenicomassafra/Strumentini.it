-- #332. Applied after 0002_google_auth.sql. Historical favorites are imported before the sync API
-- reads this state. The old table remains mirrored for safe rollback.
CREATE TABLE favorite_sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  installed INTEGER NOT NULL CHECK (installed IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_favorite_sync_events_user ON favorite_sync_events (user_id, id);

CREATE TABLE favorite_sync_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  installed INTEGER NOT NULL CHECK (installed IN (0, 1)),
  revision INTEGER NOT NULL,
  PRIMARY KEY (user_id, tool_id)
);

-- Historical deletions cannot be reconstructed from the old favorites table.
-- Mark users present during migration so an old cached client cannot PUT a
-- previously deleted, now absent tool without any revision information.
-- Accounts registered AFTER migration are not marked and retain legacy PUT.
CREATE TABLE favorite_sync_migrated_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO favorite_sync_migrated_accounts (user_id) SELECT id FROM users;

-- One insertion is the atomic serialization point: SQLite allocates a
-- monotonically increasing ID, writes current state and maintains the legacy
-- favorites table in the same statement/transaction.
CREATE TRIGGER favorite_sync_apply AFTER INSERT ON favorite_sync_events
BEGIN
  INSERT INTO favorite_sync_state (user_id, tool_id, installed, revision)
  VALUES (NEW.user_id, NEW.tool_id, NEW.installed, NEW.id)
  ON CONFLICT(user_id, tool_id)
  DO UPDATE SET installed = excluded.installed, revision = excluded.revision;

  INSERT INTO favorites (user_id, tool_id, created_at)
  SELECT NEW.user_id, NEW.tool_id, NEW.created_at WHERE NEW.installed = 1
  ON CONFLICT(user_id, tool_id) DO NOTHING;

  DELETE FROM favorites
    WHERE user_id = NEW.user_id AND tool_id = NEW.tool_id AND NEW.installed = 0;
END;

INSERT INTO favorite_sync_events (user_id, tool_id, installed, created_at)
  SELECT user_id, tool_id, 1, created_at
  FROM favorites
  ORDER BY user_id, created_at, tool_id;
