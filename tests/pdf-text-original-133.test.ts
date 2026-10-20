import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildPdfFromPages, createSimplePdf } from "../src/engines/pdf/writer";
import { parsePdf, pdfName, pdfDict, pdfReference, resolveReference, nameValue, type PdfPageNode } from "../src/engines/pdf/parser";
import { editPdfOriginalText133 } from "../src/engines/pdf/edit-original-text-133";

function courierPdf(text = "ALFA", extraPage = "KEEP"): Uint8Array {
  const source = parsePdf(createSimplePdf([text, extraPage]));
  const objects = new Map(source.objects);
  for (const object of objects.values()) {
    if (object.value.kind === "dict" && nameValue(object.value.entries.get("Subtype")) === "Type1") {
      objects.set(object.id, { ...object, value: {
        kind: "dict", entries: new Map([...object.value.entries, ["BaseFont", pdfName("Courier")]])
      } });
    }
  }
  const changed = { ...source, objects };
  return buildPdfFromPages(changed.pages.map((page) => ({ document: changed, page })), { flatten: false, compress: false });
}

async function independentTextAndLayout(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: true, disableFontFace: true });
  const doc = await task.promise;
  try {
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const data = await page.getTextContent();
      pages.push({ items: data.items.filter((v): v is Extract<typeof v, { str: string }> => "str" in v)
        .map((item) => ({ text: item.str, width: item.width, height: item.height, transform: item.transform,
          font: data.styles[item.fontName]?.fontFamily })), width: page.view[2], height: page.view[3] });
    }
    return pages;
  } finally { await task.destroy(); }
}

describe("STR-373 original PDF text edit (not overlay)", () => {
  it("replaces an original Courier glyph run; independent extraction and geometry survive reopening", async () => {
    const source = courierPdf("ALFA", "RESTO");
    const frozen = source.slice();
    const before = await independentTextAndLayout(source);
    const result = editPdfOriginalText133(source, { page: 1, before: "ALFA", after: "BETA" });
    const after = await independentTextAndLayout(result.bytes);
    expect(source).toEqual(frozen);
    expect(after[0]?.items.map((i) => i.text)).toEqual(["BETA"]);
    expect(after[1]).toEqual(before[1]);
    expect(after[0]?.items[0]?.font).toEqual(before[0]?.items[0]?.font);
    expect(after[0]?.items[0]?.width).toBeCloseTo(before[0]!.items[0]!.width);
    expect(after[0]?.items[0]?.transform).toEqual(before[0]?.items[0]?.transform);
    expect(result.pageCount).toBe(2);
    const contents = (bytes: Uint8Array) => {
      const model = parsePdf(bytes);
      const first = model.pages[0]!.object.value;
      if (first.kind !== "dict") throw new Error("page");
      const stream = resolveReference(model, first.entries.get("Contents"));
      if (stream?.kind !== "stream") throw new Error("stream");
      return new TextDecoder().decode(stream.bytes);
    };
    expect(contents(result.bytes)).toContain("(BETA) Tj");
    expect(contents(result.bytes)).not.toContain("(ALFA) Tj");
  });

  it("refuses glyphs outside ASCII, changed width, ambiguous target, wrong font and signed PDF", () => {
    const src = courierPdf();
    expect(() => editPdfOriginalText133(src, { page: 1, before: "ALFA", after: "CAFÉ" })).toThrow(/GLYPH|UNSUPPORTED/i);
    expect(() => editPdfOriginalText133(src, { page: 1, before: "ALFA", after: "LONGER" })).toThrow(/LAYOUT|UNSUPPORTED/i);
    expect(() => editPdfOriginalText133(src, { page: 1, before: "XXXXX", after: "BETA" })).toThrow(/AMBIGUOUS|UNSUPPORTED/i);
    expect(() => editPdfOriginalText133(createSimplePdf(["ALFA"]), { page: 1, before: "ALFA", after: "BETA" })).toThrow(/FONT|UNSUPPORTED/i);
    const signed = parsePdf(src);
    const objects = new Map(signed.objects);
    const next = Math.max(...objects.keys()) + 1;
    objects.set(next, { id: next, generation: 0, value: pdfDict({ Type: pdfName("Sig") }) });
    const signedDoc = { ...signed, objects };
    // Put signature in the page dictionary to keep it reachable during serialization.
    const pages: PdfPageNode[] = signed.pages.map((node, i) => i ? node :
      node.object.value.kind !== "dict" ? node : {
        ...node, object: { ...node.object, value: { kind: "dict", entries: new Map([...node.object.value.entries, ["Signature", pdfReference(next)]]) } }
      });
    const signedBytes = buildPdfFromPages(pages.map((page) => ({ document: signedDoc, page })), { flatten: false });
    expect(() => editPdfOriginalText133(signedBytes, { page: 1, before: "ALFA", after: "BETA" })).toThrow(/SIGN|UNSUPPORTED/i);
  });

  it("refuses annotations, malformed input and aborted processing without touching source", async () => {
    const source = courierPdf();
    const doc = parsePdf(source);
    const pages: PdfPageNode[] = doc.pages.map((node, i) => i ? node :
      node.object.value.kind !== "dict" ? node : {
        ...node, object: { ...node.object, value: { kind: "dict", entries: new Map([...node.object.value.entries,
          ["Annots", { kind: "array" as const, items: [] }]]) } }
      });
    const annotated = buildPdfFromPages(pages.map((page) => ({ document: doc, page })), { flatten: false });
    expect(() => editPdfOriginalText133(annotated, { page: 1, before: "ALFA", after: "BETA" })).toThrow(/ANNOT|UNSUPPORTED/i);
    expect(() => editPdfOriginalText133(new TextEncoder().encode("invalid"), { page: 1, before: "ALFA", after: "BETA" })).toThrow();
    const controller = new AbortController();
    controller.abort();
    expect(() => editPdfOriginalText133(source, { page: 1, before: "ALFA", after: "BETA" }, controller.signal)).toThrow(/abort|annull/i);
    expect((await independentTextAndLayout(source))[0]?.items[0]?.text).toBe("ALFA");
  });
});
