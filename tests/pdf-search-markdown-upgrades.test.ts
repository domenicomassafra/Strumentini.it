import { describe, expect, it } from "vitest";
import {
  PDF_TEXT_WORKFLOW_LIMITS,
  createSimplePdf,
  pdfToMarkdown,
  searchPdfTextAcrossFiles,
} from "../src/engines/pdf";
import searchModule from "../src/tools/pdf-multi-text-search/module";
import markdownModule from "../src/tools/pdf-to-markdown/module";

function named(bytes: Uint8Array, filename: string) {
  return { filename, input: bytes };
}

function file(bytes: Uint8Array, filename: string): File {
  const copy = Uint8Array.from(bytes);
  return new File([copy.buffer as ArrayBuffer], filename, { type: "application/pdf" });
}

function encrypted(bytes: Uint8Array): Uint8Array {
  const source = new TextDecoder().decode(bytes);
  return new TextEncoder().encode(source.replace("/Root 1 0 R>>", "/Root 1 0 R /Encrypt 99 0 R>>"));
}

describe("ticket 248 multi-PDF text search", () => {
  it("keeps mixed-corpus states isolated and preserves file/page/context provenance", async () => {
    const searchable = createSimplePdf(["alpha first page", "second ALPHA page"]);
    const noMatch = createSimplePdf(["beta only"]);
    const noText = createSimplePdf([""]);
    const protectedPdf = encrypted(createSimplePdf(["alpha private"]));
    const unreadable = new TextEncoder().encode("%PDF-1.7\nthis is not a parseable object graph");

    const result = await searchPdfTextAcrossFiles([
      named(searchable, "searchable.pdf"),
      named(noMatch, "no-match.pdf"),
      named(noText, "scan.pdf"),
      named(protectedPdf, "encrypted.pdf"),
      named(unreadable, "broken.pdf"),
    ], { query: "alpha", contextCharacters: 6, maxResults: 10 });

    expect(result.files.map((entry) => entry.status)).toEqual(["matches", "no-match", "no-text", "encrypted", "unreadable"]);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toMatchObject({ fileIndex: 0, filename: "searchable.pdf", page: 1, matchIndex: 0 });
    expect(result.matches[1]).toMatchObject({ fileIndex: 0, filename: "searchable.pdf", page: 2, matchIndex: 0 });
    expect(result.matches.every((match) => match.context.length <= 5 + 12)).toBe(true);
    expect(result.files[2]?.ocrHandoff).toMatchObject({ available: false, status: "not-available", backlogTicket: 247 });
    expect(result.files[3]?.errorCode).toBe("ENCRYPTED_PDF");
    expect(result.files[4]?.errorCode).toBeTruthy();
    expect(result.provenanceConvention).toBe("fileIndex+filename+page+matchIndex");
  });

  it("bounds query, context and result count without stopping later files", async () => {
    const many = createSimplePdf(["x x x x", "x x x"]);
    const later = createSimplePdf(["x"]);
    const result = await searchPdfTextAcrossFiles([
      named(many, "many.pdf"),
      named(later, "later.pdf"),
    ], { query: "x", contextCharacters: 0, maxResults: 3 });
    expect(result).toMatchObject({ totalMatches: 8, returnedMatches: 3, truncated: true });
    expect(result.files).toHaveLength(2);
    expect(result.files[1]).toMatchObject({ status: "matches", matchCount: 1, truncated: true });
    await expect(searchPdfTextAcrossFiles([named(many, "one.pdf")], { query: "q".repeat(PDF_TEXT_WORKFLOW_LIMITS.maxQueryCharacters + 1) })).rejects.toThrow(/query/iu);
    await expect(searchPdfTextAcrossFiles([named(many, "one.pdf")], { query: "x", contextCharacters: PDF_TEXT_WORKFLOW_LIMITS.maxContextCharacters + 1 })).rejects.toThrow(/context/iu);
    await expect(searchPdfTextAcrossFiles([named(many, "one.pdf")], { query: "x", maxResults: PDF_TEXT_WORKFLOW_LIMITS.maxResults + 1 })).rejects.toThrow(/maximum results/iu);
  });

  it("module preserves source File names and does not abort the batch for one bad PDF", async () => {
    const result = await searchModule.run({
      files: [
        file(createSimplePdf(["needle"]), "good.pdf"),
        file(new TextEncoder().encode("not a pdf"), "bad.pdf"),
      ],
      query: "needle",
      contextCharacters: 20,
      maxResults: 10,
    }, { defaults: {} }) as { files: Array<{ filename: string; status: string }> };
    expect(result.files).toEqual([
      expect.objectContaining({ filename: "good.pdf", status: "matches" }),
      expect.objectContaining({ filename: "bad.pdf", status: "unreadable" }),
    ]);
  });
});

describe("ticket 252 PDF to Markdown", () => {
  it("exports only page-scoped text with explicit provenance and escaped Markdown semantics", async () => {
    const source = createSimplePdf(["# heading *not semantic*", "page [two] <tag>"]);
    const result = await pdfToMarkdown("report.pdf", source);
    expect(result).toMatchObject({
      status: "converted",
      pageCount: 2,
      provenanceConvention: "html-comment:file-uri-encoded+page",
      extractionMode: "content-order",
    });
    expect(result.markdown).toContain('<!-- strumentini-pdf-page file="report.pdf" page="1" -->');
    expect(result.markdown).toContain("\\# heading \\*not semantic\\*");
    expect(result.markdown).toContain('<!-- strumentini-pdf-page file="report.pdf" page="2" -->');
    expect(result.markdown).toContain("page \\[two\\] \\<tag\\>");
    expect(result.losses.join(" ")).toMatch(/tabelle.*colonne multiple/iu);
    expect(result.losses.join(" ")).toMatch(/immagini/iu);
    expect(result.losses.join(" ")).toMatch(/font.*stile/iu);
  });

  it("does not pretend OCR exists for no-text input and never converts encrypted input", async () => {
    const noText = await pdfToMarkdown("scan.pdf", createSimplePdf([""]));
    expect(noText).toMatchObject({ status: "no-text", markdown: "", pages: [], ocrHandoff: { available: false, backlogTicket: 247 } });
    const protectedResult = await pdfToMarkdown("private.pdf", encrypted(createSimplePdf(["secret"])));
    expect(protectedResult).toMatchObject({ status: "encrypted", markdown: "", pages: [] });
  });

  it("module keeps the source filename for deterministic .md download naming", async () => {
    const result = await markdownModule.run({ file: file(createSimplePdf(["hello"]), "My Report.pdf") }, { defaults: {} }) as { filename: string; status: string; markdown: string };
    expect(result).toMatchObject({ filename: "My Report.pdf", status: "converted" });
    expect(result.markdown).toContain("My%20Report.pdf");
  });
});
