import { env, exports } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../../worker/index";
import { sha256Hex } from "../../worker/auth";

const ORIGIN = "http://localhost:8787";
const EMAIL = "delete482@example.invalid";
const PASSWORD = "synthetic-delete-password-482";

let client = 0;

async function dispatch(method: string, path: string, cookie?: string, body?: unknown, bindings?: Env): Promise<Response> {
  const request = new Request(ORIGIN + path, {
    method,
    headers: { origin: ORIGIN, "sec-fetch-site": "same-origin", "cf-connecting-ip": "192.0.2." + client,
      ...(cookie === undefined ? {} : { cookie }),
      ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (bindings === undefined) return exports.default.fetch(request);
  const execution = createExecutionContext();
  const response = await worker.fetch(request, bindings, execution);
  await waitOnExecutionContext(execution);
  return response;
}

function cookie(response: Response): string {
  const value = response.headers.get("set-cookie") ?? "";
  expect(value).toMatch(/^su_session=[A-Za-z0-9_-]{43};/u);
  return value.split(";", 1)[0]!;
}

// Independent Node crypto.pbkdf2Sync("edge", [1,2,3,4], 600_000, 32, "sha256").
// Seed real credentials without paying registration KDF on every negative case.
const VECTOR = [
  215, 162, 35, 58, 234, 235, 220, 193, 94, 181, 26, 48, 149, 187, 236, 93,
  203, 176, 151, 160, 223, 19, 220, 134, 251, 211, 66, 154, 38, 252, 253, 113,
];

async function fixture(): Promise<void> {
  const hash = "pbkdf2-sha256$" + btoa(String.fromCharCode(...VECTOR)).replace(/=+$/u, "").replaceAll("+", "-").replaceAll("/", "_");
  const at = new Date().toISOString();
  await env.AUTH_DB.prepare("INSERT INTO users (id,email,name,password_hash,password_salt,password_iterations,created_at,updated_at,password_login_enabled) VALUES ('owner482',?1,'Retained',?2,'AQIDBA',600000,?3,?3,1)").bind(EMAIL, hash, at).run();
  for (const id of ["caller", "survivor"]) {
    await env.AUTH_DB.prepare("INSERT INTO sessions (id,token_hash,user_id,created_at,expires_at,last_seen_at) VALUES (?1,?2,'owner482',?3,'2099-01-01',?3)").bind(id, await sha256Hex(id), at).run();
  }
  expect((await dispatch("PUT", "/api/favorites/date-difference", "su_session=survivor")).status).toBe(204);
}

async function retained(sessions: readonly string[] = ["caller", "survivor"]): Promise<void> {
  expect(await env.AUTH_DB.prepare("SELECT COUNT(*) AS n FROM users").first("n")).toBe(1);
  expect((await env.AUTH_DB.prepare("SELECT id FROM sessions ORDER BY id").all<{ id: string }>()).results)
    .toEqual(sessions.map((id) => ({ id })));
  for (const id of sessions) {
    const current = await dispatch("GET", "/api/auth/session", "su_session=" + id);
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({ user: { email: EMAIL } });
    expect(await (await dispatch("GET", "/api/favorites", "su_session=" + id)).json())
      .toEqual({ tools: ["date-difference"] });
  }
}

function rejected(response: Response): void {
  expect(response.status).toBe(401);
  expect(response.headers.has("set-cookie")).toBe(false);
}

async function deleteDuringKdf(mutate: () => Promise<void>): Promise<Response> {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  // Gate only the private transport response: the real DO still computes the
  // original 600k bytes. The mutation commits before verification can resume.
  const pending = dispatch("DELETE", "/api/auth/account", "su_session=caller", { password: "edge" }, {
    ...env,
    PASSWORD_KDF: { getByName(name) { return { async fetch(request) {
      const result = env.PASSWORD_KDF!.getByName(name).fetch(request);
      started.resolve();
      const response = await result;
      expect(response.status).toBe(200);
      await release.promise;
      return response;
    } }; } },
  });
  try {
    await Promise.race([started.promise, pending.then(() => { throw new Error("DELETE did not reach private KDF"); })]);
    await mutate();
  } finally {
    release.resolve();
    await pending;
  }
  return pending;
}

describe("#482 account deletion on real Workerd/D1", () => {
  beforeEach(() => {
    client += 1;
    vi.stubGlobal("fetch", () => { throw new Error("Outbound network forbidden in #482"); });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("deletes an authorized account with sessions and favorites, returns 204 and clears the cookie", async () => {
    const registered = await dispatch("POST", "/api/auth/register", undefined, {
      email: EMAIL, name: "Delete Test", password: PASSWORD,
    });
    expect(registered.status).toBe(201);
    const firstCookie = cookie(registered);
    const loggedIn = await dispatch("POST", "/api/auth/login", undefined, { email: EMAIL, password: PASSWORD });
    expect(loggedIn.status).toBe(200);
    const secondCookie = cookie(loggedIn);
    expect((await dispatch("PUT", "/api/favorites/date-difference", firstCookie)).status).toBe(204);
    expect(await (await dispatch("GET", "/api/favorites", secondCookie)).json()).toEqual({ tools: ["date-difference"] });

    const deleted = await dispatch("DELETE", "/api/auth/account", firstCookie, { password: PASSWORD });
    // Capture the full public symptom, not merely the now-anonymous session.
    expect.soft(deleted.status).toBe(204);
    expect.soft(deleted.headers.get("set-cookie")).toBe("su_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    for (const session of [firstCookie, secondCookie]) {
      expect(await (await dispatch("GET", "/api/auth/session", session)).json()).toEqual({ user: null });
      expect((await dispatch("GET", "/api/favorites", session)).status).toBe(401);
    }
    const login = await dispatch("POST", "/api/auth/login", undefined, { email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.headers.has("set-cookie")).toBe(false);
    // Cascades must remove all owned data, not just the authenticating session.
    for (const table of ["users", "sessions", "favorites", "favorite_sync_events", "favorite_sync_state", "favorite_sync_migrated_accounts"] as const) {
      expect(await env.AUTH_DB.prepare("SELECT COUNT(*) AS n FROM " + table).first("n")).toBe(0);
    }
  });

  it("rejects a wrong password without deleting the account or either valid session", async () => {
    await fixture();
    rejected(await dispatch("DELETE", "/api/auth/account", "su_session=caller", { password: "wrong-password" }));
    await retained();
  });

  it("rejects deletion when another device revokes the caller during the real KDF", async () => {
    await fixture();
    const response = await deleteDuringKdf(async () => {
      expect((await dispatch("DELETE", "/api/auth/sessions/caller", "su_session=survivor")).status).toBe(204);
    });
    rejected(response);
    await retained(["survivor"]);
    expect(await (await dispatch("GET", "/api/auth/session", "su_session=caller")).json()).toEqual({ user: null });
  });

  it.each([
    ["password_hash", "pbkdf2-sha256$newer-digest"],
    ["password_salt", "bmV3ZXItc2FsdA"],
    ["password_iterations", 600_001],
    ["password_login_enabled", 0],
  ] as const)("retains account and both sessions when %s changes during KDF", async (column, value) => {
    await fixture();
    let concurrentUser: unknown;
    const response = await deleteDuringKdf(async () => {
      // Synthetic concurrent writer changes just one CAS field. Both sessions
      // stay live, so the credential guard is proven independently of revocation.
      await env.AUTH_DB.prepare("UPDATE users SET " + column + " = ?1 WHERE id = 'owner482'").bind(value).run();
      concurrentUser = await env.AUTH_DB.prepare("SELECT * FROM users WHERE id = 'owner482'").first();
    });
    rejected(response);
    expect(await env.AUTH_DB.prepare("SELECT * FROM users WHERE id = 'owner482'").first()).toEqual(concurrentUser);
    await retained();
  });

  it("rejects a caller that expires during KDF while retaining the other device", async () => {
    await fixture();
    rejected(await deleteDuringKdf(async () => {
      await env.AUTH_DB.prepare("UPDATE sessions SET expires_at = '2000-01-01' WHERE id = 'caller'").run();
    }));
    expect(await env.AUTH_DB.prepare("SELECT COUNT(*) AS n FROM sessions").first("n")).toBe(2);
    expect(await (await dispatch("GET", "/api/auth/session", "su_session=caller")).json()).toEqual({ user: null });
    await retained(["survivor"]);
  });

  it("accepts the independent 600k fixture when credentials and session remain live", async () => {
    await fixture();
    const response = await dispatch("DELETE", "/api/auth/account", "su_session=caller", { password: "edge" });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await env.AUTH_DB.prepare("SELECT COUNT(*) AS n FROM users").first("n")).toBe(0);
  });
});
