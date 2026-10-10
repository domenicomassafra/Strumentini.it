import { describe, expect, it } from "vitest";
import { createSimplePdf } from "../src/engines/pdf";
import { pdfToDocx57 } from "../src/engines/pdf/pdf-to-docx-57";
import { extractDocxSemantics } from "../src/engines/ooxml/office-semantics";
import { analyzeOoxmlPackage } from "../src/engines/ooxml/package";

function file(pages: string[], name = "report.pdf") {
  const bytes = createSimplePdf(pages);
  return new File([bytes.slice().buffer as ArrayBuffer], name, { type: "application/pdf" });
}

describe("#057 bounded PDF to actual editable Word with provenance", () => {
  it("creates independently reopened Word paragraphs for each source page, preserves literal symbols and warnings", async () => {
    const result = await pdfToDocx57(file(["one & <two> **plain**", "other [page] with _marks_"], "Original 57.pdf"));
    expect(result.pageCount).toBe(2);
    expect(result.filename).toBe("Original 57.docx");
    expect(result.sourceSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.losses.join(" ")).toMatch(/tabelle.*colonne/iu);
    const packageAnalysis = analyzeOoxmlPackage(result.bytes);
    expect(packageAnalysis.kind).toBe("docx");
    const reopened = await extractDocxSemantics(result.bytes);
    expect(reopened.fidelity).toBe("semantic-not-layout");
    expect(reopened.blocks.some((block) => block.type === "paragraph" && block.text === "one & <two> **plain**")).toBe(true);
    expect(reopened.blocks.some((block) => block.type === "paragraph" && block.text === "other [page] with _marks_")).toBe(true);
    expect(reopened.text).toContain("Pagina PDF 1 di 2 · Original 57.pdf");
    expect(reopened.text).toContain("Pagina PDF 2 di 2 · Original 57.pdf");
    expect(reopened.text).toContain(result.sourceSha256);
  });

  it("does not produce a misleading DOCX for scanned, mixed, encrypted, corrupt or cancelled PDFs", async () => {
    await expect(pdfToDocx57(file([""]))).rejects.toThrow(/PDF57_OCR_REQUIRED/u);
    await expect(pdfToDocx57(file(["text", ""]))).rejects.toThrow(/PDF57_OCR_REQUIRED/u);
    const encrypted = createSimplePdf(["private"]);
    const source = new TextDecoder().decode(encrypted);
    const bytes = new TextEncoder().encode(source.replace("/Root 1 0 R>>", "/Root 1 0 R /Encrypt 99 0 R>>"));
    await expect(pdfToDocx57(new File([bytes], "private.pdf", { type: "application/pdf" }))).rejects.toThrow(/PDF57_ENCRYPTED/u);
    await expect(pdfToDocx57(new File(["not a PDF"], "garbage.pdf"))).rejects.toThrow();
    const abort = new AbortController(); abort.abort();
    await expect(pdfToDocx57(file(["hello"]), abort.signal)).rejects.toMatchObject({ name: "AbortError" });
    await expect(pdfToDocx57(file(["hello"], "unsafe.pdfx"))).rejects.toThrow(/PDF57_INPUT/u);
    await expect(pdfToDocx57(file(Array.from({ length: 13 }, (_, i) => `page ${i}`)))).rejects.toThrow(/PDF57_LIMIT/u);
  });
});
