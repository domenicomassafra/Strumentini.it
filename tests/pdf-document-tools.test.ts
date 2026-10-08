import { access, readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  checkPdfPassword,
  buildPdfFromJpegs,
  createSimplePdf,
  extractPdfImages,
  extractPdfText,
  imagesToPdf,
  inspectPdfBytes,
  mergePdfs,
} from "../src/engines/pdf";
import type { ToolModule } from "../src/runtime/types";
import type { PdfInspection } from "../src/engines/pdf";
import metadataInspector from "../src/tools/pdf-metadata-inspector/module";
import textExtraction from "../src/tools/pdf-text-extraction/module";
import pageReorder from "../src/tools/pdf-page-reorder/module";
import pageRotate from "../src/tools/pdf-rotate/module";
import pageSplit from "../src/tools/pdf-split/module";
import pageDeleteExtract from "../src/tools/pdf-page-delete-extract/module";
import metadataRemover from "../src/tools/pdf-metadata-remover/module";
import flatten from "../src/tools/pdf-flatten/module";
import compression from "../src/tools/pdf-compression-lite/module";
import compare from "../src/tools/pdf-compare-lite/module";
import documentManifest from "../src/tools/document-handoff-manifest/module";
import linkExtractor from "../src/tools/pdf-link-extractor/module";
import formInspector from "../src/tools/pdf-form-inspector/module";
import imageExtractor from "../src/tools/pdf-image-extractor/module";
import pageCount from "../src/tools/pdf-page-count-verifier/module";
import pageSize from "../src/tools/pdf-page-size-inspector/module";
import password from "../src/tools/pdf-password-check-remove/module";
import imageToPdf from "../src/tools/images-to-pdf/module";

const PDF_TOOL_IDS = [
  "pdf-merge",
  "pdf-split",
  "pdf-page-reorder",
  "pdf-rotate",
  "pdf-page-delete-extract",
  "images-to-pdf",
  "pdf-to-images",
  "pdf-text-extraction",
  "pdf-metadata-inspector",
  "pdf-metadata-remover",
  "pdf-page-size-inspector",
  "pdf-page-count-verifier",
  "pdf-password-check-remove",
  "pdf-flatten",
  "pdf-form-inspector",
  "pdf-link-extractor",
  "pdf-image-extractor",
  "pdf-compare-lite",
  "pdf-compression-lite",
  "document-handoff-manifest",
] as const;

const JPEG = Uint8Array.from(Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==",
  "base64",
));

function annotatedPdf(): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.7\n1 0 obj\n<</Type /Catalog /Pages 2 0 R /AcroForm <</Fields [7 0 R]>>/Info 8 0 R>>\nendobj\n2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Annots [5 0 R] /Contents 4 0 R>>\nendobj\n4 0 obj\n<</Length 35>>\nstream\nBT /F1 12 Tf 20 300 Td (link page) Tj ET\nendstream\nendobj\n5 0 obj\n<</Type /Annot /Subtype /Link /A <</URI (https://example.test/a)>> >>\nendobj\n6 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n7 0 obj\n<</FT /Tx /T (full_name) /V (Ada) /Ff 0>>\nendobj\n8 0 obj\n<</Title (Annotated fixture) /Author (Strumentini.it)>>\nendobj\ntrailer\n<</Size 9 /Root 1 0 R /Info 8 0 R>>\nstartxref\n0\n%%EOF\n`);
}

function asBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer]);
}

async function invoke<T>(module: ToolModule, input: unknown): Promise<T> {
  return await module.run(input, { defaults: {} }) as T;
}

