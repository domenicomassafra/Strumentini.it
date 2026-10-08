import { describe, expect, it } from "vitest";
import { buildPrintablePdf } from "../src/engines/pdf/printable-document";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { parsePdf, nameValue } from "../src/engines/pdf/parser";

async function pagesText(bytes: Uint8Array): Promise<string[]> {
  return (await extractPdfText(bytes)).map((item) => item.text);
}

describe("#256 — parser-aware printable PDF layout", () => {
  it("turns TXT into multi-page A4 with legal positioning, wrapping and stable bytes", async () => {
    const source = Array.from({ length: 145 }, (_, index) =>
      `Riga-${index.toString().padStart(3, "0")} ${"parola ".repeat(22)}fine-${index}`).join("\n");
    const result = buildPrintablePdf({ kind: "txt", source, pageNumbers: true, marginPt: 48, fontPt: 10 });
    expect(result.pageCount).toBeGreaterThan(2);
    expect(result.widthPt).toBeCloseTo(595.28, 2);
    expect(result.heightPt).toBeCloseTo(841.89, 2);
    expect(result.renderedLines).toBeGreaterThan(145);
    expect(result.bytes).toEqual(buildPrintablePdf({ kind: "txt", source, pageNumbers: true, marginPt: 48, fontPt: 10 }).bytes);
    expect(result.bytes.subarray(0, 5)).toEqual(new TextEncoder().encode("%PDF-"));
    expect(inspectPdfBytes(result.bytes).pageCount).toBe(result.pageCount);
    const text = (await pagesText(result.bytes)).join("\n");
    expect(text).toContain("Riga-000");
    expect(text).toContain("fine-144");
    expect(text).toContain(`1 / ${result.pageCount}`);
    const pdf = parsePdf(result.bytes);
    let checked = 0;
    for (const page of pdf.pages) {
      const value = page.object.value;
      if (value.kind !== "dict") throw new Error("Expected PDF page dict");
      const ref = value.entries.get("Contents");
      if (ref?.kind !== "ref") throw new Error("Expected contents ref");
      const stream = pdf.objects.get(ref.id)?.value;
      if (stream?.kind !== "stream") throw new Error("Expected contents stream");
      const content = new TextDecoder().decode(stream.bytes);
      for (const match of content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/gu)) {
        const x = Number(match[1]), y = Number(match[2]);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(result.widthPt);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(result.heightPt);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(result.renderedLines);
  });

  it("recognizes Markdown headings/lists and inert HTML; never emits scripts or remote resource bytes", async () => {
    const md = buildPrintablePdf({ kind: "markdown", source: "# Progetto\n\n- prima voce\n- seconda voce\n\n**Ottimo** lavoro" });
    const markdownText = (await pagesText(md.bytes)).join(" ");
    expect(markdownText).toContain("Progetto");
    expect(markdownText).toContain("prima voce");
    expect(markdownText).toContain("Ottimo lavoro");
    const html = buildPrintablePdf({ kind: "html", source:
      `<h1>Titolo</h1><script>window.evil='SENTINEL_EXEC'</script><iframe src="https://example.com/iframe"></iframe><style>body{background:url(https://example.com/tracker)}</style><p>Solo <strong>testo</strong> sicuro &amp; locale.</p><img src="https://example.com/private.png" alt="Figura senza download">` });
    const htmlText = (await pagesText(html.bytes)).join(" ");
    expect(htmlText).toContain("Titolo");
    expect(htmlText).toContain("Solo testo sicuro & locale");
    expect(htmlText).not.toContain("SENTINEL_EXEC");
    expect(htmlText).not.toContain("tracker");
    expect(new TextDecoder("latin1").decode(html.bytes)).not.toContain("example.com");
    expect(html.warnings).toContain("HTML: script, CSS, elementi incorporati e risorse esterne ignorati senza esecuzione.");
  });

  it("paginates CSV row cells and repeats headings without deleting quoted newlines or end rows", async () => {
    const rows = ['Nome,Descrizione,Stato',
      ...Array.from({ length: 170 }, (_, index) => `R${String(index).padStart(3, "0")},"${"frase lunga ".repeat(14)}",Pronto`),
      '"ULTIMA","Testo\nseconda riga",Completa'];
    const source = rows.join("\n");
    const result = buildPrintablePdf({ kind: "csv", source, orientation: "landscape", pageSize: "letter", marginPt: 35, fontPt: 9 });
    expect(result.tableRows).toBe(172);
    expect(result.pageCount).toBeGreaterThan(2);
    expect([result.widthPt, result.heightPt]).toEqual([792, 612]);
    const texts = await pagesText(result.bytes);
    for (const page of texts) expect(page).toContain("Nome");
    expect(texts.join("\n")).toContain("ULTIMA");
    expect(texts.join("\n")).toContain("seconda riga");
    expect(texts.join("\n")).toContain("R000");
    expect(texts.join("\n")).toContain("R169");
    const model = parsePdf(result.bytes);
    expect(model.pages).toHaveLength(result.pageCount);
    const fontObject = [...model.objects.values()].find((item) =>
      item.value.kind === "dict" && nameValue(item.value.entries.get("Subtype")) === "Type1");
    expect(fontObject?.value.kind === "dict" ? nameValue(fontObject.value.entries.get("BaseFont")) : null).toBe("Courier");
  });

  it("supports Italian WinAnsi but fails closed on unsupported Unicode, limits and invalid PDF layout", async () => {
    const result = buildPrintablePdf({ kind: "txt", source: "Città, perché, già, più, € e “citazione”" });
    const text = (await pagesText(result.bytes)).join(" ");
    expect(text).toContain("Città");
    expect(text).toContain("€");
    await expect(Promise.resolve().then(() => buildPrintablePdf({ kind: "txt", source: "Emoji 🔥" })))
      .rejects.toThrow(/UNSUPPORTED_UNICODE/u);
    expect(() => buildPrintablePdf({ kind: "csv", source: "a,b,c,d,e,f,g,h,i\n1,2,3,4,5,6,7,8,9" }))
      .toThrow(/8 colonne/u);
    expect(() => buildPrintablePdf({ kind: "txt", source: "valido", marginPt: 120 })).toThrow(/INVALID_INPUT/u);
    expect(() => buildPrintablePdf({ kind: "txt", source: "valido", fontPt: 1 })).toThrow(/INVALID_INPUT/u);
  });
});
