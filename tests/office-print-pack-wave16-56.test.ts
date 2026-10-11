import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { exportOfficePrintable56 } from "../src/engines/pdf/office-print-pack-56";

const utf8Bom = Uint8Array.of(0xef, 0xbb, 0xbf);

function prefixedText(name: string, content: string, count = 1): File {
  return new File([...Array.from({ length: count }, () => utf8Bom), new TextEncoder().encode(content)],
    name, { type: "text/plain;charset=UTF-8" });
}

describe("#56 wave16 UTF-8 BOM cannot conceal an Office/PDF signature", () => {
  it("refuses real RTF and PDF headers masked by a UTF-8 BOM before creating a PDF", async () => {
    for (const source of [
      prefixedText("disguised.txt", "{\\rtf1\\ansi This is an RTF document}"),
      prefixedText("disguised.md", "%PDF-1.7\nThis is not Markdown"),
      prefixedText("disguised.html", "{\\rtf1\\ansi This is not HTML}"),
      prefixedText("repeated-bom.txt", "%PDF-1.7\nStill a PDF header", 2),
    ]) {
      await expect(exportOfficePrintable56(source), source.name)
        .rejects.toThrow(/PDF56_BINARY_REFUSED/u);
    }
  });

  it("identifies a genuine OOXML ZIP renamed as TXT even if a BOM precedes its signature", async () => {
    const docx = readFileSync(new URL("./ooxml-68-corpus/complex.docx", import.meta.url));
    expect(docx.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const disguised = new File([utf8Bom, docx], "renamed.txt", { type: "text/plain" });
    await expect(exportOfficePrintable56(disguised)).rejects.toThrow(/PDF56_BINARY_REFUSED/u);
  });

  it("keeps legitimate BOM-prefixed UTF-8 printable and PDF.js verifies the entire actual result", async () => {
    const source = prefixedText("legitimate.txt", "Documento UTF-8 con BOM. Città e qualità verificata.");
    const result = await exportOfficePrintable56(source, { pageSize: "letter", pageNumbers: false });
    expect(result).toMatchObject({
      sourceName: "legitimate.txt", sourceKind: "txt", decision: "PRINTABLE_LOCAL",
      documentVerification: { independentParser: "PDF.js", pageCount: 1, checkedPages: 1, allPagesChecked: true },
    });
    const task = getDocument({ data: result.artifact.bytes.slice(), useSystemFonts: true, disableFontFace: true });
    try {
      const pdf = await task.promise;
      expect(pdf.numPages).toBe(1);
      const page = await pdf.getPage(1);
      try {
        expect(page.view).toEqual([0, 0, 612, 792]);
        const text = (await page.getTextContent()).items
          .filter((item): item is typeof item & { str: string } => "str" in item)
          .map((item) => item.str).join(" ");
        expect(text).toContain("Documento UTF-8 con BOM.");
        expect(text).toContain("Città e qualità verificata.");
      } finally { page.cleanup(); }
    } finally { await task.destroy(); }
  });
});
