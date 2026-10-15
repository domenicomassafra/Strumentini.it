import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSessionForPasswordCredential, deleteAllSessionsForUser, reserveKdfAttempt, updateUserPasswordIfUnchanged } from "../worker/db";

/** Exercise the actual D1 SQL against real SQLite, without provider state. */
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(readFileSync(new URL("../worker/migrations/0001_init.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../worker/migrations/0002_google_auth.sql", import.meta.url), "utf8"));
  sqlite.prepare("INSERT INTO users (id,email,name,password_hash,password_salt,password_iterations,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run("user-1", "synthetic@example.invalid", "Synthetic", "pbkdf2-sha256$old", "old-salt", 600_000, "2026-01-01", "2026-01-01");
  const d1 = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      let params: unknown[] = [];
      return {
        bind(...values: unknown[]) { params = values; return this; },
        async run() {
          const result = statement.run(...params as Array<string | number | null>);
          return { meta: { changes: Number(result.changes) } };
        },
        async first() {
          return statement.get(...params as Array<string | number | null>) ?? null;
        },
      };
    },
  } as unknown as D1Database;
  return { sqlite, d1 };
}

const expected = { hash: "pbkdf2-sha256$old", salt: "old-salt", iterations: 600_000 } as const;
const next = { hash: "pbkdf2-sha256$new", salt: "new-salt", iterations: 600_000 } as const;
const session = (id: string) => ({
  id, tokenHash: `hash-${id}`, userId: "user-1", createdAt: "2026-01-01",
  expiresAt: "2026-12-31", userAgent: "synthetic-test",
});

describe("#328 source-bound password/login race barrier on real SQLite", () => {
  it("reserves no more than eight parallel-cost slots per IP and permits a new minute", async () => {
    const { sqlite, d1 } = fixture();
    try {
      const first = "2026-01-01T00:00:00.000Z";
      for (let index = 0; index < 8; index += 1) {
        expect(await reserveKdfAttempt(d1, "synthetic-ip", first, "2025-12-31T23:59:00.000Z")).toBe(true);
      }
      expect(await reserveKdfAttempt(d1, "synthetic-ip", first, "2025-12-31T23:59:00.000Z")).toBe(false);
      expect(await reserveKdfAttempt(d1, "different-ip", first, "2025-12-31T23:59:00.000Z")).toBe(true);
      expect(await reserveKdfAttempt(d1, "synthetic-ip", "2026-01-01T00:01:01.000Z", "2026-01-01T00:00:01.000Z")).toBe(true);
    } finally { sqlite.close(); }
  });
  it("refuses a stale login after a concurrent password change", async () => {
    const { sqlite, d1 } = fixture();
    try {
      expect(await updateUserPasswordIfUnchanged(d1, "user-1", next, { ...expected, loginEnabled: 1 }, "2026-01-02")).toBe(true);
      expect(await createSessionForPasswordCredential(d1, session("stale"), expected)).toBe(false);
      expect(sqlite.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
      expect(await createSessionForPasswordCredential(d1, session("fresh"), next)).toBe(true);
      expect(sqlite.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 1 });
    } finally { sqlite.close(); }
  });

  it("does not overwrite newer credentials with an old login auto-rehash", async () => {
    const { sqlite, d1 } = fixture();
    try {
      expect(await updateUserPasswordIfUnchanged(d1, "user-1", next, { ...expected, loginEnabled: 1 }, "2026-01-02")).toBe(true);
      const stale = { hash: "pbkdf2-sha256$stale-rehash", salt: "stale", iterations: 600_000 };
      expect(await updateUserPasswordIfUnchanged(d1, "user-1", stale, { ...expected, loginEnabled: 1 }, "2026-01-03")).toBe(false);
      expect(sqlite.prepare("SELECT password_hash FROM users WHERE id='user-1'").get()).toEqual({ password_hash: next.hash });
    } finally { sqlite.close(); }
  });

  it("revokes sessions created before a password change, not sessions after it", async () => {
    const { sqlite, d1 } = fixture();
    try {
      expect(await createSessionForPasswordCredential(d1, session("before"), expected)).toBe(true);
      expect(await updateUserPasswordIfUnchanged(d1, "user-1", next, { ...expected, loginEnabled: 1 }, "2026-01-02")).toBe(true);
      expect(await deleteAllSessionsForUser(d1, "user-1")).toBe(1);
      expect(await createSessionForPasswordCredential(d1, session("after"), next)).toBe(true);
      expect(sqlite.prepare("SELECT id FROM sessions").all()).toEqual([{ id: "after" }]);
    } finally { sqlite.close(); }
  });
});
