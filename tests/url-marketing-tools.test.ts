import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseUtmUrl } from "../src/engines/campaign-url";
import {
  checkSocialLimit,
  compareUrls,
  normalizeUrlDetails,
} from "../src/engines/url-marketing";
import { decodeQrMatrix, generateQr, readQr } from "../src/engines/qr";
import { calculateConversionRate, calculateRoas } from "../src/engines/marketing-math";
import urlComparisonModule from "../src/tools/url-comparison/module";
import urlBulkNormalizerModule from "../src/tools/url-bulk-normalizer/module";
import qrGeneratorModule from "../src/tools/qr-generator/module";
import qrReaderModule from "../src/tools/qr-reader/module";
import socialCharacterLimitModule from "../src/tools/social-character-limit/module";
import metaPreviewModule from "../src/tools/meta-preview/module";
import openGraphPreviewModule from "../src/tools/open-graph-preview/module";
import robotsDirectiveHelperModule from "../src/tools/robots-directive-helper/module";
import canonicalUrlHelperModule from "../src/tools/canonical-url-helper/module";
import redirectChainInspectorModule from "../src/tools/redirect-chain-inspector/module";
import bulkDomainExtractorModule from "../src/tools/bulk-domain-extractor/module";
import domainSubdomainGrouperModule from "../src/tools/domain-subdomain-grouper/module";
import emailDomainExtractorModule from "../src/tools/email-domain-extractor/module";
import roasCalculatorModule from "../src/tools/roas-calculator/module";
import cpaCpcCpmCalculatorModule from "../src/tools/cpa-cpc-cpm-calculator/module";
import conversionRateScenarioModule from "../src/tools/conversion-rate-scenario/module";

const context = { defaults: {} } as const;
const targetTools = [
  "utm-builder",
  "utm-parser",
  "tracking-cleaner",
  "url-comparison",
  "url-bulk-normalizer",
  "qr-generator",
  "qr-reader",
  "campaign-name",
  "social-character-limit",
  "meta-preview",
  "open-graph-preview",
  "robots-directive-helper",
  "canonical-url-helper",
  "redirect-chain-inspector",
  "bulk-domain-extractor",
  "domain-subdomain-grouper",
  "email-domain-extractor",
  "roas-calculator",
  "cpa-cpc-cpm-calculator",
  "conversion-rate-scenario",
] as const;

