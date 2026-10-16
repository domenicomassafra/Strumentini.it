import { DatabaseSync } from "node:sqlite";
import { createHash, pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { reserveKdfAttempt } from "../worker/db";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {},
}));

import worker from "../worker/index";

const ORIGIN = "https://strumentini-328-staging-20261015.example.test";
const ROUTES: ReadonlyArray<readonly [string, string]> = [
  ["POST", "/api/auth/register"],
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/google"],
  ["POST", "/api/auth/google/link"],
  ["POST", "/api/auth/logout"],
  ["PATCH", "/api/auth/profile"],
  ["POST", "/api/auth/password"],
  ["DELETE", "/api/auth/sessions/other-session"],
  ["DELETE", "/api/auth/account"],
];

function request(method: string, path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      cookie: "su_session=google-only-session-synthetic-cookie",
      ...headers,
    },
  });
}

function envWithForbiddenDb(): Parameters<typeof worker.fetch>[1] {
  return {
    ASSETS: { fetch: async () => new Response("not an API") },
    AUTH_DB: {
      prepare() { throw new Error("Database touched before CSRF rejection"); },
    },
  } as unknown as Parameters<typeof worker.fetch>[1];
}

const execution = { waitUntil() {} } as unknown as ExecutionContext;

describe("#328 authenticated mutations reject cross-origin CSRF before touching account state", () => {
  it.each(ROUTES)("rejects a sibling-subdomain Origin for %s %s", async (method, path) => {
    const response = await worker.fetch(request(method, path, {
      origin: "https://untrusted.strumentini-328-staging-20261015.example.test",
      "sec-fetch-site": "same-site",
    }), envWithForbiddenDb(), execution);
    expect(response.status).toBe(403);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it.each(ROUTES)("rejects cross-site and null origins for %s %s", async (method, path) => {
    for (const origin of ["https://evil.example.invalid", "null"]) {
      const response = await worker.fetch(request(method, path, { origin, "sec-fetch-site": "cross-site" }), envWithForbiddenDb(), execution);
      expect(response.status).toBe(403);
    }
  });

  it("rejects a same-site fetch without Origin, and a forged cross-site fetch with same Origin", async () => {
    const noOrigin = await worker.fetch(request("POST", "/api/auth/password", { "sec-fetch-site": "same-site" }), envWithForbiddenDb(), execution);
    const contraryFetchMetadata = await worker.fetch(request("POST", "/api/auth/password", {
      origin: ORIGIN,
      "sec-fetch-site": "cross-site",
    }), envWithForbiddenDb(), execution);
    expect(noOrigin.status).toBe(403);
    expect(contraryFetchMetadata.status).toBe(403);
  });

  it("preserves a legitimate same-origin logout without a cookie", async () => {
    const response = await worker.fetch(new Request(`${ORIGIN}/api/auth/logout`, {
      method: "POST",
      headers: { origin: ORIGIN, "sec-fetch-site": "same-origin" },
    }), envWithForbiddenDb(), execution);
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("preserves same-origin authenticated mutation routing without an existing session", async () => {
    for (const [method, path] of [["POST", "/api/auth/password"], ["DELETE", "/api/auth/account"], ["POST", "/api/auth/google/link"]] as const) {
      const response = await worker.fetch(new Request(`${ORIGIN}${path}`, {
        method,
        headers: { origin: ORIGIN, "sec-fetch-site": "same-origin" },
      }), envWithForbiddenDb(), execution);
      expect(response.status).toBe(401);
    }
  });
});

describe("#328 bounded durable KDF reservation cleanup", () => {
  it("prunes expired KDF reservations after successful logins while retaining the failure ledger", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec("CREATE TABLE login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, attempted_at TEXT NOT NULL)");
      sqlite.exec("CREATE INDEX idx_login_attempts_scope_time ON login_attempts (scope, attempted_at)");
      const db = {
        prepare(sql: string) {
          const statement = sqlite.prepare(sql);
          let values: Array<string | number | null> = [];
          return {
            bind(...next: Array<string | number | null>) { values = next; return this; },
            async first() { return statement.get(...values) ?? null; },
            async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
          };
        },
      } as unknown as D1Database;

      const atFirst = "2026-01-01T00:00:00.000Z";
      for (let index = 0; index < 8; index += 1) {
        expect(await reserveKdfAttempt(db, "same-ip", atFirst, "2025-12-31T23:59:00.000Z")).toBe(true);
      }
      sqlite.prepare("INSERT INTO login_attempts(scope,attempted_at) VALUES (?,?)").run("same-ip", atFirst);
      const atSecond = "2026-01-01T00:02:00.000Z";
      for (let index = 0; index < 8; index += 1) {
        expect(await reserveKdfAttempt(db, "same-ip", atSecond, "2026-01-01T00:01:00.000Z")).toBe(true);
      }
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE scope = 'kdf-ip:same-ip'").get()).toEqual({ count: 8 });
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE scope = 'same-ip'").get()).toEqual({ count: 1 });
    } finally {
      sqlite.close();
    }
  });
});

describe("#328 legitimate Google-only password bootstrap stays available", () => {
  it("sets the first password only for the signed-in account and keeps its own session", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec("PRAGMA foreign_keys = ON");
      for (const migration of ["0001_init.sql", "0002_google_auth.sql"]) {
        sqlite.exec(readFileSync(new URL(`../worker/migrations/${migration}`, import.meta.url), "utf8"));
      }
      sqlite.prepare("INSERT INTO users (id,email,name,password_hash,password_salt,password_iterations,password_login_enabled,google_sub,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run("google-user", "google@example.invalid", "Google", "disabled$google", "disabled", 1, 0, "google-subject", "2026-10-01", "2026-10-01");
      const rawToken = "synthetic-google-session-token";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      sqlite.prepare("INSERT INTO sessions (id,token_hash,user_id,created_at,expires_at,last_seen_at,user_agent) VALUES (?,?,?,?,?,?,?)")
        .run("current-google-session", tokenHash, "google-user", "2026-10-01", "2026-12-31", "2026-10-01", "synthetic");
      const db = {
        prepare(query: string) {
          const statement = sqlite.prepare(query);
          let values: Array<string | number | null> = [];
          return {
            bind(...params: Array<string | number | null>) { values = params; return this; },
            async first() { return statement.get(...values) ?? null; },
            async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
            async all() { return { results: statement.all(...values) }; },
          };
        },
      } as unknown as D1Database;
      let kdfCalls = 0;
      const allow = { limit: async () => ({ success: true }) };
      const env = {
        AUTH_DB: db,
        KDF_IP_LIMIT: allow,
        KDF_COLO_LIMIT: allow,
        PASSWORD_KDF: {
          getByName() {
            return {
              async fetch(internalRequest: Request) {
                kdfCalls += 1;
                const data = await internalRequest.json() as { password: string; salt: number[]; iterations: number };
                return Response.json({ key: [...pbkdf2Sync(data.password, Buffer.from(data.salt), data.iterations, 32, "sha256")] });
              },
            };
          },
        },
      } as unknown as Parameters<typeof worker.fetch>[1];
      const response = await worker.fetch(new Request(`${ORIGIN}/api/auth/password`, {
        method: "POST",
        headers: { origin: ORIGIN, "sec-fetch-site": "same-origin", "content-type": "application/json", cookie: `su_session=${rawToken}` },
        body: JSON.stringify({ newPassword: "safe-first-password-328" }),
      }), env, execution);
      expect(response.status).toBe(204);
      expect(kdfCalls).toBe(1);
      expect(sqlite.prepare("SELECT password_login_enabled,google_sub,password_iterations FROM users WHERE id='google-user'").get())
        .toEqual({ password_login_enabled: 1, google_sub: "google-subject", password_iterations: 600_000 });
      expect(sqlite.prepare("SELECT id FROM sessions WHERE user_id='google-user'").all()).toEqual([{ id: "current-google-session" }]);
    } finally {
      sqlite.close();
    }
  });
});
