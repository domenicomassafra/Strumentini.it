import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { PdfRepair418Error, repairPdf418 } from "../src/engines/pdf/repair-418";
import { readFileSync } from "node:fs";
import { pdfRepairManifest } from "../src/tools/pdf-repair/manifest";

async function pdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([300, 300]);
  page.drawText("SAFE_418_PAGE", { x: 22, y: 140, font: await document.embedFont(StandardFonts.Helvetica) });
  return document.save({ useObjectStreams: false });
}

function latin(bytes: Uint8Array): string {
  return new TextDecoder("windows-1252").decode(bytes);
}

function replace(bytes: Uint8Array, pattern: RegExp, replacement: string): Uint8Array {
  const string = latin(bytes);
  const match = pattern.exec(string);
  if (!match) throw new Error("Test fixture pattern absent");
  const prefix = bytes.subarray(0, match.index);
  const suffix = bytes.subarray(match.index + match[0].length);
  const inserted = new TextEncoder().encode(replacement);
  const output = new Uint8Array(prefix.length + inserted.length + suffix.length);
  output.set(prefix);
  output.set(inserted, prefix.length);
  output.set(suffix, prefix.length + inserted.length);
  return output;
}

describe("STR-418 bounded classic-xref pointer recovery", () => {
  it("binds the repair manifest to its PDF oracle rather than an unrelated EPUB oracle", () => {
    const registry = JSON.parse(readFileSync(new URL("../quality/oracles/registry.json", import.meta.url), "utf8")) as {
      entries: Array<{ id: string; candidate: string; tool_family: string }>;
    };
    const entry = registry.entries.find((item) => item.id === pdfRepairManifest.gold.oracleEntryId);
    expect(entry).toMatchObject({
      id: "cand-273",
      tool_family: "pdf",
      candidate: expect.stringMatching(/PDF classic xref pointer recovery/i),
    });
  });

  it("repairs exactly a corrupt startxref pointer with an independent PDF.js readback", async () => {
    const good = await pdf();
    const broken = replace(good, /startxref\s+\d+\s+%%EOF/, "startxref\n99999999\n%%EOF");
    const originalCopy = broken.slice();
    const result = await repairPdf418(broken);
    expect(result.profile).toBe("single-classic-xref-pointer-only");
    expect(result.pageCount).toBe(1);
    expect(result.losses).toEqual([]);
    expect(broken).toEqual(originalCopy);
    expect(result.bytes).not.toEqual(broken);
    const output = latin(result.bytes);
    const marker = /startxref\s+(\d+)\s+%%EOF/.exec(output);
    expect(marker).not.toBeNull();
    expect(output.slice(Number(marker![1]), Number(marker![1]) + 5)).toMatch(/^xref/);
    expect(await PDFDocument.load(result.bytes).then((document) => document.getPageCount())).toBe(1);
  }, 20_000);

  it("refuses healthy documents (no invented recovery)", async () => {
    await expect(repairPdf418(await pdf())).rejects.toMatchObject({ code: "REFUSED" });
  });

  it.each([
    ["damaged header", (bytes: Uint8Array) => replace(bytes, /^%PDF/, "%BAD"), "REFUSED"],
    ["ambiguous second trailer", (bytes: Uint8Array) => replace(bytes, /trailer\s*<</, "trailer << /Foo 1 >>\ntrailer <<"), "REFUSED"],
    ["encrypted marker", (bytes: Uint8Array) => replace(bytes, /trailer\s*<</, "trailer << /Encrypt 9 0 R"), "UNSUPPORTED"],
    ["signed marker", (bytes: Uint8Array) => replace(bytes, /trailer\s*<</, "trailer << /ByteRange [0 12 13 14]"), "UNSUPPORTED"],
    ["incremental marker", (bytes: Uint8Array) => replace(bytes, /trailer\s*<</, "trailer << /Prev 20"), "UNSUPPORTED"],
    ["corrupt xref section", (bytes: Uint8Array) => replace(bytes, /xref\s+0\s+\d+/, "xref\n1 2"), "REFUSED"],
    ["invalid trailer size", (bytes: Uint8Array) => replace(bytes, /\/Size\s+\d+/, "/Size 0"), "REFUSED"],
    ["overlapping free xref subsection", (bytes: Uint8Array) => replace(bytes, /\ntrailer\s*<</, "\n0 1\n0000000000 65535 f \ntrailer <<"), "REFUSED"],
  ])("refuses %s", async (_description, transform, code) => {
    const broken = replace(transform(await pdf()), /startxref\s+\d+\s+%%EOF/, "startxref\n99999999\n%%EOF");
    await expect(repairPdf418(broken)).rejects.toMatchObject({ code });
  });

  it("refuses too-large input before calling a parser", async () => {
    await expect(repairPdf418(new Uint8Array(4 * 1024 * 1024 + 1))).rejects.toMatchObject({ code: "LIMIT" });
  });

  it("respects pre-abort without changing input", async () => {
    const source = await pdf();
    const controller = new AbortController();
    controller.abort();
    await expect(repairPdf418(source, controller.signal)).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("has a typed error contract", () => {
    expect(new PdfRepair418Error("REFUSED", "blocked").name).toBe("PdfRepair418Error");
  });
});
