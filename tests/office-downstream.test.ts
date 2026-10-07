import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import {
  cleanOfficeMetadata,
  extractDocxSemantics,
  extractPptxOutline,
  generateDocxFromSemanticText,
  inspectOfficeStructure,
} from "../src/engines/ooxml/office-semantics";

function exact(bytes: Buffer): Uint8Array {
  return new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

describe("Office downstream tickets 163/226/227/260/261", () => {
  it("cleans OOXML metadata, preserves relationships/member set and reinspects empty", async () => {
    for (const filename of ["sample.docx", "sample.xlsx", "sample.pptx"] as const) {
      const source = exact(await readFile(`spikes/heavy-local-feasibility/public/corpus/${filename}`));
      const beforeMembers = unzipSync(source);
      const result = await cleanOfficeMetadata(source);
      const afterMembers = unzipSync(new Uint8Array(result.bytes));
      expect(result.before.length, filename).toBeGreaterThan(0);
      expect(result.after, filename).toEqual([]);
      expect(result.removed, filename).toEqual(result.before);
      expect(result.verification).toEqual({
        metadataReinspectionEmpty: true,
        memberSetUnchanged: true,
        relationshipBytesUnchanged: true,
        contentTypesBytesUnchanged: true,
        structuralCountsUnchanged: true,
      });
      expect(result.output).toMatchObject({
        kind: result.input.kind,
        entryCount: result.input.entryCount,
        documentCount: result.input.documentCount,
        slideCount: result.input.slideCount,
        sheetCount: result.input.sheetCount,
        relationshipPartCount: result.input.relationshipPartCount,
      });
      expect(Object.keys(afterMembers).toSorted()).toEqual(Object.keys(beforeMembers).toSorted());
      for (const path of Object.keys(beforeMembers).filter((path) => /\.rels$/u.test(path))) {
        expect([...afterMembers[path]!], `${filename}:${path}`).toEqual([...beforeMembers[path]!]);
      }
      expect([...afterMembers["[Content_Types].xml"]!]).toEqual([...beforeMembers["[Content_Types].xml"]!]);
    }
  });

  it("extracts bounded DOCX semantics without claiming layout fidelity", async () => {
    const source = exact(await readFile("spikes/heavy-local-feasibility/public/corpus/sample.docx"));
    const result = await extractDocxSemantics(source);
    expect(result).toMatchObject({
      fidelity: "semantic-not-layout",
      activeContentPolicy: "macros-refused-external-resources-never-fetched",
    });
    expect(result.text).toContain("Fattura di prova");
    expect(result.text).toContain("Cliente: Mario Rossi");
    expect(result.markdown).toContain("Totale: 299,90 EUR");
    expect(result.html).toContain("<p>Fattura di prova</p>");
    expect(result.structureCounts).toMatchObject({ paragraphs: 3, headings: 0, listItems: 0, tables: 0, assets: 0 });
    expect(result.unsupportedConstructs).toContain("Footnotes/endnotes are not merged into the primary semantic reading order.");
  });

  it("generates deterministic bounded DOCX from Markdown and independently reopens semantic structure", async () => {
    const markdown = [
      "# Titolo",
      "",
      "Testo con [OpenAI](https://openai.com).",
      "",
      "- Uno",
      "1. Due",
      "",
      "| id | valore |",
      "| --- | --- |",
      "| 001 | È |",
      "",
      "```",
      "const x = 1;",
      "```",
      "",
      "![diagramma](https://example.invalid/image.png)",
    ].join("\n");
    const generated = await generateDocxFromSemanticText(markdown, "markdown");
    expect(generated.output).toMatchObject({ kind: "docx", documentCount: 1 });
    expect(generated.verification).toEqual({ reopened: true, memberSetValidated: true, deterministicSimpleStyleTemplate: true });
    expect(generated.reopened.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "heading", level: 1, text: "Titolo" }),
      expect.objectContaining({ type: "list-item", text: "Uno" }),
      expect.objectContaining({ type: "table", rows: [["id", "valore"], ["001", "È"]] }),
    ]));
    expect(generated.reopened.markdown).toContain("[OpenAI](https://openai.com)");
    expect(generated.reopened.html).toContain('<a href="https://openai.com" rel="noreferrer">OpenAI</a>');
    expect(generated.reopened.structureCounts).toMatchObject({ headings: 1, listItems: 2, tables: 1, links: 1 });
    expect(generated.unsupportedConstructs).toContain("Markdown image references are represented as text placeholders; image bytes are not fetched or embedded.");
    const members = unzipSync(new Uint8Array(generated.bytes));
    expect(new TextDecoder().decode(members["word/_rels/document.xml.rels"])).toContain('Target="https://openai.com" TargetMode="External"');
  });

  it("generates bounded TXT and sanitized HTML-derived DOCX without executing active HTML", async () => {
    const txt = await generateDocxFromSemanticText("Prima riga\nseconda\n\nAltro", "text");
    expect(txt.reopened.text).toContain("Prima riga\nseconda");
    expect(txt.reopened.text).toContain("Altro");

    const html = await generateDocxFromSemanticText('<h2>Titolo</h2><script>alert(1)</script><p>Safe <a href="https://example.com">link</a></p><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><img src="https://example.invalid/x.png" alt="diagramma">', "html");
    expect(html.reopened.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "heading", level: 2, text: "Titolo" }),
      expect.objectContaining({ type: "table", rows: [["A", "B"], ["1", "2"]] }),
    ]));
    expect(html.reopened.text).not.toContain("alert(1)");
    expect(html.reopened.markdown).toContain("[link](https://example.com)");
    expect(html.unsupportedConstructs).toEqual(expect.arrayContaining([
      "HTML <script> content is omitted and never executed.",
      "HTML image references are represented as text placeholders; image bytes are not fetched or embedded.",
    ]));
  });

  it("extracts PPTX text outline and media inventory but explicitly refuses raster rendering", async () => {
    const source = exact(await readFile("spikes/heavy-local-feasibility/public/corpus/sample.pptx"));
    const result = await extractPptxOutline(source);
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0]).toMatchObject({
      slideNumber: 1,
      part: "ppt/slides/slide1.xml",
      title: "Presentazione di prova",
      titleSource: "first-text-fallback",
      text: ["Presentazione di prova", "Valore verificabile: 12345"],
    });
    expect(result.rasterExport).toEqual({
      status: "REFUSED",
      reason: "No approved faithful PPTX renderer exists in the bounded Office runtime.",
    });
    expect(result.unsupportedConstructs).toContain("Slide preview is text/structure only; raster or layout-faithful rendering is refused without an approved renderer.");
  });

  it("inspects DOCX/XLSX/PPTX structure read-only with active-content policy visible", async () => {
    for (const filename of ["sample.docx", "sample.xlsx", "sample.pptx"] as const) {
      const source = exact(await readFile(`spikes/heavy-local-feasibility/public/corpus/${filename}`));
      const result = await inspectOfficeStructure(source);
      expect(result.previewPolicy).toBe("semantic-structure-only-not-faithful-rendering");
      expect(result.activeContentPolicy).toBe("macros-refused-scripts-never-executed-external-links-never-resolved");
      expect(result.analysis.entryCount).toBeGreaterThan(0);
      expect(result.kind).toBe(filename.slice(-4) as "docx" | "xlsx" | "pptx");
    }
  });
});
