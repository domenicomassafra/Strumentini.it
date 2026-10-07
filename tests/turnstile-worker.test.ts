import { describe, expect, it } from "vitest";
import { isLocalTurnstileHost, verifyTurnstileToken } from "../worker/turnstile";

const base = {
  secret: "secret",
  token: "token",
  remoteIp: "203.0.113.10",
  expectedHostname: "example.com",
  expectedAction: "login" as const,
};

describe("turnstile verification", () => {
  it("recognises only loopback/local development hosts", () => {
    expect(isLocalTurnstileHost("localhost")).toBe(true);
    expect(isLocalTurnstileHost("127.0.0.1")).toBe(true);
    expect(isLocalTurnstileHost("::1")).toBe(true);
    expect(isLocalTurnstileHost("unrelated-worker.example.workers.dev")).toBe(false);
  });

  it("requires a non-empty bounded token before any network call", async () => {
    let calls = 0;
    const fakeFetch = async (): Promise<Response> => {
      calls += 1;
      return new Response(JSON.stringify({ success: true, hostname: "example.com", action: "login" }));
    };
    expect(await verifyTurnstileToken({ ...base, token: "" }, fakeFetch)).toEqual({ ok: false, reason: "missing-token" });
    expect(await verifyTurnstileToken({ ...base, token: "x".repeat(2049) }, fakeFetch)).toEqual({ ok: false, reason: "missing-token" });
    expect(calls).toBe(0);
  });

  it("accepts only a successful response for the current hostname and action", async () => {
    const okFetch = async (): Promise<Response> =>
      new Response(JSON.stringify({ success: true, hostname: "example.com", action: "login" }), { status: 200 });
    expect(await verifyTurnstileToken(base, okFetch)).toEqual({ ok: true });

    const wrongHost = async (): Promise<Response> =>
      new Response(JSON.stringify({ success: true, hostname: "other.example", action: "login" }), { status: 200 });
    expect(await verifyTurnstileToken(base, wrongHost)).toEqual({ ok: false, reason: "invalid" });

    const wrongAction = async (): Promise<Response> =>
      new Response(JSON.stringify({ success: true, hostname: "example.com", action: "register" }), { status: 200 });
    expect(await verifyTurnstileToken(base, wrongAction)).toEqual({ ok: false, reason: "invalid" });
  });

  it("fails closed on rejected challenges and Siteverify outages", async () => {
    const rejected = async (): Promise<Response> =>
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 });
    expect(await verifyTurnstileToken(base, rejected)).toEqual({ ok: false, reason: "invalid" });

    const unavailable = async (): Promise<Response> => new Response("upstream", { status: 503 });
    expect(await verifyTurnstileToken(base, unavailable)).toEqual({ ok: false, reason: "unavailable" });

    const brokenJson = async (): Promise<Response> => new Response("not-json", { status: 200 });
    expect(await verifyTurnstileToken(base, brokenJson)).toEqual({ ok: false, reason: "unavailable" });
  });
});
