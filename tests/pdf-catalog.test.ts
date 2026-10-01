import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileFactoryCatalog } from "../src/tool-factory/catalog";
import { TOOL_COPY_IT } from "../src/i18n/it/tool-copy";
import { pdfMergeManifest } from "../src/tools/pdf-merge/manifest";
import { pdfSplitManifest } from "../src/tools/pdf-split/manifest";
import { pdfPageReorderManifest } from "../src/tools/pdf-page-reorder/manifest";
import { pdfRotateManifest } from "../src/tools/pdf-rotate/manifest";
import { pdfPageDeleteExtractManifest } from "../src/tools/pdf-page-delete-extract/manifest";
import { imagesToPdfManifest } from "../src/tools/images-to-pdf/manifest";
import { pdfToImagesManifest } from "../src/tools/pdf-to-images/manifest";
import { pdfTextExtractionManifest } from "../src/tools/pdf-text-extraction/manifest";
import { pdfMetadataInspectorManifest } from "../src/tools/pdf-metadata-inspector/manifest";
import { pdfMetadataRemoverManifest } from "../src/tools/pdf-metadata-remover/manifest";
import { pdfPageSizeInspectorManifest } from "../src/tools/pdf-page-size-inspector/manifest";
import { pdfPageCountVerifierManifest } from "../src/tools/pdf-page-count-verifier/manifest";
import { pdfPasswordCheckManifest } from "../src/tools/pdf-password-check-remove/manifest";
import { pdfFlattenManifest } from "../src/tools/pdf-flatten/manifest";
import { pdfFormInspectorManifest } from "../src/tools/pdf-form-inspector/manifest";
import { pdfLinkExtractorManifest } from "../src/tools/pdf-link-extractor/manifest";
import { pdfImageExtractorManifest } from "../src/tools/pdf-image-extractor/manifest";
import { pdfCompareManifest } from "../src/tools/pdf-compare-lite/manifest";
import { pdfCompressionManifest } from "../src/tools/pdf-compression-lite/manifest";
import { documentHandoffManifestManifest } from "../src/tools/document-handoff-manifest/manifest";

const pdfManifests = [
  pdfMergeManifest,
  pdfSplitManifest,
  pdfPageReorderManifest,
  pdfRotateManifest,
  pdfPageDeleteExtractManifest,
  imagesToPdfManifest,
  pdfToImagesManifest,
  pdfTextExtractionManifest,
  pdfMetadataInspectorManifest,
  pdfMetadataRemoverManifest,
  pdfPageSizeInspectorManifest,
  pdfPageCountVerifierManifest,
  pdfPasswordCheckManifest,
  pdfFlattenManifest,
  pdfFormInspectorManifest,
  pdfLinkExtractorManifest,
  pdfImageExtractorManifest,
  pdfCompareManifest,
  pdfCompressionManifest,
  documentHandoffManifestManifest,
] as const;

const componentById: Record<string, string> = {
  "pdf-merge": "PdfMergeTool.tsx",
  "pdf-split": "PdfSplitTool.tsx",
  "pdf-page-reorder": "PdfPageReorderTool.tsx",
  "pdf-rotate": "PdfRotateTool.tsx",
  "pdf-page-delete-extract": "PdfPageDeleteExtractTool.tsx",
  "images-to-pdf": "ImagesToPdfTool.tsx",
  "pdf-to-images": "PdfToImagesTool.tsx",
  "pdf-text-extraction": "PdfTextExtractionTool.tsx",
  "pdf-metadata-inspector": "PdfMetadataInspectorTool.tsx",
  "pdf-metadata-remover": "PdfMetadataRemoverTool.tsx",
  "pdf-page-size-inspector": "PdfPageSizeInspectorTool.tsx",
  "pdf-page-count-verifier": "PdfPageCountVerifierTool.tsx",
  "pdf-password-check-remove": "PdfPasswordCheckRemoveTool.tsx",
  "pdf-flatten": "PdfFlattenTool.tsx",
  "pdf-form-inspector": "PdfFormInspectorTool.tsx",
  "pdf-link-extractor": "PdfLinkExtractorTool.tsx",
  "pdf-image-extractor": "PdfImageExtractorTool.tsx",
  "pdf-compare-lite": "PdfCompareLiteTool.tsx",
  "pdf-compression-lite": "PdfCompressionLiteTool.tsx",
  "document-handoff-manifest": "DocumentHandoffManifestTool.tsx",
};

describe("20-tool PDF and document catalog family", () => {
  it("compiles all 20 candidates as independent LOCAL routes", () => {
    const compiled = compileFactoryCatalog(pdfManifests);
    expect(compiled.summaries).toHaveLength(20);
    expect(new Set(compiled.summaries.map(({ id }) => id)).size).toBe(20);
    expect(new Set(compiled.summaries.map(({ route }) => route)).size).toBe(20);
    for (const summary of compiled.summaries) {
      expect(summary.route).toBe(`/tools/${summary.id}`);
      expect(summary.engine).toBe("pdf");
      expect(summary.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
      expect(summary.aliases.length).toBeGreaterThan(0);
      expect(summary.jobs.length).toBeGreaterThan(0);
    }
  });

  it("gives every candidate a distinct lazy module implementation", () => {
    const compiled = compileFactoryCatalog(pdfManifests);
    expect(new Set(compiled.loaders.map(({ implementation }) => implementation)).size).toBe(20);
    expect(compiled.loaders.every(({ implementation }) => implementation.endsWith("/module.ts"))).toBe(true);
  });

  it("binds every candidate to the pdf-gold fixture and an Italian public name", () => {
    for (const manifest of pdfManifests) {
      expect(manifest.gold.fixtureFamilies).toContain("pdf-gold");
      expect(manifest.gold.oracleEntryId).toMatch(/^cand-\d{3}$/u);
      expect(existsSync(new URL(`../src/tools/${manifest.id}/module.ts`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../src/pages/tools/${manifest.id}.astro`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../src/components/tools/${componentById[manifest.id]}`, import.meta.url))).toBe(true);
      const copy = TOOL_COPY_IT[manifest.id];
      expect(copy?.name?.trim().length).toBeGreaterThan(0);
    }
  });
});
