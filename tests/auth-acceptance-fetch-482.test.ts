import { afterEach, describe, expect, it, vi } from "vitest";
import { authAcceptanceFetch } from "../scripts/lib/auth-acceptance-fetch.mjs";

const URL = "http://127.0.0.1:18141/api/auth/account";
const INIT = { method: "DELETE", body: JSON.stringify({ password: "synthetic" }) };
const limited = (seconds = "60") => new Response("limited", { status: 429, headers: { "retry-after": seconds } });

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("#482 auth consumer respects private KDF admission", () => {
  it.each([204, 401])("waits the full Retry-After then exposes the actual HTTP %i", async (status) => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(new Response(null, { status }));
    vi.stubGlobal("fetch", fetch);
    const pending = authAcceptanceFetch(URL, INIT);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).status).toBe(status);
    expect(fetch.mock.calls).toEqual([[URL, INIT], [URL, INIT]]);
  });

  it("returns the hard login limiter unchanged without retrying", async () => {
    const response = limited("900");
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetch);
    expect(await authAcceptanceFetch(URL, INIT)).toBe(response);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the final rate-limit probe raw even with Retry-After60", async () => {
    const response = limited();
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetch);
    expect(await authAcceptanceFetch(URL, INIT, false)).toBe(response);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not turn persistent429 into success or retry indefinitely", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(limited()));
    vi.stubGlobal("fetch", fetch);
    const pending = authAcceptanceFetch(URL, INIT);
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await pending).status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
