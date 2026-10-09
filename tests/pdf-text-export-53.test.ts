import { describe, expect, it } from "vitest";
import { createSimplePdf } from "../src/engines/pdf/writer";
import { exportScopedPdfText53 } from "../src/engines/pdf/text-export-53";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";

const decode = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

function blankPdf(): Uint8Array {
  const out = new PdfBuilder(), pages = out.reserve();
  const content = out.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new Uint8Array() });
  const page = out.putAuto(pdfDict({ Type: pdfName("Page"), MediaBox: pdfArray([0, 0, 300, 400].map(pdfNumber)), Contents: content }));
  out.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  return out.build(out.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages })), null);
}

describe("#53 source-scoped real TXT/Markdown export (no reading-order or OCR claim)", () => {
  it("produces actual UTF-8 TXT and safe Markdown bytes in exact requested page order", async () => {
    const source = createSimplePdf(["FIRST53", "SECOND53", "THIRD53"], { width: 300, height: 400 });
    const saved = await exportScopedPdfText53(source, { sourceName: "Fattura 2026.pdf", pages: [3, 1], mode: "operator-lines" });
    expect(saved).toMatchObject({ status: "EXTRACTED_TEXT_ONLY_NOT_LAYOUT", pages: [3, 1], mode: "operator-lines" });
    expect(saved.text.filename).toBe("Fattura-2026.txt");
    expect(saved.markdown.filename).toBe("Fattura-2026.md");
    const txt = decode(saved.text.bytes), markdown = decode(saved.markdown.bytes);
    expect(txt).toMatch(/^===== PAGINA 3 =====\n\nTHIRD53\n\n===== PAGINA 1 =====\n\nFIRST53$/u);
    expect(markdown).toContain("## Pagina 3\n\n```text\nTHIRD53\n```");
    expect(markdown).not.toContain("SECOND53");
    expect(saved.limitations.join(" ")).toMatch(/non è ordine di lettura/u);
  });

  it("refuses simulated OCR, invalid page order and aborted jobs without claiming output", async () => {
    await expect(exportScopedPdfText53(blankPdf(), { sourceName: "scan.pdf" })).rejects.toThrow(/PDF53_NO_TEXT_OCR_UNAVAILABLE/u);
    const pdf = createSimplePdf(["Hello53"]);
    await expect(exportScopedPdfText53(pdf, { sourceName: "text.pdf", pages: [2] })).rejects.toThrow();
    const abort = new AbortController(); abort.abort();
    await expect(exportScopedPdfText53(pdf, { sourceName: "text.pdf" }, abort.signal)).rejects.toMatchObject({ name: "AbortError" });
    await expect(exportScopedPdfText53(pdf, { sourceName: "" })).rejects.toThrow(/PDF53_SOURCE_NAME_INVALID/u);
  });
});