describe("URL, marketing, and web operations", () => {
  it("parses repeated UTM fields without losing query order", () => {
    const parsed = parseUtmUrl("https://example.com/?a=1&utm_source=a&utm_source=b&utm_campaign=x%20y#frag");
    expect(parsed).toMatchObject({ source: "a", campaign: "x y", hasCredentials: false });
    expect(parsed.utmParameters).toEqual([
      { key: "utm_source", value: "a" },
      { key: "utm_source", value: "b" },
      { key: "utm_campaign", value: "x y" },
    ]);
    expect(parsed.unknownParameters).toEqual([{ key: "a", value: "1" }]);
  });

  it("compares semantic and exact URL forms and redacts credentials", () => {
    expect((urlComparisonModule.run({ leftUrl: "https://EXAMPLE.com:443/a?b=2&a=1#one", rightUrl: "https://example.com/a?a=1&b=2#two" }, context) as { equal: boolean }).equal).toBe(true);
    expect(compareUrls("https://example.com/a?a=1", "https://example.com/a?a=1", { mode: "exact" }).equal).toBe(true);
    const redacted = normalizeUrlDetails("https://user:pass@example.com/path");
    expect(redacted).toMatchObject({ url: "https://example.com/path", credentialWarning: true });
    expect(() => compareUrls("javascript:alert(1)", "https://example.com")).toThrow("UNSAFE_URL_SCHEME");
  });

  it("normalizes a bulk list with row-level errors and stable output", () => {
    const output = urlBulkNormalizerModule.run({ urls: ["HTTPS://EXAMPLE.com/?b=2&a=1", "not a url"] }, context) as { normalizedUrls: string[]; errorCount: number };
    expect(output.errorCount).toBe(1);
    expect(output.normalizedUrls).toEqual(["https://example.com/?a=1&b=2"]);
    expect((urlBulkNormalizerModule.run({ urls: ["https://user:pass@example.com/private"] }, context) as { results: { input: string }[] }).results[0]?.input).toBe("https://[redacted]@example.com/private");
    expect(normalizeUrlDetails(output.normalizedUrls[0]!, { sortQuery: true }).url).toBe(output.normalizedUrls[0]);
  });

  it("generates and independently-shaped-decodes QR matrices and SVG data", async () => {
    const generated = qrGeneratorModule.run({ payload: "https://example.com/?a=1&b=2" }, context) as ReturnType<typeof generateQr>;
    expect(generated.version).toBe(2);
    expect(generated.size).toBe(25);
    expect(decodeQrMatrix(generated.matrix)).toBe("https://example.com/?a=1&b=2");
    expect(generated.svg).toContain("data-matrix=");
    expect(((await qrReaderModule.run({ svg: generated.svg }, context, undefined)) as { payload: string }).payload).toBe("https://example.com/?a=1&b=2");
    expect(((await qrReaderModule.run(generated.svg, context, undefined)) as { payload: string }).payload).toBe("https://example.com/?a=1&b=2");
    const unicode = generateQr("こんにちは");
    expect(await readQr({ matrix: unicode.matrix })).toMatchObject({ payload: "こんにちは", version: 1, size: 21 });
  });

  it("checks social limits using Unicode code points and meta output stays inert", () => {
    expect(checkSocialLimit("x", "😀")).toMatchObject({ characters: 1, remaining: 279, withinLimit: true });
    const meta = metaPreviewModule.run({ title: "<hello>", description: "A & B" }, context) as { escapedTitle: string; titleCharacters: number };
    expect(meta).toMatchObject({ escapedTitle: "&lt;hello&gt;", titleCharacters: 7 });
    expect(socialCharacterLimitModule.run({ platform: "linkedin", text: "hello" }, context)).toMatchObject({ limit: 3000, withinLimit: true });
  });

  it("parses Open Graph and robots metadata as data", () => {
    const social = openGraphPreviewModule.run({ html: '<meta property="og:title" content="A &amp; B"><meta property="og:image" content="/image.png">' }, context) as { title: string; image: string; warnings: string[] };
    expect(social.title).toBe("A & B");
    expect(social.image).toBe("https://preview.invalid/image.png");
    expect(social.warnings).toEqual(expect.arrayContaining(["MISSING_DESCRIPTION", "MISSING_URL"]));
    expect(robotsDirectiveHelperModule.run({ text: "User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml" }, context)).toMatchObject({ groups: [{ userAgents: ["*"], rules: [{ directive: "disallow", path: "/private" }] }], sitemaps: ["https://example.com/sitemap.xml"] });
  });

  it("builds safe canonical tags and inspects pasted redirect hops", () => {
    const canonical = canonicalUrlHelperModule.run({ pageUrl: "https://example.com/articles/one", canonicalUrl: "../canonical" }, context) as { canonicalUrl: string; html: string; sameOrigin: boolean };
    expect(canonical).toMatchObject({ canonicalUrl: "https://example.com/canonical", sameOrigin: true });
    expect(canonical.html).toContain('rel="canonical"');
    const chain = redirectChainInspectorModule.run({ hops: [{ url: "https://example.com/a", status: 301, location: "https://example.com/b" }, { url: "https://example.com/b", status: 200, location: null }] }, context) as { hopCount: number; warnings: string[] };
    expect(chain).toMatchObject({ hopCount: 2, warnings: [] });
    const loop = redirectChainInspectorModule.run({ hops: [{ url: "https://example.com/a", status: 301, location: "https://example.com/a" }, { url: "https://example.com/a", status: 301, location: "https://example.com/a" }] }, context) as { loopDetected: boolean };
    expect(loop.loopDetected).toBe(true);
  });

  it("extracts, groups, and deduplicates domain and email inputs", () => {
    const domains = bulkDomainExtractorModule.run({ text: "https://www.Example.com/a https://api.example.com/b example.org" }, context) as { domains: string[] };
    expect(domains.domains).toEqual(["www.example.com", "api.example.com", "example.org"]);
    const groups = domainSubdomainGrouperModule.run({ domains: ["www.example.com", "api.example.com", "shop.example.co.uk"] }, context) as { groups: { domain: string; subdomains: string[] }[] };
    expect(groups.groups).toEqual(expect.arrayContaining([expect.objectContaining({ domain: "example.com", subdomains: ["www.example.com", "api.example.com"] }), expect.objectContaining({ domain: "example.co.uk" })]));
    const emails = emailDomainExtractorModule.run({ text: "A@example.com, a@example.com, bad@" }, context) as { emails: string[]; domains: string[]; unmatched: string[] };
    expect(emails).toMatchObject({ emails: ["a@example.com"], domains: ["example.com"], unmatched: ["bad@"] });
  });

  it("matches exact marketing math fixtures and surfaces zero denominators", () => {
    expect(calculateRoas("200.00", "1000.00")).toMatchObject({ roas: "5.00", roasPercent: "500.00" });
    expect(cpaCpcCpmCalculatorModule.run({ metric: "cpa", spend: "200.00", conversions: "8" }, context)).toMatchObject({ value: "25.00", metric: "cpa" });
    expect(cpaCpcCpmCalculatorModule.run({ metric: "cpc", spend: "200.00", clicks: "100" }, context)).toMatchObject({ value: "2.00" });
    expect(cpaCpcCpmCalculatorModule.run({ metric: "cpm", spend: "200.00", impressions: "100000" }, context)).toMatchObject({ value: "2.00" });
    expect(calculateConversionRate("25", "1000")).toMatchObject({ ratePercent: "2.50" });
    expect(conversionRateScenarioModule.run({ visits: "1000", conversions: "25", targetRatePercent: "3" }, context)).toMatchObject({ projectedConversions: "30.00", absoluteLift: "5.00", liftPercent: "20.00" });
    expect(() => roasCalculatorModule.run({ spend: "0", revenue: "100" }, context)).toThrow("INVALID_SPEND_DENOMINATOR");
    expect(() => cpaCpcCpmCalculatorModule.run({ metric: "cpa", spend: "200", conversions: "0" }, context)).toThrow("INVALID_DENOMINATOR");
    expect(() => conversionRateScenarioModule.run({ visits: "0", conversions: "0", targetRatePercent: "3" }, context)).toThrow("INVALID_VISITS");
  });

  it("keeps every candidate 61–80 route, manifest, and implementation discoverable", () => {
    const toolDirectories = readdirSync(new URL("../src/tools/", import.meta.url), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    for (const id of targetTools) {
      expect(toolDirectories).toContain(id);
      expect(existsSync(new URL(`../src/tools/${id}/manifest.ts`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../src/tools/${id}/module.ts`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../src/pages/tools/${id}.astro`, import.meta.url))).toBe(true);
    }
    expect(targetTools).toHaveLength(20);
  });
});