describe("PDF and document tool tranche", () => {
  it("has twenty real source routes, modules, manifests, and components", async () => {
    const toolsRoot = new URL("../src/tools/", import.meta.url);
    const entries = await readdir(toolsRoot, { withFileTypes: true });
    const ids = entries.filter((entry) => entry.isDirectory() && PDF_TOOL_IDS.includes(entry.name as typeof PDF_TOOL_IDS[number])).map((entry) => entry.name).sort();
    expect(ids).toEqual([...PDF_TOOL_IDS].sort());
    for (const id of PDF_TOOL_IDS) {
      const manifest = await import(`../src/tools/${id}/manifest.ts`);
      expect(manifest.default.id).toBe(id);
      expect(manifest.default.route).toBe(`/tools/${id}`);
      expect(manifest.default.capabilities).toEqual(expect.arrayContaining(["file-read"]));
      await access(new URL(`../src/tools/${id}/module.ts`, import.meta.url));
      await access(new URL(`../src/pages/tools/${id}.astro`, import.meta.url));
      const componentName = id.split("-").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("");
      await access(new URL(`../src/components/tools/${componentName}Tool.tsx`, import.meta.url));
      const source = await readFile(new URL(`../src/tools/${id}/module.ts`, import.meta.url), "utf8");
      expect(source).not.toMatch(/TOOL_IMPLEMENTATION_REQUIRED|implementation is pending/u);
    }
  });

  it("inspects metadata, page geometry, text, links, and forms without mutation", async () => {
    const bytes = annotatedPdf();
    const before = await invoke<{ inspection: PdfInspection; pageCount: number; encrypted: boolean }>(metadataInspector, { file: asBlob(bytes) });
    expect(before).toMatchObject({ pageCount: 1, encrypted: false });
    expect(before.inspection.metadata.title).toBe("Annotated fixture");
    expect(before.inspection.pages[0]).toMatchObject({ width: 300, height: 400, annotationCount: 1 });
    expect((await invoke<{ text: string }>(textExtraction, { file: asBlob(bytes) })).text).toContain("link page");
    expect((await invoke<{ links: readonly { uri: string }[] }>(linkExtractor, { file: asBlob(bytes) })).links[0]?.uri).toBe("https://example.test/a");
    expect((await invoke<{ forms: readonly { name: string; fieldType: string; value: string | null }[] }>(formInspector, { file: asBlob(bytes) })).forms[0]).toMatchObject({ name: "full_name", fieldType: "Tx", value: "Ada" });
    expect((await invoke<{ pageCount: number }>(pageCount, { file: asBlob(bytes) })).pageCount).toBe(1);
    expect((await invoke<{ pages: readonly { width: number; height: number }[] }>(pageSize, { file: asBlob(bytes) })).pages[0]).toMatchObject({ width: 300, height: 400 });
    expect(inspectPdfBytes(bytes).byteLength).toBe(bytes.byteLength);
  });

  it("executes bounded page mutations and merge/split operations", async () => {
    const source = createSimplePdf(["one", "two", "three"], { metadata: { title: "source" } });
    const file = asBlob(source);
    const reordered = await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(pageReorder, { file, order: [3, 1, 2] });
    expect((await extractPdfText(reordered.artifacts[0]!.bytes)).map((page) => page.text)).toEqual(["three", "one", "two"]);
    const safeReorder = await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(pageReorder, { file: asBlob(annotatedPdf()), order: [1] });
    expect(inspectPdfBytes(safeReorder.artifacts[0]!.bytes).links).toHaveLength(0);
    expect(inspectPdfBytes(safeReorder.artifacts[0]!.bytes).forms).toHaveLength(0);
    const rotated = await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(pageRotate, { file, rotations: { 1: 90 } });
    expect(inspectPdfBytes(rotated.artifacts[0]!.bytes).pages[0]?.rotation).toBe(90);
    const split = await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(pageSplit, { file, groups: [[1], [2, 3]] });
    expect(split.artifacts).toHaveLength(3); // two verified PDF parts plus reopened ZIP bundle
    const deleted = await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(pageDeleteExtract, { file, pages: [2], mode: "delete" });
    expect(inspectPdfBytes(deleted.artifacts[0]!.bytes).pageCount).toBe(2);
    const merged = await mergePdfs([source, source]);
    expect(inspectPdfBytes(merged.bytes).pageCount).toBe(6);
  });

  it("redacts PDF link credentials and rejects oversized image dimensions", () => {
    const credentialBytes = new TextEncoder().encode(new TextDecoder().decode(annotatedPdf()).replace("https://example.test/a", "https://user:pass@example.test/a"));
    const inspection = inspectPdfBytes(credentialBytes);
    expect(inspection.links[0]?.uri).toBe("https://example.test/a");
    expect(JSON.stringify(inspection)).not.toContain("pass");
    expect(() => buildPdfFromJpegs([{ bytes: new Uint8Array([0xff, 0xd8]), width: 20_001, height: 1, name: "huge.jpg" }])).toThrow(/PDF_LIMIT/u);
  });

  it("supports JPEG embedding/extraction and rejects non-JPEG input explicitly", async () => {
    const artifact = await imagesToPdf([JPEG]);
    const moduleArtifact = await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(imageToPdf, { files: [asBlob(JPEG)] });
    expect(inspectPdfBytes(artifact.bytes).images[0]).toMatchObject({ mime: "image/jpeg", width: 1, height: 1 });
    expect(inspectPdfBytes(moduleArtifact.artifacts[0]!.bytes).pageCount).toBe(1);
    expect((await extractPdfImages(artifact.bytes))[0]?.bytes).toEqual(JPEG);
    expect((await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(imageExtractor, { file: asBlob(artifact.bytes) })).artifacts).toHaveLength(1);
    await expect(imagesToPdf([asBlob(new Uint8Array([1, 2, 3]))])).rejects.toThrow(/JPEG images only/u);
  });

  it("creates local metadata, flatten, compression, compare, and handoff outputs", async () => {
    const source = createSimplePdf(["alpha", "beta"], { metadata: { title: "private", author: "owner" } });
    const file = asBlob(source);
    const stripped = await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(metadataRemover, { file });
    expect(inspectPdfBytes(stripped.artifacts[0]!.bytes).metadata.title).toBeNull();
    const flattened = await invoke<{ artifacts: readonly { bytes: Uint8Array }[] }>(flatten, { file: asBlob(annotatedPdf()) });
    const flatInspection = inspectPdfBytes(flattened.artifacts[0]!.bytes);
    expect(flatInspection.links).toHaveLength(0);
    const compressed = await invoke<{ artifactCount: number }>(compression, { file });
    expect(compressed.artifactCount).toBe(1);
    const comparison = await invoke<{ summary: string }>(compare, { first: file, second: asBlob(createSimplePdf(["alpha", "changed"])) });
    expect(comparison.summary).toMatch(/differences found/u);
    const manifest = await invoke<{ manifest: { files: readonly { sha256: string }[] } }>(documentManifest, { files: [file] });
    expect(manifest.manifest.files[0]?.sha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("reports encryption without attempting a bypass", async () => {
    const source = new TextDecoder().decode(createSimplePdf(["private"]));
    const encrypted = new TextEncoder().encode(source.replace("/Root 1 0 R>>", "/Root 1 0 R /Encrypt 99 0 R>>"));
    const result = await invoke<{ mode: string; encrypted: boolean }>(password, { file: asBlob(encrypted), mode: "check" });
    expect(result).toMatchObject({ mode: "check", encrypted: true });
    await expect(invoke(password, { file: asBlob(encrypted), mode: "remove" })).rejects.toThrow(/not brute-forced|not.*bypass/u);
    expect((await checkPdfPassword(createSimplePdf(["public"]))).encrypted).toBe(false);
  });
});
