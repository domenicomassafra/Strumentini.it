import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fiscalToolPreviews, narrowUncataloguedToolPreviews } from "../../src/release/preview-boundary";

/** Read the same source/build boundary for every release-validator invocation. */
export async function loadReleasePreviews(root: string, distRoot: string, toolPageFiles: string[], staticFiles: string[], catalogRoutes: string[]) {
  const source = (name: string) => readFile(resolve(root, `src/pages/tools/${name}.astro`), "utf8").catch(() => "");
  const html = (name: string) => readFile(resolve(distRoot, `tools/${name}/index.html`), "utf8").catch(() => "");
  const fiscalPreviews = Object.fromEntries(await Promise.all(fiscalToolPreviews.map(async ([name]) =>
    [name, { source: await source(name), html: await html(name) }] as const)));
  return narrowUncataloguedToolPreviews({
    toolPageFiles, staticFiles, catalogRoutes, fiscalPreviews,
    codiceFiscaleSource: await source("codice-fiscale"),
    codiceFiscaleHtml: await html("codice-fiscale"),
    ocrSource: await source("ocr-italiano-locale-246"),
    ocrHtml: await html("ocr-italiano-locale-246"),
    pdfOcr247Source: await source("pdf-scansionato-ocr-247"),
    pdfOcr247Html: await html("pdf-scansionato-ocr-247"),
    redaction237Source: await source("pdf-true-redaction-237/[...route]"),
    signatureSource: await source("pdf-visual-signature/[...route]"),
    sitemapXml: await readFile(resolve(distRoot, "sitemap.xml"), "utf8").catch(() => ""),
  });
}
