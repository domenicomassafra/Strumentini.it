import { describe, expect, it, vi } from "vitest";
import {
  UTM_DUPLICATE_POLICY,
  UTM_ENCODING_POLICY,
  buildUtmUrl,
  buildUtmUrlsBulk,
  cleanTrackingParameters,
  parseUtmUrl,
} from "../src/engines/campaign-url";
import {
  canonicalUrlDetails,
  compareUrls,
  inspectRedirectChainLive,
  parseOpenGraph,
  parseRobots,
  previewMeta,
  type RedirectFetcher,
} from "../src/engines/url-marketing";
import urlBulkNormalizerModule from "../src/tools/url-bulk-normalizer/module";
import redirectChainInspectorModule from "../src/tools/redirect-chain-inspector/module";

const context = { defaults: {} } as const;

function response(status: number, location: string | null = null) {
  return {
    status,
    headers: {
      get(name: string) {
        return name.toLowerCase() === "location" ? location : null;
      },
    },
  };
}

describe("tickets 321-325 URL/marketing upgrades", () => {
  it("round-trips Unicode UTM values, replaces duplicates, and preserves non-tracking parameters", () => {
    const base = "https://example.com/p?q=a%20b&q=a+b&raw=%2F&utm_source=old&utm_source=older#frag";
    const built = buildUtmUrl(
      base,
      { source: "naïve value", medium: "e-mail", campaign: "Caffè ☕" },
    );
    const parsed = parseUtmUrl(built);
    expect(parsed).toMatchObject({ source: "naïve value", medium: "e-mail", campaign: "Caffè ☕" });
    expect(parsed.utmParameters.filter(({ key }) => key === "utm_source")).toHaveLength(1);
    expect(built).toContain("q=a%20b&q=a+b&raw=%2F");
    expect(cleanTrackingParameters(built).url).toBe("https://example.com/p?q=a%20b&q=a+b&raw=%2F#frag");
    expect(UTM_ENCODING_POLICY).toContain("original raw encoding");
    expect(UTM_DUPLICATE_POLICY).toContain("first duplicate UTM value wins");
  });

  it("isolates UTM bulk failures per URL", () => {
    const result = buildUtmUrlsBulk(
      ["https://example.com/a?keep=1", "not a url", "https://example.com/b?keep=2"],
      { source: "newsletter", medium: "email", campaign: "ottobre" },
    );
    expect(result).toMatchObject({ count: 3, successCount: 2, errorCount: 1 });
    expect(result.rows[0]?.value?.url).toContain("keep=1");
    expect(result.rows[1]).toMatchObject({ sourceIndex: 1, sourceRow: 2, error: "INVALID_URL" });
    expect(result.rows[2]?.value?.url).toContain("keep=2");
  });

  it("centralizes preview authority, checked date, viewport, and approximation copy", () => {
    const search = previewMeta("Titolo 😀 molto lungo".repeat(8), "Descrizione", { preset: "search-desktop" });
    expect(search.previewPreset).toMatchObject({ id: "search-desktop", checkedAt: "2026-09-23", viewport: { width: 1280, height: 800 } });
    expect(search.previewPreset.source).toContain("Google Search Central");
    expect(search.previewPreset.approximationIt.toLowerCase()).toContain("indicativa");

    const social = parseOpenGraph('<meta property="og:title" content="😀 Titolo"><meta property="og:image" content="https://example.com/hero.png">', { preset: "social-card" });
    expect(social.previewPreset).toMatchObject({ id: "social-card", checkedAt: "2026-09-23", viewport: { width: 390, height: 844 } });
    expect(social.previewPreset.approximationIt.toLowerCase()).toContain("piattaforma");
  });

  it("keeps explicit normalization rules, before/after values, source rows, and isolated failures local", () => {
    const bulk = urlBulkNormalizerModule.run({
      urls: "https://example.com/a/?b=2&a=1&utm_source=x#frag\n\nnot a url",
      sortQuery: true,
      removeFragment: true,
      removeTrailingSlash: true,
      dropTracking: true,
    }, context) as {
      results: Array<{ sourceIndex: number; sourceRow: number; before: string; after?: string; error?: string }>;
      rules: Record<string, boolean>;
      network: string;
      verificationScope: string;
    };
    expect(bulk.results[0]).toMatchObject({
      sourceIndex: 0,
      sourceRow: 1,
      before: "https://example.com/a/?b=2&a=1&utm_source=x#frag",
      after: "https://example.com/a?a=1&b=2",
    });
    expect(bulk.results[1]).toMatchObject({ sourceIndex: 2, sourceRow: 3, error: "INVALID_URL" });
    expect(bulk.rules).toEqual({ sortQuery: true, removeFragment: true, removeTrailingSlash: true, dropTracking: true });
    expect(bulk).toMatchObject({ network: "not-used", verificationScope: "local-transform-only" });

    const comparison = compareUrls(
      "https://example.com/a/?utm_source=x&b=2&a=1#one",
      "https://example.com/a?a=1&b=2#two",
      { sortQuery: true, ignoreFragment: true, removeTrailingSlash: true, dropTracking: true },
    );
    expect(comparison.equal).toBe(true);
    expect(comparison.normalizationRules).toEqual({ sortQuery: true, ignoreFragment: true, removeTrailingSlash: true, dropTracking: true });
    expect(comparison.network).toBe("not-used");
  });

  it("keeps the pasted redirect mode local and performs live retrieval only in live mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const local = redirectChainInspectorModule.run({
      mode: "local",
      hops: [{ url: "https://example.com/a", status: 301, location: "https://example.com/b" }],
    }, context) as { hopCount: number };
    expect(local.hopCount).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const calls: string[] = [];
    const fetcher: RedirectFetcher = async (url) => {
      calls.push(url);
      if (url.endsWith("/a")) return response(301, "/b");
      if (url.endsWith("/b")) return response(302, "/a");
      return response(200);
    };
    const live = await inspectRedirectChainLive("https://example.com/a", {
      fetcher,
      now: () => "2026-10-06T19:40:00.000Z",
    });
    expect(calls).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(live).toMatchObject({
      outcome: "loop",
      loopDetected: true,
      hopCount: 2,
      terminalUrl: "https://example.com/a",
      retrievedAt: "2026-10-06T19:40:00.000Z",
      network: "used",
    });
    expect(live.privacyBoundary).toContain("unrelated task data");
  });

  it("returns partial live evidence on timeout and blocked requests", async () => {
    const timeoutFetcher: RedirectFetcher = (_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")), { once: true });
    });
    const timedOut = await inspectRedirectChainLive("https://example.com/a", {
      fetcher: timeoutFetcher,
      timeoutMs: 5,
      now: () => "2026-10-06T19:41:00.000Z",
    });
    expect(timedOut).toMatchObject({ outcome: "timeout", hopCount: 0, terminalUrl: "https://example.com/a", failureCode: "REQUEST_TIMEOUT" });

    const blocked = await inspectRedirectChainLive("https://example.com/a", {
      fetcher: async () => { throw new TypeError("CORS blocked"); },
      now: () => "2026-10-06T19:42:00.000Z",
    });
    expect(blocked).toMatchObject({ outcome: "blocked", hopCount: 0, failureCode: "NETWORK_REQUEST_BLOCKED" });
  });

  it("labels canonical and robots output as local syntax guidance rather than live verification", () => {
    const canonical = canonicalUrlDetails("https://example.com/a", "/b");
    expect(canonical).toMatchObject({ guidanceScope: "local-syntax", network: "not-used", guidanceCheckedAt: "2026-09-23" });
    expect(canonical.guidanceSource).toContain("canonical");

    const robots = parseRobots("User-agent: *\nDisallow: /private");
    expect(robots).toMatchObject({ guidanceScope: "local-syntax", network: "not-used", guidanceCheckedAt: "2026-09-23" });
    expect(robots.guidanceSource).toContain("robots.txt");
  });
});
