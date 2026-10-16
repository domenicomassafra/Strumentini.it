-- #332: a client can lose the HTTP acknowledgement after a D1 write commits.
-- Durable per-tool operation identity distinguishes that write from a remote
-- deletion so a retry never guesses whether it may override a tombstone.
ALTER TABLE favorite_sync_events ADD COLUMN operation_id TEXT;
ALTER TABLE favorite_sync_state ADD COLUMN operation_id TEXT;

DROP TRIGGER favorite_sync_apply;
CREATE TRIGGER favorite_sync_apply AFTER INSERT ON favorite_sync_events
BEGIN
  INSERT INTO favorite_sync_state (user_id, tool_id, installed, revision, operation_id)
  VALUES (NEW.user_id, NEW.tool_id, NEW.installed, NEW.id, NEW.operation_id)
  ON CONFLICT(user_id, tool_id)
  DO UPDATE SET installed = excluded.installed, revision = excluded.revision,
    operation_id = excluded.operation_id;

  INSERT INTO favorites (user_id, tool_id, created_at)
  SELECT NEW.user_id, NEW.tool_id, NEW.created_at WHERE NEW.installed = 1
  ON CONFLICT(user_id, tool_id) DO NOTHING;

  DELETE FROM favorites
    WHERE user_id = NEW.user_id AND tool_id = NEW.tool_id AND NEW.installed = 0;
END;
