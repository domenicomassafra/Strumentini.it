import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {},
}));

import worker from "../worker/index";
import { MESSAGES } from "../worker/validation";

const url = "https://strumentini.it/api/auth/session";
const execution = { waitUntil() {} } as unknown as ExecutionContext;

function envWith(db: unknown) {
  return {
    ASSETS: { fetch: async () => new Response("static") },
    AUTH_DB: db,
  } as unknown as Parameters<typeof worker.fetch>[1];
}

const throwingDb = { prepare() { throw new Error("synthetic D1 outage"); } };

function sessionDb(row: Record<string, unknown> | null, writes: string[] = []) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            first: async () => row,
            run: async () => { writes.push(sql); return { success: true, meta: { changes: 1 } }; },
          };
        },
        first: async () => row,
        run: async () => { writes.push(sql); return { success: true, meta: { changes: 1 } }; },
      };
    },
  };
}

const liveRow = {
  session_id: "synthetic-session", token_hash: "hash", session_user_id: "synthetic-user",
  session_created_at: "2026-11-01T00:00:00.000Z", expires_at: "2099-01-01T00:00:00.000Z",
  last_seen_at: new Date().toISOString(), user_agent: "vitest",
  user_id: "synthetic-user", email: "owner@example.invalid", name: "Owner",
  password_hash: "pbkdf2-sha256$AAAA", password_salt: "AAAA", password_iterations: 1000,
  password_login_enabled: 1, google_sub: null,
  user_created_at: "2026-11-01T00:00:00.000Z", updated_at: "2026-11-01T00:00:00.000Z",
};

function sessionRequest(cookie?: string): Request {
  return new Request(url, { headers: cookie === undefined ? {} : { cookie } });
}

describe("#557 /api/auth/session does not mask a D1 outage as a valid logout", () => {
  it("answers 503 with a structured error when the session store is unavailable", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await worker.fetch(sessionRequest("su_session=synthetic-current-cookie"), envWith(throwingDb), execution);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as Record<string, unknown>;
    expect(body).toEqual({ error: MESSAGES.sessionUnavailable });
    expect("user" in body).toBe(false);
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });

  it("keeps 200 {user:null} for a browser without a session cookie and never touches D1", async () => {
    const response = await worker.fetch(sessionRequest(), envWith(throwingDb), execution);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
  });

  it("keeps 200 {user:null} for an expired session instead of reporting an outage", async () => {
    const writes: string[] = [];
    const expired = { ...liveRow, expires_at: "2020-01-01T00:00:00.000Z" };
    const response = await worker.fetch(sessionRequest("su_session=synthetic-expired"), envWith(sessionDb(expired, writes)), execution);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
    expect(writes.length).toBe(1);
  });

  it("still reports the signed-in user for a live session", async () => {
    const response = await worker.fetch(sessionRequest("su_session=synthetic-current"), envWith(sessionDb(liveRow)), execution);
    expect(response.status).toBe(200);
    const body = await response.json() as { user?: Record<string, unknown> };
    expect(body.user).toMatchObject({ email: "owner@example.invalid", name: "Owner" });
  });
});
