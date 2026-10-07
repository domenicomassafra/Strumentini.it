import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SITEMAP_LOC_MAX_CHARACTERS,
  SITEMAP_MAX_BYTES,
  SITEMAP_MAX_URLS,
  assertSitemapBounds,
  generateSitemapXml,
  isValidSitemapLastmod,
} from "../src/engines/url-marketing";

describe("sitemap XML generator", () => {
  it("matches the hand-worked sitemap protocol fixture vectors", async () => {
    const fixture = JSON.parse(await readFile(resolve("quality/fixtures/sitemap-xml/vectors.json"), "utf8")) as {
      vectors: Array<{
        input: string;
        expected_entries: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }>;
        expected_metadata_counts: { lastmod: number; changefreq: number; priority: number };
      }>;
      invalid_cases: Array<{ input: string; error: string }>;
    };
    for (const vector of fixture.vectors) {
      const result = generateSitemapXml(vector.input);
      expect(result.entries).toEqual(vector.expected_entries);
      expect(result.metadataCounts).toEqual(vector.expected_metadata_counts);
    }
    for (const vector of fixture.invalid_cases) {
      expect(() => generateSitemapXml(vector.input)).toThrow(vector.error);
    }
  });

  it("normalizes HTTP(S) URLs, escapes XML and emits metadata only when supplied", () => {
    const result = generateSitemapXml([
      "HTTPS://EXAMPLE.COM:443/a/../b?z=2&a=1&x=hello%20world",
      "https://example.com/news?x=1&y=2\t2026-10-06\tweekly\t0.8",
    ].join("\n"));

    expect(result.count).toBe(2);
    expect(result.host).toBe("example.com");
    expect(result.entries[0]).toEqual({ loc: "https://example.com/b?a=1&x=hello%20world&z=2" });
    expect(result.entries[1]).toEqual({ loc: "https://example.com/news?x=1&y=2", lastmod: "2026-10-06", changefreq: "weekly", priority: "0.8" });
    expect(result.xml).toContain("<loc>https://example.com/b?a=1&amp;x=hello%20world&amp;z=2</loc>");
    expect(result.xml.match(/<lastmod>/gu)).toHaveLength(1);
    expect(result.xml.match(/<changefreq>/gu)).toHaveLength(1);
    expect(result.xml.match(/<priority>/gu)).toHaveLength(1);
    expect(result.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(result.xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(result.byteLength).toBe(new TextEncoder().encode(result.xml).byteLength);
  });

  it("fails closed on malformed, non-http(s), credentialed and cross-host URLs", () => {
    expect(() => generateSitemapXml("ftp://example.com/file")).toThrow("INVALID_SITEMAP_ROW_1_UNSAFE_URL_SCHEME");
    expect(() => generateSitemapXml("https://example.com/%ZZ")).toThrow("INVALID_SITEMAP_ROW_1_INVALID_URL");
    expect(() => generateSitemapXml("https://user:pass@example.com/private")).toThrow("INVALID_SITEMAP_ROW_1_CREDENTIALS");
    expect(() => generateSitemapXml("https://example.com/a\nhttps://www.example.com/b")).toThrow("INVALID_SITEMAP_ROW_2_HOST_MISMATCH");
  });

  it("validates lastmod, changefreq and priority without inventing defaults", () => {
    expect(isValidSitemapLastmod("2024-02-29")).toBe(true);
    expect(isValidSitemapLastmod("2025-02-29")).toBe(false);
    expect(isValidSitemapLastmod("2026-10-06T20:30:00+02:00")).toBe(true);
    expect(() => generateSitemapXml("https://example.com/a\t2025-02-29")).toThrow("INVALID_SITEMAP_ROW_1_LASTMOD");
    expect(() => generateSitemapXml("https://example.com/a\t\tWeekly")).toThrow("INVALID_SITEMAP_ROW_1_CHANGEFREQ");
    expect(() => generateSitemapXml("https://example.com/a\t\tweekly\t1.1")).toThrow("INVALID_SITEMAP_ROW_1_PRIORITY");
    const noMetadata = generateSitemapXml("https://example.com/a").xml;
    expect(noMetadata).not.toContain("<lastmod>");
    expect(noMetadata).not.toContain("<changefreq>");
    expect(noMetadata).not.toContain("<priority>");
  });

  it("enforces the documented per-location character bound after normalization", () => {
    const base = "https://example.com/";
    const atLimit = base + "a".repeat(SITEMAP_LOC_MAX_CHARACTERS - base.length);
    expect(generateSitemapXml(atLimit).entries[0]?.loc).toHaveLength(SITEMAP_LOC_MAX_CHARACTERS);
    expect(() => generateSitemapXml(atLimit + "a")).toThrow("INVALID_SITEMAP_ROW_1_LOC_LENGTH");
  });

  it("accepts exactly 50,000 URLs and rejects the next one", () => {
    const maximum = Array.from({ length: SITEMAP_MAX_URLS }, (_, index) => `https://example.com/${index}`).join("\n");
    expect(generateSitemapXml(maximum).count).toBe(SITEMAP_MAX_URLS);
    expect(() => generateSitemapXml(`${maximum}\nhttps://example.com/overflow`)).toThrow("INVALID_SITEMAP_URL_COUNT_LIMIT");
  });

  it("enforces the 50 MiB uncompressed output boundary exactly", () => {
    expect(() => assertSitemapBounds(SITEMAP_MAX_URLS, SITEMAP_MAX_BYTES)).not.toThrow();
    expect(() => assertSitemapBounds(SITEMAP_MAX_URLS + 1, SITEMAP_MAX_BYTES)).toThrow("INVALID_SITEMAP_URL_COUNT_LIMIT");
    expect(() => assertSitemapBounds(1, SITEMAP_MAX_BYTES + 1)).toThrow("INVALID_SITEMAP_SIZE_LIMIT");
  });
});
