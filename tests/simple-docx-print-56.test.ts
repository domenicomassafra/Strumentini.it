import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { generateDocxFromSemanticText } from "../src/engines/ooxml/office-semantics";
import { simpleDocxToPrintableText56 } from "../src/engines/pdf/simple-docx-print-56";
import { buildPrintablePdf } from "../src/engines/pdf/printable-document";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

describe("STR-056: DOCX semplice→PDF locale", () => {
  it("riconosce DOCX editabile semplice, genera PDF con testo e conferma pagine con PDF.js", async () => {
    const generated = await generateDocxFromSemanticText("Titolo ricevuta\n\nPrima riga stampabile.\nSeconda riga stampabile.", "text");
    const source = await simpleDocxToPrintableText56(generated.bytes);
    expect(source).toContain("Titolo ricevuta");
    expect(source).toContain("Prima riga stampabile");
    const pdf = buildPrintablePdf({ kind: "txt", source, pageSize: "a4", pageNumbers: true });
    const reader = getDocument({ data: pdf.bytes.slice(), useSystemFonts: true, disableFontFace: true });
    try {
      const document = await reader.promise;
      expect(document.numPages).toBeGreaterThan(0);
      const page = await document.getPage(1);
      const content = await page.getTextContent();
      const text = content.items.filter((item) => "str" in item).map((item) => "str" in item ? item.str : "").join(" ");
      expect(text).toContain("Titolo ricevuta");
      expect(text).toContain("Prima riga stampabile");
      expect(pdf.bytes.slice(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    } finally { await reader.destroy(); }
  });

  it("rifiuta DOCX complesso con tabelle, immagini, hyperlink e font esterni", async () => {
    const complex = readFileSync(new URL("./ooxml-68-corpus/complex.docx", import.meta.url));
    await expect(simpleDocxToPrintableText56(complex)).rejects.toThrow(/PDF56_DOCX_UNSUPPORTED/u);
  });

  it("rifiuta archivi rinominati e dimensioni eccessive", async () => {
    await expect(simpleDocxToPrintableText56(new Uint8Array(512 * 1024 + 1))).rejects.toThrow(/PDF56_DOCX_LIMIT/u);
    await expect(simpleDocxToPrintableText56(new TextEncoder().encode("not an office document"))).rejects.toThrow();
  });
  it("rifiuta note reali anche se accompagnate dai separatori standard di docx", async () => {
    const generated = await generateDocxFromSemanticText("Ricevuta", "text");
    const entries = unzipSync(new Uint8Array(generated.bytes));
    const xml = strFromU8(entries["word/footnotes.xml"]!);
    entries["word/footnotes.xml"] = strToU8(xml.replace("</w:footnotes>", '<w:footnote w:id="1"><w:p><w:r><w:t>Nota privata</w:t></w:r></w:p></w:footnote></w:footnotes>'));
    await expect(simpleDocxToPrintableText56(zipSync(entries))).rejects.toThrow(/PDF56_DOCX_UNSUPPORTED/u);
  });
});
