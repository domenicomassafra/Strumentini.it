import { describe, expect, it, vi } from "vitest";
import {
  clearGoogleNonceCookie,
  createGoogleNonce,
  googleNonceCookie,
  readGoogleNonce,
  verifyGoogleCredential,
} from "../worker/google";

const encoder = new TextEncoder();

function base64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return Buffer.from(bytes).toString("base64url");
}

async function signingFixture() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const key = { ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" };

  async function token(claims: Record<string, unknown>): Promise<string> {
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-key" }));
    const payload = base64Url(JSON.stringify(claims));
    const unsigned = `${header}.${payload}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, encoder.encode(unsigned));
    return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  }

  const fakeFetch = async (): Promise<Response> =>
    new Response(JSON.stringify({ keys: [key] }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
    });

  return { token, fakeFetch };
}

describe("Google authentication verifier", () => {
  it("creates a short-lived HttpOnly nonce cookie and reads it back", () => {
    const nonce = createGoogleNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(nonce.length).toBeGreaterThanOrEqual(20);
    const cookie = googleNonceCookie(nonce);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/auth/google");
    expect(readGoogleNonce(new Request("https://example.com/", { headers: { cookie } }))).toBe(nonce);
    expect(clearGoogleNonceCookie()).toContain("Max-Age=0");
  });

  it("accepts a correctly signed Google ID token for this client and nonce", async () => {
    const { token, fakeFetch } = await signingFixture();
    const now = new Date("2026-10-03T12:00:00.000Z");
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const credential = await token({
      iss: "https://accounts.google.com",
      aud: "client-id.apps.googleusercontent.com",
      sub: "google-subject-123",
      email: "Person@Example.com",
      email_verified: true,
      name: "Persona Test",
      nonce: "expected-nonce",
      iat: nowSeconds - 10,
      exp: nowSeconds + 300,
    });

    const result = await verifyGoogleCredential(
      credential,
      "client-id.apps.googleusercontent.com",
      "expected-nonce",
      { now, fetchImpl: fakeFetch },
    );
    expect(result).toEqual({
      ok: true,
      profile: {
        subject: "google-subject-123",
        email: "person@example.com",
        name: "Persona Test",
      },
    });
  });

  it("rejects wrong audience, nonce, unverified email and expired credentials", async () => {
    const { token, fakeFetch } = await signingFixture();
    const now = new Date("2026-10-03T12:00:00.000Z");
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const base = {
      iss: "accounts.google.com",
      aud: "client-id.apps.googleusercontent.com",
      sub: "subject",
      email: "person@example.com",
      email_verified: true,
      nonce: "nonce",
      iat: nowSeconds - 10,
      exp: nowSeconds + 300,
    };

    const wrongAudience = await token({ ...base, aud: "other-client" });
    expect(await verifyGoogleCredential(wrongAudience, base.aud, base.nonce, { now, fetchImpl: fakeFetch }))
      .toEqual({ ok: false, reason: "invalid" });

    const wrongNonce = await token(base);
    expect(await verifyGoogleCredential(wrongNonce, base.aud, "different", { now, fetchImpl: fakeFetch }))
      .toEqual({ ok: false, reason: "invalid" });

    const unverified = await token({ ...base, email_verified: false });
    expect(await verifyGoogleCredential(unverified, base.aud, base.nonce, { now, fetchImpl: fakeFetch }))
      .toEqual({ ok: false, reason: "invalid" });

    const expired = await token({ ...base, exp: nowSeconds - 1 });
    expect(await verifyGoogleCredential(expired, base.aud, base.nonce, { now, fetchImpl: fakeFetch }))
      .toEqual({ ok: false, reason: "invalid" });
  });

  it("fails closed when Google's verification keys are unavailable", async () => {
    const result = await verifyGoogleCredential(
      "header.payload.signature",
      "client-id",
      "nonce",
      {
        fetchImpl: async () => new Response("upstream unavailable", { status: 503 }),
      },
    );
    // Malformed JWT parts are rejected before any network dependency.
    expect(result).toEqual({ ok: false, reason: "invalid" });

    const { token } = await signingFixture();
    const now = new Date("2026-10-03T12:00:00.000Z");
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const structurallyValid = await token({
      iss: "https://accounts.google.com",
      aud: "client-id",
      sub: "subject",
      email: "person@example.com",
      email_verified: true,
      nonce: "nonce",
      exp: nowSeconds + 300,
    });
    expect(await verifyGoogleCredential(structurallyValid, "client-id", "nonce", {
      now,
      fetchImpl: async () => new Response("upstream unavailable", { status: 503 }),
    })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("refreshes Google signing keys after the advertised cache max-age", async () => {
    const { token, fakeFetch } = await signingFixture();
    const now = new Date("2026-10-03T12:00:00.000Z");
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const credential = await token({
      iss: "https://accounts.google.com",
      aud: "client-id",
      sub: "google-cache-subject",
      email: "person@example.com",
      email_verified: true,
      nonce: "expected-nonce",
      exp: nowSeconds + 1800,
    });
    let fetchCount = 0;
    vi.stubGlobal("fetch", async () => {
      fetchCount += 1;
      const response = await fakeFetch();
      response.headers.set("cache-control", "public, max-age=60");
      return response;
    });
    try {
      expect((await verifyGoogleCredential(credential, "client-id", "expected-nonce", { now })).ok).toBe(true);
      expect((await verifyGoogleCredential(credential, "client-id", "expected-nonce", {
        now: new Date(now.getTime() + 61_000),
      })).ok).toBe(true);
      expect(fetchCount).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

});
