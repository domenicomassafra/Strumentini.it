import { describe, expect, it } from "vitest";
import { narrowUncataloguedToolPreviews } from "../src/release/preview-boundary";

const cfSource = '<BaseLayout title="CF" noindex><main data-cf-canonical-route="/tools/codice-fiscale/"></main></BaseLayout>';
const cfHtml = '<meta name="robots" content="noindex, nofollow"/><main data-cf-canonical-route="/tools/codice-fiscale/">Copertura geografica limitata</main>';
const signatureSource = 'export function getStaticPaths() { return import.meta.env.DEV ? [{ params: { route: undefined } }] : []; }\n<BaseLayout noindex><p>Development-only</p></BaseLayout>';
const allPages = ["src/pages/tools/pdf-visual-signature/[...route].astro", "src/pages/tools/codice-fiscale.astro", "src/pages/tools/public-tool.astro"];
const allStatic = ["tools/codice-fiscale/index.html", "tools/public-tool/index.html"];
const options = { toolPageFiles: allPages, staticFiles: allStatic,
  codiceFiscaleSource: cfSource, codiceFiscaleHtml: cfHtml,
  signatureSource, sitemapXml: '<urlset><loc>https://strumentini.it/tools/public-tool/</loc></urlset>',
  catalogRoutes: ["/tools/public-tool"] };

describe("noncatalog preview release boundary", () => {
  it("excludes only the exact verified noindex preview and compiled-absent development-only route", () => {
    const result = narrowUncataloguedToolPreviews(options);
    expect(result).toEqual({
      toolPageFiles: ["src/pages/tools/public-tool.astro"],
      staticFiles: ["tools/public-tool/index.html"],
      safePreviewNames: ["codice-fiscale", "pdf-visual-signature"],
    });
  });

  it("fails closed with no unlisted preview if noindex, canonical, source guard, or sitemap exclusion breaks", () => {
    for (const override of [
      { codiceFiscaleHtml: cfHtml.replace("noindex, nofollow", "index, follow") },
      { codiceFiscaleSource: cfSource.replace("noindex", "") },
      { codiceFiscaleHtml: cfHtml.replace("Copertura geografica", "Copertura") },
      { codiceFiscaleHtml: cfHtml.replace("/tools/codice-fiscale/", "/tools/other/") },
      { sitemapXml: `${options.sitemapXml}<loc>https://strumentini.it/tools/codice-fiscale/</loc>` },
      { catalogRoutes: ["/tools/codice-fiscale", "/tools/public-tool"] },
    ]) {
      const result = narrowUncataloguedToolPreviews({ ...options, ...override });
      expect(result.toolPageFiles).toContain("src/pages/tools/codice-fiscale.astro");
      expect(result.staticFiles).toContain("tools/codice-fiscale/index.html");
    }
    expect(narrowUncataloguedToolPreviews({ ...options, signatureSource: signatureSource.replace('import.meta.env.DEV', 'true') }).toolPageFiles)
      .toContain("src/pages/tools/pdf-visual-signature/[...route].astro");
    expect(narrowUncataloguedToolPreviews({ ...options, staticFiles: [...allStatic, "tools/pdf-visual-signature/index.html"] }).toolPageFiles)
      .toContain("src/pages/tools/pdf-visual-signature/[...route].astro");
  });

  it("never excludes unrelated unaudited source routes or unknown extra static pages", () => {
    const result = narrowUncataloguedToolPreviews({ ...options,
      toolPageFiles: [...allPages, "src/pages/tools/mystery.astro"],
      staticFiles: [...allStatic, "tools/mystery/index.html"],
    });
    expect(result.toolPageFiles).toContain("src/pages/tools/mystery.astro");
    expect(result.staticFiles).toContain("tools/mystery/index.html");
  });
});
