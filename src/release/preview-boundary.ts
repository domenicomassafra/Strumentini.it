/**
 * A very narrow exception for two independently-audited noncatalog tool pages.
 * It does NOT promote either page, waive release evidence, or forgive another
 * source/static page. If a guard disappears the existing release validator
 * sees the original paths and correctly fails with unindexed/extra page errors.
 */
export function narrowUncataloguedToolPreviews(input: {
  readonly toolPageFiles: readonly string[];
  readonly staticFiles: readonly string[];
  readonly catalogRoutes: readonly string[];
  readonly codiceFiscaleSource: string;
  readonly codiceFiscaleHtml: string;
  readonly ocrSource?: string;
  readonly ocrHtml?: string;
  readonly signatureSource: string;
  readonly sitemapXml: string;
}): { readonly toolPageFiles: string[]; readonly staticFiles: string[]; readonly safePreviewNames: string[] } {
  const toolPageFiles = [...input.toolPageFiles];
  const staticFiles = [...input.staticFiles];
  const safePreviewNames: string[] = [];
  const cfSourcePath = "src/pages/tools/codice-fiscale.astro";
  const cfStaticPath = "tools/codice-fiscale/index.html";
  const sigSourcePath = "src/pages/tools/pdf-visual-signature/[...route].astro";
  const sigStaticPath = "tools/pdf-visual-signature/index.html";
  const inCatalog = (route: string) => input.catalogRoutes.some((candidate) => candidate.replace(/\/+$/u, "") === route);
  const cfGuard = toolPageFiles.includes(cfSourcePath) && staticFiles.includes(cfStaticPath) &&
    !inCatalog("/tools/codice-fiscale") &&
    /<BaseLayout\b[\s\S]*?\bnoindex\s*>/u.test(input.codiceFiscaleSource) &&
    input.codiceFiscaleSource.includes('data-cf-canonical-route="/tools/codice-fiscale/"') &&
    /<meta\s+name="robots"\s+content="noindex, nofollow"\s*\/?\s*>/u.test(input.codiceFiscaleHtml) &&
    input.codiceFiscaleHtml.includes('data-cf-canonical-route="/tools/codice-fiscale/"') &&
    /[Cc]opertura geografica/u.test(input.codiceFiscaleHtml) &&
    !input.sitemapXml.includes("/tools/codice-fiscale/");
  if (cfGuard) {
    toolPageFiles.splice(toolPageFiles.indexOf(cfSourcePath), 1);
    staticFiles.splice(staticFiles.indexOf(cfStaticPath), 1);
    safePreviewNames.push("codice-fiscale");
  }
  const ocrSourcePath = "src/pages/tools/ocr-italiano-locale-246.astro";
  const ocrStaticPath = "tools/ocr-italiano-locale-246/index.html";
  const ocrSource = input.ocrSource ?? "";
  const ocrHtml = input.ocrHtml ?? "";
  const ocrGuard = toolPageFiles.includes(ocrSourcePath) && staticFiles.includes(ocrStaticPath) &&
    !inCatalog("/tools/ocr-italiano-locale-246") &&
    /<BaseLayout\b[\s\S]*?\bnoindex\s*>/u.test(ocrSource) &&
    ocrSource.includes('data-ocr246-preview="experimental-local-only"') &&
    /<meta\s+name="robots"\s+content="noindex, nofollow"\s*\/?\s*>/u.test(ocrHtml) &&
    ocrHtml.includes('data-ocr246-preview="experimental-local-only"') &&
    ocrHtml.toLowerCase().includes("sperimentale") &&
    !input.sitemapXml.includes("/tools/ocr-italiano-locale-246/");
  if (ocrGuard) {
    toolPageFiles.splice(toolPageFiles.indexOf(ocrSourcePath), 1);
    staticFiles.splice(staticFiles.indexOf(ocrStaticPath), 1);
    safePreviewNames.push("ocr-italiano-locale-246");
  }
  const sigGuard = toolPageFiles.includes(sigSourcePath) && !staticFiles.includes(sigStaticPath) &&
    !inCatalog("/tools/pdf-visual-signature") &&
    /export\s+function\s+getStaticPaths\s*\(\s*\)\s*\{\s*return\s+import\.meta\.env\.DEV\s*\?\s*\[\{[\s\S]*?\]\s*:\s*\[\]\s*;?\s*\}/u.test(input.signatureSource) &&
    /<BaseLayout\b[\s\S]*?\bnoindex\s*>/u.test(input.signatureSource) &&
    !input.sitemapXml.includes("/tools/pdf-visual-signature/");
  if (sigGuard) {
    toolPageFiles.splice(toolPageFiles.indexOf(sigSourcePath), 1);
    safePreviewNames.push("pdf-visual-signature");
  }
  return { toolPageFiles, staticFiles, safePreviewNames };
}
