import { describe, expect, it } from "vitest";
import { narrowUncataloguedToolPreviews } from "../src/release/preview-boundary";

const cfSource = '<BaseLayout title="CF" noindex><main data-cf-canonical-route="/tools/codice-fiscale/"></main></BaseLayout>';
const cfHtml = '<meta name="robots" content="noindex, nofollow"/><main data-cf-canonical-route="/tools/codice-fiscale/">Copertura geografica limitata</main>';
const signatureSource = 'export function getStaticPaths() { return import.meta.env.DEV ? [{ params: { route: undefined } }] : []; }\n<BaseLayout noindex><p>Development-only</p></BaseLayout>';
const ocrSource = '<BaseLayout title="OCR" noindex><main data-ocr246-preview="experimental-local-only">OCR italiano sperimentale</main></BaseLayout>';
const ocrHtml = '<meta name="robots" content="noindex, nofollow"/><main data-ocr246-preview="experimental-local-only">OCR italiano sperimentale</main>';
const pdfOcr247Source = 'export function getStaticPaths() { return import.meta.env.DEV ? [{ params: { route: undefined } }] : []; }\n<BaseLayout title="PDF OCR" noindex><main data-ocr247-preview="experimental-local-only">PDF OCR sperimentale</main></BaseLayout>';
const redactionSource = 'export function getStaticPaths() { return import.meta.env.DEV ? [{ params: { route: undefined } }] : []; }\n<BaseLayout title="PDF redaction" noindex><main data-redaction237-preview="experimental-local-only">Redazione sperimentale</main></BaseLayout>';
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

  it("allows only the exact noindex local OCR preview, never a public catalogue/sitemap promotion", () => {
    const withOcr = { ...options,
      toolPageFiles: [...allPages, "src/pages/tools/ocr-italiano-locale-246.astro"],
      staticFiles: [...allStatic, "tools/ocr-italiano-locale-246/index.html"], ocrSource, ocrHtml,
    };
    const accepted = narrowUncataloguedToolPreviews(withOcr);
    expect(accepted.safePreviewNames).toContain("ocr-italiano-locale-246");
    expect(accepted.toolPageFiles).not.toContain("src/pages/tools/ocr-italiano-locale-246.astro");
    for (const override of [
      { ocrSource: ocrSource.replace("noindex", "") },
      { ocrSource: ocrSource.replace("experimental-local-only", "live") },
      { ocrHtml: ocrHtml.replace("noindex, nofollow", "index, follow") },
      { ocrHtml: ocrHtml.replace("experimental-local-only", "live") },
      { ocrHtml: ocrHtml.replace("sperimentale", "") },
      { sitemapXml: withOcr.sitemapXml + "<loc>https://strumentini.it/tools/ocr-italiano-locale-246/</loc>" },
      { catalogRoutes: [...withOcr.catalogRoutes, "/tools/ocr-italiano-locale-246"] },
    ]) {
      const denied = narrowUncataloguedToolPreviews({ ...withOcr, ...override });
      expect(denied.toolPageFiles).toContain("src/pages/tools/ocr-italiano-locale-246.astro");
      expect(denied.staticFiles).toContain("tools/ocr-italiano-locale-246/index.html");
    }
  });

  it("excludes dev-only #247 PDF OCR from public tool count solely when no build, catalog or discovery surface exists", () => {
    const sourcePath = "src/pages/tools/pdf-scansionato-ocr-247/[...route].astro";
    const staticPath = "tools/pdf-scansionato-ocr-247/index.html";
    const selected = { ...options, toolPageFiles: [...allPages, sourcePath], pdfOcr247Source };
    const accepted = narrowUncataloguedToolPreviews(selected);
    expect(accepted.safePreviewNames).toContain("pdf-scansionato-ocr-247");
    expect(accepted.toolPageFiles).not.toContain(sourcePath);
    for (const override of [
      { pdfOcr247Source: pdfOcr247Source.replace("import.meta.env.DEV", "true") },
      { pdfOcr247Source: pdfOcr247Source.replace("noindex", "") },
      { pdfOcr247Source: pdfOcr247Source.replace("experimental-local-only", "production") },
      { staticFiles: [...allStatic, staticPath] },
      { sitemapXml: selected.sitemapXml + "<loc>https://strumentini.it/tools/pdf-scansionato-ocr-247/</loc>" },
      { catalogRoutes: [...selected.catalogRoutes, "/tools/pdf-scansionato-ocr-247"] },
    ]) {
      const denied = narrowUncataloguedToolPreviews({ ...selected, ...override });
      expect(denied.toolPageFiles).toContain(sourcePath);
      expect(denied.safePreviewNames).not.toContain("pdf-scansionato-ocr-247");
    }
  });

  it("never promotes dev-only secure redaction #237 without tested public security boundary", () => {
    const source = "src/pages/tools/pdf-true-redaction-237/[...route].astro";
    const selected = { ...options, toolPageFiles: [...allPages, source], redaction237Source: redactionSource };
    const accepted = narrowUncataloguedToolPreviews(selected);
    expect(accepted.safePreviewNames).toContain("pdf-true-redaction-237");
    expect(accepted.toolPageFiles).not.toContain(source);
    for (const override of [
      { redaction237Source: redactionSource.replace("import.meta.env.DEV", "true") },
      { redaction237Source: redactionSource.replace("noindex", "") },
      { redaction237Source: redactionSource.replace("experimental-local-only", "public") },
      { staticFiles: [...allStatic, "tools/pdf-true-redaction-237/index.html"] },
      { catalogRoutes: [...selected.catalogRoutes, "/tools/pdf-true-redaction-237"] },
      { sitemapXml: selected.sitemapXml + "<loc>https://strumentini.it/tools/pdf-true-redaction-237/</loc>" },
    ]) {
      const rejected = narrowUncataloguedToolPreviews({ ...selected, ...override });
      expect(rejected.toolPageFiles).toContain(source);
      expect(rejected.safePreviewNames).not.toContain("pdf-true-redaction-237");
    }
  });
});
