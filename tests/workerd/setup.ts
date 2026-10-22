import { env } from "cloudflare:workers";
import { applyD1Migrations, reset } from "cloudflare:test";
import { beforeEach } from "vitest";

// Recreate an empty local D1 and DO storage for every test. These SQL files
// are the actual production migrations, read by the plugin at config time.
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.AUTH_DB, env.TEST_MIGRATIONS);
  // Reconcile the same local schema even when an earlier test fails mid-flow:
  // a Vitest failure must never leak user rows into the next case.
  await env.AUTH_DB.exec("DELETE FROM favorite_sync_events; DELETE FROM favorite_sync_state; DELETE FROM favorites; DELETE FROM sessions; DELETE FROM login_attempts; DELETE FROM users;");
});
