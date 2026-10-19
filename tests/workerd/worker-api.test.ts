import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "http://localhost:8787";
const PASSWORD = "synthetic-password-285";
const EMAIL = "workerd285@example.invalid";

function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function sameOrigin(cookie?: string): Record<string, string> {
  return {
    origin: ORIGIN,
    "sec-fetch-site": "same-origin",
    ...(cookie === undefined ? {} : { cookie }),
  };
}

async function dispatch(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<Response> {
  return exports.default.fetch(request(method, path, body, headers));
}

function sessionCookie(response: Response): string {
  const cookie = response.headers.get("set-cookie") ?? "";
  expect(cookie).toMatch(/^su_session=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=2592000$/u);
  return cookie.split(";", 1)[0]!;
}

async function count(table: "users" | "sessions" | "favorites" | "favorite_sync_events"): Promise<number> {
  const record = await env.AUTH_DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first<{ total: number }>();
  return record?.total ?? -1;
}

describe("#285 real workerd Worker/D1/DO integration", () => {
  beforeEach(() => {
    // An accidental Turnstile/Google/VIES call fails locally instead of using the network.
    vi.stubGlobal("fetch", () => { throw new Error("Outbound network forbidden in #285"); });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("preserves anonymous JSON session, 404/405 Allow and local asset fallback", async () => {
    const session = await dispatch("GET", "/api/auth/session");
    expect(session.status).toBe(200);
    expect(session.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(session.headers.get("cache-control")).toBe("no-store");
    expect(session.headers.has("set-cookie")).toBe(false);
    expect(await session.json()).toEqual({ user: null });

    const unknown = await dispatch("GET", "/api/unknown");
    expect(unknown.status).toBe(404);
    expect((await unknown.json() as { error: string }).error).toBeTruthy();
    const method = await dispatch("POST", "/api/auth/session", {});
    expect(method.status).toBe(405);
    expect(method.headers.get("allow")).toBe("GET");
    expect(method.headers.has("set-cookie")).toBe(false);
    expect((await method.json() as { error: string }).error).toBeTruthy();

    const asset = await dispatch("GET", "/local-fixture");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("local asset fixture");
  });

  it("rejects cross-origin and forged fetch metadata before changing D1", async () => {
    for (const headers of [
      { origin: "https://evil.example.invalid", "sec-fetch-site": "cross-site" },
      { origin: "http://sibling.localhost:8787", "sec-fetch-site": "same-site" },
      { origin: ORIGIN, "sec-fetch-site": "cross-site" },
    ]) {
      const rejected = await dispatch("POST", "/api/auth/register", {
        email: EMAIL, name: "Workerd", password: PASSWORD,
      }, headers);
      expect(rejected.status).toBe(403);
      expect(rejected.headers.get("cache-control")).toBe("no-store");
      expect(rejected.headers.has("access-control-allow-origin")).toBe(false);
      expect(rejected.headers.has("set-cookie")).toBe(false);
      expect((await rejected.json() as { error: string }).error).toBeTruthy();
    }
    expect(await count("users")).toBe(0);
    expect(await count("sessions")).toBe(0);
  });

  it("executes the real PasswordKdf Durable Object with bounded requests", async () => {
    const stub = env.PASSWORD_KDF!.getByName("password-kdf-v1-shard-00");
    const missing = await stub.fetch(new Request("http://do.internal/not-derive"));
    expect(missing.status).toBe(404);
    const invalid = await stub.fetch(new Request("http://do.internal/derive", { method: "POST", body: "{}" }));
    expect(invalid.status).toBe(400);
    const derived = await stub.fetch(new Request("http://do.internal/derive", {
      method: "POST",
      body: JSON.stringify({ password: "edge", salt: [1, 2, 3, 4], iterations: 1000 }),
    }));
    expect(derived.status).toBe(200);
    expect(derived.headers.get("cache-control")).toBe("no-store");
    const result = await derived.json() as { key: number[] };
    expect(result.key).toHaveLength(32);
    expect(result.key).toEqual([89, 188, 27, 238, 131, 42, 198, 100, 213, 46, 194, 169, 74, 50, 66, 193, 138, 95, 73, 199, 43, 221, 195, 165, 218, 223, 128, 200, 176, 225, 48, 115]);
  });

  it("registers, syncs favorites and logs out through real D1 and PasswordKdf", async () => {
    const payload = { email: EMAIL, name: "Workerd Test", password: PASSWORD };
    const registered = await dispatch("POST", "/api/auth/register", payload, sameOrigin());
    expect(registered.status).toBe(201);
    const registerCookie = sessionCookie(registered);
    expect(await registered.json()).toEqual({ user: {
      email: EMAIL, name: "Workerd Test", passwordEnabled: true, googleConnected: false,
    } });
    expect(await count("users")).toBe(1);
    expect(await count("sessions")).toBe(1);

    const duplicate = await dispatch("POST", "/api/auth/register", payload, sameOrigin());
    expect(duplicate.status).toBe(409);
    expect(duplicate.headers.has("set-cookie")).toBe(false);
    expect(await count("users")).toBe(1);
    expect(await count("sessions")).toBe(1);

    const current = await dispatch("GET", "/api/auth/session", undefined, { cookie: registerCookie });
    expect(current.status).toBe(200);
    expect(await current.json()).toEqual({ user: {
      email: EMAIL, name: "Workerd Test", passwordEnabled: true, googleConnected: false,
    } });

    const rejectedLogin = await dispatch("POST", "/api/auth/login", { email: EMAIL, password: PASSWORD }, {
      origin: "https://untrusted.example.invalid", "sec-fetch-site": "cross-site",
    });
    expect(rejectedLogin.status).toBe(403);
    expect(await count("sessions")).toBe(1);
    const cookie = registerCookie;

    const put = await dispatch("PUT", "/api/favorites/date-difference", undefined, sameOrigin(cookie));
    expect(put.status).toBe(204);
    expect(await count("favorites")).toBe(1);
    const favorites = await dispatch("GET", "/api/favorites", undefined, { cookie });
    expect(favorites.status).toBe(200);
    expect(await favorites.json()).toEqual({ tools: ["date-difference"] });

    const sync = await dispatch("GET", "/api/favorites/sync", undefined, { cookie });
    expect(sync.status).toBe(200);
    const snapshot = await sync.json() as { account: string; revision: number; tools: string[] };
    expect(snapshot.account).toBeTruthy();
    expect(snapshot.tools).toEqual(["date-difference"]);
    expect(snapshot.revision).toBeGreaterThan(0);
    const rejectedSync = await dispatch("POST", "/api/favorites/sync", {
      toolId: "new-favorite", installed: true, baseRevision: snapshot.revision,
      operationId: crypto.randomUUID(), expectedAccount: "wrong-account",
    }, sameOrigin(cookie));
    expect(rejectedSync.status).toBe(409);
    expect(await count("favorites")).toBe(1);
    const changedSync = await dispatch("POST", "/api/favorites/sync", {
      toolId: "new-favorite", installed: true, baseRevision: snapshot.revision,
      operationId: crypto.randomUUID(), expectedAccount: snapshot.account,
    }, sameOrigin(cookie));
    expect(changedSync.status).toBe(200);
    expect((await changedSync.json() as { applied: boolean }).applied).toBe(true);
    expect(await count("favorites")).toBe(2);
    const wrongOrigin = await dispatch("DELETE", "/api/favorites/date-difference", undefined, {
      ...sameOrigin(cookie), origin: "https://untrusted.example.invalid",
    });
    expect(wrongOrigin.status).toBe(403);
    expect(await count("favorites")).toBe(2);

    const removed = await dispatch("DELETE", "/api/favorites/date-difference", undefined, sameOrigin(cookie));
    expect(removed.status).toBe(204);
    expect(await count("favorites")).toBe(1);
    expect(await count("favorite_sync_events")).toBeGreaterThan(0);

    const logout = await dispatch("POST", "/api/auth/logout", undefined, sameOrigin(cookie));
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await count("sessions")).toBe(0);
    expect(await (await dispatch("GET", "/api/auth/session", undefined, { cookie })).json()).toEqual({ user: null });
  }, 60_000);

  it("rolls back a failed multi-statement D1 batch and resets test storage", async () => {
    expect(await count("users")).toBe(0);
    await expect(env.AUTH_DB.batch([
      env.AUTH_DB.prepare("INSERT INTO users (id,email,name,password_hash,password_salt,password_iterations,created_at,updated_at,password_login_enabled) VALUES ('user-285','batch@example.invalid','Batch','hash','salt',1,'2026-10-19','2026-10-19',1)"),
      env.AUTH_DB.prepare("INSERT INTO users (id,email,name,password_hash,password_salt,password_iterations,created_at,updated_at,password_login_enabled) VALUES ('user-285','batch@example.invalid','Duplicate','hash','salt',1,'2026-10-19','2026-10-19',1)"),
    ])).rejects.toThrow();
    expect(await count("users")).toBe(0);
  });
});
