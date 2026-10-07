import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  extractPdfImagesScoped,
  extractPdfTextScoped,
  inspectPdfBytes,
} from "../src/engines/pdf";
import metadataRemover from "../src/tools/pdf-metadata-remover/module";
import type { PdfMetadataRemoverOutput } from "../src/tools/pdf-metadata-remover/types";

const fixtureUrl = new URL("../quality/fixtures/pdf-gold/page-scoped-images-metadata.pdf", import.meta.url);
const jpegUrl = new URL("../quality/fixtures/pdf-gold/tiny.jpg", import.meta.url);

async function fixtureBytes(): Promise<Uint8Array> {
  return new Uint8Array(await readFile(fixtureUrl));
}

function blob(bytes: Uint8Array, name = "upgrade.pdf"): File {
  return new File([bytes.slice().buffer as ArrayBuffer], name, { type: "application/pdf" });
}

describe("ticket 220 page-scoped PDF extraction", () => {
  it("extracts only selected pages with explicit mode and page separators", async () => {
    const bytes = await fixtureBytes();
    const lines = await extractPdfTextScoped(bytes, { pages: [2, 1], mode: "operator-lines" });
    expect(lines).toMatchObject({
      mode: "operator-lines",
      selectedPages: [2, 1],
      truncated: false,
      pages: [
        { page: 2, text: "page two", truncated: false },
        { page: 1, text: "page one\nsecond line", truncated: false },
      ],
    });
    expect(lines.text).toBe("===== PAGINA 2 =====\n\npage two\n\n===== PAGINA 1 =====\n\npage one\nsecond line");
    expect(lines.pageSeparator).toBe("\n\n===== PAGINA {page} =====\n\n");

    const compact = await extractPdfTextScoped(bytes, { pages: [1], mode: "content-order" });
    expect(compact.pages[0]?.text).toBe("page one second line");
    expect(compact.text).toBe("===== PAGINA 1 =====\n\npage one second line");
    await expect(extractPdfTextScoped(bytes, { pages: [3] })).rejects.toThrow(/page range/iu);
  });

  it("exports original DCT bytes with page/object provenance and reports unsupported filters", async () => {
    const bytes = await fixtureBytes();
    const jpeg = new Uint8Array(await readFile(jpegUrl));
    const deduped = await extractPdfImagesScoped(bytes, { dedupe: true });
    expect(deduped).toMatchObject({
      mode: "embedded-original-compressed-bytes",
      selectedPages: [1, 2],
      deduplicated: true,
    });
    expect(deduped.artifacts).toHaveLength(1);
    expect(deduped.artifacts[0]?.bytes).toEqual(jpeg);
    expect(deduped.provenance[0]).toMatchObject({
      object: 5,
      filter: "DCTDecode",
      occurrences: [
        { page: 1, resourceName: "ImShared", object: 5 },
        { page: 2, resourceName: "ImShared", object: 5 },
      ],
    });
    expect(deduped.unsupported).toEqual([
      expect.objectContaining({ page: 1, resourceName: "ImUnsupported", object: 6, filters: ["FlateDecode"] }),
    ]);
    expect(deduped.unsupported[0]?.reason).toMatch(/only exported for a single DCTDecode/u);

    const occurrences = await extractPdfImagesScoped(bytes, { pages: [1, 2], dedupe: false });
    expect(occurrences.artifacts).toHaveLength(2);
    expect(occurrences.provenance.map((entry) => entry.occurrences[0]?.page)).toEqual([1, 2]);
    expect(occurrences.artifacts.every((artifact) => artifact.bytes.every((byte, index) => byte === jpeg[index]))).toBe(true);

    const secondPageOnly = await extractPdfImagesScoped(bytes, { pages: [2], dedupe: true });
    expect(secondPageOnly.unsupported).toHaveLength(0);
    expect(secondPageOnly.provenance[0]?.occurrences).toEqual([{ page: 2, resourceName: "ImShared", object: 5 }]);
  });
});

describe("ticket 318 PDF metadata inspect/remove upgrade", () => {
  it("distinguishes recognized Info fields, unknown entries, and XMP carrier provenance", async () => {
    const inspection = inspectPdfBytes(await fixtureBytes());
    expect(inspection.metadata.recognizedInfo).toEqual({
      Title: "Upgrade fixture",
      Author: "Strumentini",
      ModDate: "D:20261006210000+02'00'",
    });
    expect(inspection.metadata.unknownInfo).toEqual({ CustomKey: "unknown-value" });
    expect(inspection.metadata.entries).toEqual(expect.arrayContaining([
      { key: "Title", value: "Upgrade fixture", recognized: true, source: "document-info" },
      { key: "CustomKey", value: "unknown-value", recognized: false, source: "document-info" },
    ]));
    expect(inspection.metadata.xmpObjectIds).toEqual([9]);
    expect(inspection.metadata.hasXmp).toBe(true);
  });

  it("reparses metadata-removed output and requires stable page-count/text baseline", async () => {
    const bytes = await fixtureBytes();
    const output = await metadataRemover.run({ file: blob(bytes) }, { defaults: {} }) as PdfMetadataRemoverOutput;
    expect(output.artifacts).toHaveLength(1);
    expect(output.before.metadata.unknownInfo).toEqual({ CustomKey: "unknown-value" });
    expect(output.after.metadata.recognizedInfo).toEqual({});
    expect(output.after.metadata.unknownInfo).toEqual({});
    expect(output.after.metadata.xmpObjectIds).toEqual([]);
    expect(output.verification).toEqual({
      reparsed: true,
      metadataRemoved: true,
      pageCount: { before: 2, after: 2, stable: true },
      textBaseline: { status: "verified", stable: true, changedPages: [] },
    });
    const reparsed = inspectPdfBytes(output.artifacts[0]!.bytes);
    expect(reparsed.pageCount).toBe(2);
    expect(reparsed.metadata.hasXmp).toBe(false);
  });

  it("does not intentionally flatten unrelated page/catalog interactive content during metadata-only cleanup", async () => {
    const annotated = new Uint8Array(await readFile(new URL("../quality/fixtures/pdf-gold/annotated.pdf", import.meta.url)));
    const before = inspectPdfBytes(annotated);
    expect(before.links).toHaveLength(1);
    expect(before.forms).toHaveLength(1);
    const output = await metadataRemover.run({ file: blob(annotated, "annotated.pdf") }, { defaults: {} }) as PdfMetadataRemoverOutput;
    const after = inspectPdfBytes(output.artifacts[0]!.bytes);
    expect(after.links).toHaveLength(1);
    expect(after.forms).toHaveLength(1);
    expect(after.links[0]?.uri).toBe(before.links[0]?.uri);
    expect(after.forms[0]).toMatchObject({ name: before.forms[0]?.name, fieldType: before.forms[0]?.fieldType, value: before.forms[0]?.value });
    expect(output.verification.pageCount.stable).toBe(true);
    expect(output.verification.textBaseline).toMatchObject({ status: "verified", stable: true });
  });
});
