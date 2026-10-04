import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parseUtmUrl } from "../src/engines/campaign-url";
import { calculateConversionRate, calculateRoas } from "../src/engines/marketing-math";
import {
  META_DESCRIPTION_DEFAULT_LIMIT,
  META_TITLE_DEFAULT_LIMIT,
  SOCIAL_PLATFORM_RULES,
  checkSocialLimit,
  compareUrls,
  listSocialPlatformRules,
  normalizeUrlDetails,
  parseOpenGraph,
  previewMeta,
  scanHtmlTags,
} from "../src/engines/url-marketing";
function fixture<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../quality/fixtures/${path}`, import.meta.url), "utf8")) as T;
}

interface SocialLimitsFixture {
  readonly platforms: readonly {
    readonly id: string;
    readonly limit: number;
    readonly source: string;
    readonly verifiedOn: string;
    readonly counting: string;
    readonly length: number;
  }[];
  readonly x_weighted: readonly { readonly name: string; readonly text: string; readonly codePoints: number; readonly weighted: number }[];
  readonly boundaries: readonly { readonly name: string; readonly platform: string; readonly text_repeat: string; readonly repeat: number; readonly within_limit: boolean }[];
}

interface MetaFixture {
  readonly vectors: readonly { readonly name: string; readonly title: string; readonly description: string; readonly titleCharacters: number; readonly descriptionCharacters: number }[];
  readonly escaping: readonly { readonly name: string; readonly title: string; readonly description: string; readonly escapedTitle: string; readonly escapedDescription: string }[];
}

interface OpenGraphFixture {
  readonly complete_html: string;
  readonly vectors: readonly {
    readonly name: string;
    readonly html: string;
    readonly expectedTitle: string | null;
    readonly expectedDescription: string | null;
    readonly expectedImage: string | null;
    readonly expectedUrl: string | null;
    readonly expectedType: string | null;
    readonly expectedWarnings: readonly string[];
  }[];
}

interface UrlComparisonFixture {
  readonly vectors: readonly {
    readonly name: string;
    readonly left: string;
    readonly right: string;
    readonly mode: "exact" | "semantic";
    readonly equal: boolean;
    readonly differences: readonly string[];
    readonly ignoredFragment: boolean;
  }[];
}

const SOCIAL_LIMITS_FIXTURE = fixture<SocialLimitsFixture>("social-platform-limits/vectors.json");
const SOCIAL_META_FIXTURE = fixture<MetaFixture>("search-snippet-meta/vectors.json");
const OPEN_GRAPH_FIXTURE = fixture<OpenGraphFixture>("open-graph-tags/vectors.json");
const URL_COMPARISON_FIXTURE = fixture<UrlComparisonFixture>("url-comparison/vectors.json");
import urlComparisonModule from "../src/tools/url-comparison/module";
import urlBulkNormalizerModule from "../src/tools/url-bulk-normalizer/module";
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

  it("redacts credentials from non-HTTP invalid URL tokens without echoing them", () => {
    const output = urlBulkNormalizerModule.run({ urls: ["ftp://user:pass@example.com/private"] }, context) as { results: Array<{ input: string; error?: string }> };
    expect(output.results[0]?.input).toBe("ftp://[redacted]@example.com/private");
    expect(JSON.stringify(output)).not.toContain("pass");
  });

  it("normalizes a bulk list with row-level errors and stable output", () => {
    const output = urlBulkNormalizerModule.run({ urls: ["HTTPS://EXAMPLE.com/?b=2&a=1", "not a url"] }, context) as { normalizedUrls: string[]; errorCount: number };
    expect(output.errorCount).toBe(1);
    expect(output.normalizedUrls).toEqual(["https://example.com/?a=1&b=2"]);
    expect((urlBulkNormalizerModule.run({ urls: ["https://user:pass@example.com/private"] }, context) as { results: { input: string }[] }).results[0]?.input).toBe("https://[redacted]@example.com/private");
    expect(normalizeUrlDetails(output.normalizedUrls[0]!, { sortQuery: true }).url).toBe(output.normalizedUrls[0]);
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
    expect(social.image).toBe("https://relative.invalid/image.png");
    expect(social.warnings).toEqual(expect.arrayContaining(["MISSING_DESCRIPTION", "MISSING_URL"]));
    expect(robotsDirectiveHelperModule.run({ text: "User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml" }, context)).toMatchObject({ groups: [{ userAgents: ["*"], rules: [{ directive: "disallow", path: "/private" }] }], sitemaps: ["https://example.com/sitemap.xml"] });
  });

  it("redacts credentials from Open Graph and robots URL metadata", () => {
    const social = openGraphPreviewModule.run({ html: '<meta property="og:image" content="https://user:pass@example.com/image.png">' }, context) as { image: string; tags: Record<string, string> };
    expect(social.image).toBe("https://example.com/image.png");
    expect(JSON.stringify(social)).not.toContain("pass");
    const robots = robotsDirectiveHelperModule.run({ text: "Sitemap: https://user:pass@example.com/sitemap.xml" }, context) as { sitemaps: string[] };
    expect(robots.sitemaps[0]).toBe("https://example.com/sitemap.xml");
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

describe("url-marketing fixtures: published platform limits", () => {
  it("matches every published limit in the fixture, with provenance attached", () => {
    expect(listSocialPlatformRules().map((rule) => rule.id)).toEqual(SOCIAL_PLATFORM_RULES.map((rule) => rule.id));
    for (const entry of SOCIAL_LIMITS_FIXTURE.platforms) {
      const result = checkSocialLimit(entry.id, "");
      expect(result.declaredLimit, entry.id).toBe(entry.limit);
      expect(result.limit, entry.id).toBe(entry.limit);
      expect(result.limitSource, entry.id).toBe(entry.source);
      expect(result.limitVerifiedOn, entry.id).toBe(entry.verifiedOn);
      expect(result.countingMethod, entry.id).toBe(entry.counting);
    }
  });

  it("applies the documented X weighted length, not a plain code-point count", () => {
    for (const vector of SOCIAL_LIMITS_FIXTURE.x_weighted) {
      const result = checkSocialLimit("x", vector.text);
      expect(result.characters, vector.text).toBe(vector.codePoints);
      expect(result.weightedCharacters, vector.text).toBe(vector.weighted);
      expect(result.withinLimit, vector.text).toBe(vector.weighted <= 280);
    }
    expect(checkSocialLimit("linkedin", "世界").weightedCharacters).toBeNull();
    expect(checkSocialLimit("linkedin", "世界").withinLimitWeighted).toBeNull();
  });

  it("fails closed on an unknown platform or an unusable limit", () => {
    expect(() => checkSocialLimit("myspace", "ciao")).toThrow("INVALID_SOCIAL_PLATFORM");
    expect(() => checkSocialLimit("x", "ciao", 0)).toThrow("INVALID_SOCIAL_LIMIT");
    expect(() => checkSocialLimit("x", "ciao", 1.5)).toThrow("INVALID_SOCIAL_LIMIT");
    expect(() => checkSocialLimit("x", "x".repeat(3 * 1024 * 1024))).toThrow("INPUT_TOO_LARGE");
  });

  it("marks a reader-supplied limit as an override rather than a published one", () => {
    const overridden = checkSocialLimit("x", "ciao", 500);
    expect(overridden).toMatchObject({ limit: 500, declaredLimit: 280, limitOverridden: true, limitSource: "X Help Center — Counting characters" });
    expect(checkSocialLimit("x", "ciao", 280)).toMatchObject({ limitOverridden: false });
  });

  it("resolves every platform spelling a reader is likely to type", () => {
    for (const alias of ["x", "X", " X ", "twitter", "X.com", "x/twitter", "X / Twitter"]) {
      expect(checkSocialLimit(alias, "ciao").platform, alias).toBe("x");
    }
    expect(checkSocialLimit("LinkedIn", "ciao").platform).toBe("linkedin");
  });
});

describe("url-marketing fixtures: meta title and description", () => {
  it("matches the fixture counts, limits, and truncations", () => {
    for (const vector of SOCIAL_META_FIXTURE.vectors) {
      const result = previewMeta(vector.title, vector.description);
      expect(result.titleCharacters, vector.title).toBe(vector.titleCharacters);
      expect(result.descriptionCharacters, vector.description).toBe(vector.descriptionCharacters);
      expect(result.titleWithinLimit, vector.title).toBe(vector.titleCharacters <= META_TITLE_DEFAULT_LIMIT);
      expect(result.descriptionWithinLimit, vector.description).toBe(vector.descriptionCharacters <= META_DESCRIPTION_DEFAULT_LIMIT);
      expect([...result.truncatedTitle].length, vector.title).toBe(Math.min(result.titleCharacters, result.titleLimit));
      expect([...result.truncatedDescription].length, vector.description).toBe(Math.min(result.descriptionCharacters, result.descriptionLimit));
      expect(result.titleOverBy, vector.title).toBe(Math.max(0, vector.titleCharacters - META_TITLE_DEFAULT_LIMIT));
    }
  });

  it("keeps the escaped output inert and never lets markup through", () => {
    for (const vector of SOCIAL_META_FIXTURE.vectors) {
      const result = previewMeta(vector.title, vector.description);
      expect(result.escapedTitle, vector.title).not.toMatch(/<[a-z/]/iu);
      expect(result.escapedDescription, vector.description).not.toMatch(/<[a-z/]/iu);
    }
    const scripted = previewMeta('<script>alert("x")</script>', "</p><img src=x>");
    expect(scripted.escapedTitle).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(scripted.escapedDescription).toBe("&lt;/p&gt;&lt;img src=x&gt;");
  });

  it("reports the provenance of the reference lengths and honours an override", () => {
    const base = previewMeta("a", "b");
    expect(base).toMatchObject({ titleLimit: 60, descriptionLimit: 160, titleLimitOverridden: false, descriptionLimitOverridden: false });
    expect(base.titleLimitSource).toContain("Google Search Central");
    expect(base.descriptionLimitSource).toContain("Google Search Central");
    expect(previewMeta("a", "b", { title: 30, description: 70 })).toMatchObject({ titleLimit: 30, descriptionLimit: 70, titleLimitOverridden: true, descriptionLimitOverridden: true });
    expect(() => previewMeta("a", "b", { title: 0 })).toThrow("INVALID_META_LIMIT");
    expect(() => previewMeta("a", "b", { description: 2.5 })).toThrow("INVALID_META_LIMIT");
    expect(() => metaPreviewModule.run({ title: "a".repeat(3 * 1024 * 1024), description: "b" }, context)).toThrow("INPUT_TOO_LARGE");
  });
});

describe("url-marketing fixtures: Open Graph extraction", () => {
  it("reads every documented case, including a > inside an attribute value", () => {
    for (const vector of OPEN_GRAPH_FIXTURE.vectors) {
      const result = parseOpenGraph(vector.html);
      expect(result.title, vector.name).toBe(vector.expectedTitle);
      expect(result.description, vector.name).toBe(vector.expectedDescription);
      expect(result.image, vector.name).toBe(vector.expectedImage);
      expect(result.url, vector.name).toBe(vector.expectedUrl);
      expect(result.type, vector.name).toBe(vector.expectedType);
      expect([...result.warnings], vector.name).toEqual(expect.arrayContaining([...vector.expectedWarnings]));
      expect(result.titleCharacters, vector.name).toBe([...(vector.expectedTitle ?? "")].length);
    }
  });

  it("never lets a > inside a quoted attribute truncate a tag", () => {
    const tags = scanHtmlTags('<meta property="og:title" content="a > b"><meta content="c > d" property="og:description" /><meta property=og:type content=article>');
    expect(tags.map((tag) => tag.name)).toEqual(["meta", "meta", "meta"]);
    expect(tags[0]?.attributes.content).toBe("a > b");
    expect(tags[1]?.attributes.property).toBe("og:description");
    expect(tags[1]?.attributes.content).toBe("c > d");
    expect(tags[2]?.attributes).toMatchObject({ property: "og:type", content: "article" });
  });

  it("resolves image variants in the documented order and names the key used", () => {
    expect(parseOpenGraph('<meta property="og:image" content="https://a.example/1.png"><meta property="og:image:secure_url" content="https://a.example/2.png">')).toMatchObject({ image: "https://a.example/1.png", imageSourceKey: "og:image" });
    expect(parseOpenGraph('<meta property="og:image:secure_url" content="https://a.example/2.png">')).toMatchObject({ image: "https://a.example/2.png", imageSourceKey: "og:image:secure_url" });
    expect(parseOpenGraph('<meta name="twitter:image" content="https://a.example/3.png">')).toMatchObject({ image: "https://a.example/3.png", imageSourceKey: "twitter:image" });
  });

  it("states the placeholder host whenever it makes a relative URL absolute", () => {
    const result = parseOpenGraph('<meta property="og:url" content="/articoli/uno">');
    expect(result.url).toBe("https://relative.invalid/articoli/uno");
    expect(result.relativeBase).toBe("https://relative.invalid/");
    expect(result.warnings).toContain("RELATIVE_URL_RESOLVED");
  });

  it("refuses a javascript: URL and redacts credentials out of every tag", () => {
    expect(parseOpenGraph('<meta property="og:image" content="javascript:alert(1)">').image).toBeNull();
    expect(parseOpenGraph('<meta property="og:image" content="javascript:alert(1)">').warnings).toContain("UNSAFE_OG_IMAGE");
    const credentialed = parseOpenGraph('<meta property="og:url" content="https://user:pass@example.com/a"><meta property="og:title" content="T">');
    expect(JSON.stringify(credentialed)).not.toContain("pass");
    expect(credentialed.tags["og:url"]).toBe("https://[redacted]@example.com/a");
  });

  it("accepts a tag record as well as markup and reports an empty input", () => {
    expect(parseOpenGraph({ "og:title": "T", "og:image": "https://a.example/i.png" })).toMatchObject({ title: "T", image: "https://a.example/i.png", tagCount: 2 });
    expect(parseOpenGraph({ tags: { "og:title": "Dai tag" } })).toMatchObject({ title: "Dai tag" });
    expect(() => parseOpenGraph("   ")).toThrow("INVALID_INPUT");
    expect(() => openGraphPreviewModule.run({ html: 42 }, context)).toThrow("INVALID_INPUT");
  });

  it("lists the core properties still missing", () => {
    expect(parseOpenGraph('<meta property="og:title" content="T">').missingCore).toEqual(["description", "image", "url", "type"]);
    expect(parseOpenGraph(OPEN_GRAPH_FIXTURE.complete_html).missingCore).toEqual([]);
  });
});

describe("url-marketing fixtures: URL comparison", () => {
  it("matches every declared comparison exactly", () => {
    for (const vector of URL_COMPARISON_FIXTURE.vectors) {
      const result = compareUrls(vector.left, vector.right, { mode: vector.mode });
      expect(result.equal, vector.name).toBe(vector.equal);
      expect(result.differences.map((difference) => difference.field), vector.name).toEqual(vector.differences);
      if (vector.ignoredFragment) expect(result.left, vector.name).not.toContain("#");
    }
  });

  it("normalises both sides before comparing, so the report shows what it compared", () => {
    const result = compareUrls("HTTPS://EXAMPLE.com:443/a?b=2&a=1#uno", "https://example.com/a?a=1&b=2#due");
    expect(result.left).toBe("https://example.com/a?a=1&b=2");
    expect(result.right).toBe("https://example.com/a?a=1&b=2");
    expect(result.mode).toBe("semantic");
  });

  it("reports a difference in the fragment only in exact mode", () => {
    expect(compareUrls("https://example.com/a#uno", "https://example.com/a#due").differences).toEqual([]);
    expect(compareUrls("https://example.com/a#uno", "https://example.com/a#due", { mode: "exact" }).differences).toEqual([{ field: "hash", left: "#uno", right: "#due" }]);
  });

  it("keeps a fragment comparison on request while ignoring parameter order", () => {
    expect(compareUrls("https://example.com/a?b=2&a=1#uno", "https://example.com/a?a=1&b=2#due", { mode: "semantic", ignoreFragment: true }).equal).toBe(true);
    expect(compareUrls("https://example.com/a#uno", "https://example.com/a#due", { mode: "exact", ignoreFragment: false }).equal).toBe(false);
  });

  it("rejects an unusable mode, a non-HTTP scheme, and bad percent escapes", () => {
    expect(() => compareUrls("https://example.com", "https://example.com", { mode: "loose" as never })).toThrow("INVALID_COMPARISON_MODE");
    expect(() => compareUrls("ftp://example.com", "https://example.com")).toThrow("UNSAFE_URL_SCHEME");
    expect(() => compareUrls("https://example.com/%zz", "https://example.com")).toThrow("INVALID_URL");
    expect(() => urlComparisonModule.run({ leftUrl: "https://example.com", rightUrl: "https://example.com", mode: "loose" }, context)).toThrow("INVALID_COMPARISON_MODE");
    expect(() => urlComparisonModule.run({ leftUrl: "https://example.com", rightUrl: 7 }, context)).toThrow("INVALID_INPUT");
  });

  it("flags credentials on both sides without ever echoing them", () => {
    const result = compareUrls("https://user:pass@example.com/a", "https://example.com/a");
    expect(result.credentialWarning).toBe(true);
    expect(JSON.stringify(result)).not.toContain("pass");
    expect(result.left).toBe("https://example.com/a");
  });
});