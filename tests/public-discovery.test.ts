import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import {
  buildLibraryStructuredData,
  buildRobotsTxt,
  buildSitemapXml,
  buildToolStructuredData,
  formatPageTitle,
  resolveDiscoveryUrl,
  selectPageDescription,
  serializeJsonLd,
} from "../src/seo/public-discovery";

const genericCopy = "runs locally in your browser with bounded inputs and explicit results.";

describe("public discovery surfaces", () => {
  it("keeps all 200 tool summaries unique and snippet-sized", () => {
    const summaries = catalog.map((tool) => tool.summary.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en"));
    expect(catalog).toHaveLength(200);
    expect(new Set(summaries).size).toBe(catalog.length);
    expect(catalog.every((tool) => tool.summary.length <= 160)).toBe(true);
    expect(catalog.every((tool) => new Set(tool.summary.toLocaleLowerCase("en").split(/[^a-z0-9]+/u).filter(Boolean)).size >= 3)).toBe(true);
  });

  it("does not publish templated or keyword-stuffed boilerplate", async () => {
    const files = (await readdir("src/pages/tools")).filter((file) => file.endsWith(".astro"));
    const pages = await Promise.all(files.map(async (file) => readFile(`src/pages/tools/${file}`, "utf8")));
    const spamPhrases = [genericCopy, "locally with bounded file selection", "privacy-safe output", "side-by-side preview metadata", "Local, explicit, verifiable"];
    expect(pages.some((page) => spamPhrases.some((phrase) => page.includes(phrase)))).toBe(false);
  });

  it("builds one canonical sitemap entry for every public route", () => {
    const xml = buildSitemapXml(catalog, "https://example.test");
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
    expect(locations).toHaveLength(catalog.length + 3);
    expect(new Set(locations).size).toBe(catalog.length + 3);
    expect(locations).toContain("https://example.test/");
    expect(locations).toContain("https://example.test/library/");
    for (const tool of catalog) expect(locations).toContain(`https://example.test${tool.route}/`);
  });

  it("advertises the sitemap without blocking public tool pages", () => {
    const robots = buildRobotsTxt("https://example.test");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://example.test/sitemap.xml");
  });

  it("does not invent a public host when site configuration is absent", () => {
    expect(resolveDiscoveryUrl("/tools/example")).toBe("/tools/example/");
    expect(buildRobotsTxt()).toContain("Sitemap: /sitemap.xml");
  });

  it("uses catalog facts for tool and library structured data", () => {
    const tool = catalog[0];
    expect(tool).toBeDefined();
    if (tool === undefined) return;
    const toolData = buildToolStructuredData(tool, `https://example.test${tool.route}`);
    expect(toolData).toMatchObject({
      "@type": "SoftwareApplication",
      name: tool.name,
      description: tool.summary,
      applicationCategory: tool.category,
      url: `https://example.test${tool.route}`,
    });
    const libraryData = buildLibraryStructuredData(catalog, "https://example.test/library", "https://example.test");
    expect(libraryData).toMatchObject({ "@type": "CollectionPage", mainEntity: { numberOfItems: 200 } });
  });

  it("escapes structured data before it reaches an HTML script", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("<");
  });

  it("brands titles once and falls back from generic copy to the canonical summary", () => {
    const tool = catalog[0];
    expect(tool).toBeDefined();
    if (tool === undefined) return;
    expect(formatPageTitle(tool.name)).toBe(`${tool.name} · UtilityOS`);
    expect(formatPageTitle("Library · UtilityOS")).toBe("Library · UtilityOS");
    expect(selectPageDescription(`${tool.name} ${genericCopy}`, tool)).toBe(tool.summary);
  });
});
