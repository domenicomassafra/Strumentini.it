import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import {
  buildDirectoryStructuredData,
  buildRobotsTxt,
  buildToolStructuredData,
  formatPageTitle,
  publicIndexPaths,
  resolveDiscoveryUrl,
  selectPageDescription,
  serializeJsonLd,
} from "../src/seo/public-discovery";
import { isPublicSitemapUrl } from "../src/seo/sitemap-routes";
import { groups } from "../src/catalog/groups";

const genericCopy = "runs locally in your browser with bounded inputs and explicit results.";

describe("public discovery surfaces", () => {
  it("keeps all catalog tool summaries unique and snippet-sized", () => {
    const summaries = catalog.map((tool) => tool.summary.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en"));
    expect(catalog.length).toBeGreaterThan(0);
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

  it("allows precisely the canonical public paths in the sitemap integration", () => {
    const site = "https://example.test";
    const routes = [...publicIndexPaths, ...groups.map((group) => `/categorie/${group.slug}`), ...catalog.map((tool) => tool.route)];
    const locations = routes.map((route) => resolveDiscoveryUrl(route, site));
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations.every((url) => isPublicSitemapUrl(url, site))).toBe(true);
    for (const unexpected of [
      "/library/", "/cerca/", "/accedi/", "/api/health/", "/strumenti/preview/",
      "/laboratorio/trascrizione-audio/", "/tools/codice-fiscale/", "/tools/irpef-annuale/",
      "/tools/pdf-scansionato-ocr-247/", "/prototipi/351/", "/404/", "/unknown/",
    ]) {
      expect(isPublicSitemapUrl(new URL(unexpected, site).href, site), unexpected).toBe(false);
    }
    expect(isPublicSitemapUrl("http://example.test/", site)).toBe(false);
    expect(isPublicSitemapUrl("https://preview.test/", site)).toBe(false);
    expect(isPublicSitemapUrl(`${site}/?preview=1`, site)).toBe(false);
    expect(isPublicSitemapUrl(`${site}/strumenti`, site)).toBe(false);
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

  it("uses catalog facts for tool and directory structured data", () => {
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
    const directoryData = buildDirectoryStructuredData(catalog, "https://example.test/strumenti");
    expect(directoryData).toMatchObject({ "@type": "CollectionPage", mainEntity: { numberOfItems: catalog.length } });
    expect(JSON.stringify(directoryData)).not.toContain("itemListElement");
  });

  it("escapes structured data before it reaches an HTML script", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("<");
  });

  it("brands titles once and falls back from generic copy to the canonical summary", () => {
    const tool = catalog[0];
    expect(tool).toBeDefined();
    if (tool === undefined) return;
    expect(formatPageTitle(tool.name)).toBe(`${tool.name} · Strumentini.it`);
    expect(formatPageTitle("Library · Strumentini.it")).toBe("Library · Strumentini.it");
    expect(selectPageDescription(`${tool.name} ${genericCopy}`, tool)).toBe(tool.summary);
  });
});
