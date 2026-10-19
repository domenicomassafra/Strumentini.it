import { describe, expect, it } from "vitest";
import { fiscalToolPreviews, narrowUncataloguedToolPreviews } from "../src/release/preview-boundary";
import { validateToolSurface } from "../src/release/validation";

const fiscalPreviews = Object.fromEntries(fiscalToolPreviews.map(([name, marker]) => [name, {
  source: `<BaseLayout noindex><main ${marker}>Local estimate</main></BaseLayout>`,
  html: `<meta name="robots" content="noindex, nofollow"><main ${marker}>Local estimate</main>`,
}]));
const input = {
  toolPageFiles: ["src/pages/tools/public-tool.astro", ...fiscalToolPreviews.map(([name]) => `src/pages/tools/${name}.astro`)],
  staticFiles: ["tools/public-tool/index.html", ...fiscalToolPreviews.map(([name]) => `tools/${name}/index.html`)],
  catalogRoutes: ["/tools/public-tool"], fiscalPreviews,
  codiceFiscaleSource: "", codiceFiscaleHtml: "", signatureSource: "", sitemapXml: "<urlset/>",
};
const findings = (value: typeof input) => {
  const scoped = narrowUncataloguedToolPreviews(value);
  return validateToolSurface([{ id: "public-tool", route: "/tools/public-tool" }],
    ["src/tools/public-tool/manifest.ts"], scoped.toolPageFiles, 1).map((item) => item.code);
};

describe("five standalone fiscal previews (#266)", () => {
  it("scopes exactly the five build-proven noindex routes without changing catalog or evidence", () => {
    const scoped = narrowUncataloguedToolPreviews(input);
    expect(scoped.safePreviewNames).toEqual(fiscalToolPreviews.map(([name]) => name));
    expect(scoped.toolPageFiles).toEqual(["src/pages/tools/public-tool.astro"]);
    expect(scoped.staticFiles).toEqual(["tools/public-tool/index.html"]);
    expect(findings(input)).toEqual([]);
  });

  it.each(fiscalToolPreviews)("fails closed when %s loses any scope guard", (name, marker) => {
    const preview = fiscalPreviews[name]!;
    for (const override of [
      { fiscalPreviews: {} },
      { fiscalPreviews: { ...fiscalPreviews, [name]: { ...preview, source: preview.source.replace("noindex", "") } } },
      { fiscalPreviews: { ...fiscalPreviews, [name]: { ...preview, html: preview.html.replace("noindex, nofollow", "index, follow") } } },
      { fiscalPreviews: { ...fiscalPreviews, [name]: { ...preview, source: preview.source.replace(marker, "data-other") } } },
      { fiscalPreviews: { ...fiscalPreviews, [name]: { ...preview, html: preview.html.replace(marker, "data-other") } } },
      { staticFiles: input.staticFiles.filter((path) => path !== `tools/${name}/index.html`) },
      { catalogRoutes: [...input.catalogRoutes, `/tools/${name}/`] },
      { sitemapXml: `<urlset><loc>https://strumentini.it/tools/${name}/</loc></urlset>` },
    ]) {
      const selected = { ...input, ...override };
      const rejected = narrowUncataloguedToolPreviews(selected);
      expect(rejected.safePreviewNames).not.toContain(name);
      expect(rejected.toolPageFiles).toContain(`src/pages/tools/${name}.astro`);
      expect(findings(selected)).toContain("UNINDEXED_TOOL_PAGE");
    }
  });

  it("keeps an arbitrary noindex extra route visible to the structural validator", () => {
    const extra = { source: "<BaseLayout noindex><main data-fiscal-t1></main></BaseLayout>", html: fiscalPreviews["calcoli-fiscali-italia"]!.html };
    const selected = { ...input,
      toolPageFiles: [...input.toolPageFiles, "src/pages/tools/arbitrary.astro"],
      staticFiles: [...input.staticFiles, "tools/arbitrary/index.html"],
      fiscalPreviews: { ...fiscalPreviews, arbitrary: extra },
    };
    expect(narrowUncataloguedToolPreviews(selected).staticFiles).toContain("tools/arbitrary/index.html");
    expect(findings(selected)).toContain("UNINDEXED_TOOL_PAGE");
  });
});
