import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PDF_PRODUCTIVITY_ROUTES_33 } from "../src/components/tools/pdf/PdfProductivityRoutes33";
import { createSimplePdf, inspectPdfBytes, searchPdfTextAcrossFiles } from "../src/engines/pdf";
import { splitPdfBySize249, PdfSinglePageLimit249 } from "../src/engines/pdf/size-split-249";
import { planPdfNUp } from "../src/engines/pdf/n-up";
import { planBooklet251, planInterleave251 } from "../src/engines/pdf/booklet-interleave-251";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("#33 canonical PDF productivity family", () => {
  it("surfaces every accepted #56–58 direction on an actual canonical route, without a duplicate operation", () => {
    const ids = PDF_PRODUCTIVITY_ROUTES_33.map((route) => route.id);
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(ids.length);
    for (const route of PDF_PRODUCTIVITY_ROUTES_33) {
      expect(existsSync(resolve(root, "src/pages/tools", `${route.id}.astro`))).toBe(true);
      expect(existsSync(resolve(root, "src/tools", route.id, "manifest.ts"))).toBe(true);
      expect(route.note.trim()).not.toBe("");
    }
    expect(ids).toEqual(expect.arrayContaining([
      "pdf-multi-text-search", "pdf-split", "pdf-n-up", "pdf-booklet-interleave",
      "printable-pdf-from-text", "pdf-to-markdown", "pdf-tables-to-xlsx",
      "pdf-to-images", "images-to-pdf",
    ]));
    // Nothing advertises an unsupported full-fidelity Office exporter.
    expect(ids).not.toContain("docx-to-pdf");
    expect(ids).not.toContain("pdf-to-editable-powerpoint");
    expect(PDF_PRODUCTIVITY_ROUTES_33.find((route) => route.id === "pdf-to-images")?.note).toMatch(/non elementi modificabili/u);
    expect(PDF_PRODUCTIVITY_ROUTES_33.find((route) => route.id === "printable-pdf-from-text")?.note).toMatch(/non fedeltà Office/u);
  });

  it("keeps real multi-PDF file, page and context while separating encrypted and unreadable inputs", async () => {
    const good = createSimplePdf(["prima needle", "seconda needle"]);
    const encryptedText = new TextDecoder().decode(createSimplePdf(["private needle"]));
    const encrypted = new TextEncoder().encode(encryptedText.replace("/Root 1 0 R>>", "/Root 1 0 R /Encrypt 99 0 R>>"));
    const searched = await searchPdfTextAcrossFiles([
      { filename: "good.pdf", input: good },
      { filename: "locked.pdf", input: encrypted },
      { filename: "bad.pdf", input: new TextEncoder().encode("%PDF-1.7\nnot a PDF graph") },
    ], { query: "needle", contextCharacters: 8, maxResults: 10 });
    expect(searched.files.map((entry) => entry.status)).toEqual(["matches", "encrypted", "unreadable"]);
    expect(searched.matches.map((match) => [match.filename, match.page])).toEqual([["good.pdf", 1], ["good.pdf", 2]]);
    expect(searched.matches.every((match) => match.context.includes("needle"))).toBe(true);
  });

  it("builds actually measured PDF parts below the chosen limit or refuses an oversized single page", () => {
    const source = Uint8Array.from(readFileSync(resolve(root, "quality/fixtures/pdf-gold/simple-3page.pdf")));
    const split = splitPdfBySize249(source, 1024);
    expect(split.allSourcePagesCovered).toBe(true);
    expect(split.parts.flatMap((part) => part.pages)).toEqual([1, 2, 3]);
    for (const artifact of split.artifacts) {
      expect(artifact.bytes.length).toBeLessThanOrEqual(1024);
      expect(inspectPdfBytes(artifact.bytes).pageCount).toBeGreaterThan(0);
    }
    const largeImage = Uint8Array.from(readFileSync(resolve(root, "tests/fixtures/pdf-image-mixed-218/safe-mixed-218.pdf")));
    expect(() => splitPdfBySize249(largeImage, 1024)).toThrow(PdfSinglePageLimit249);
  });

  it("proves deterministic n-up, booklet and front/back page order with padding made explicit", () => {
    const nup = planPdfNUp(5, { mode: "4-up", paper: "a4", orientation: "landscape", margin: 20, gap: 10, order: "row-major" });
    expect(nup.sheets.flatMap((sheet) => sheet.cells.map((cell) => cell.sourcePage))).toEqual([1, 2, 3, 4, 5, null, null, null]);
    const booklet = planBooklet251(4, { flip: "short-edge", paper: "a4", margin: 18, gap: 10 });
    expect(booklet.faces.map((face) => [face.left, face.right])).toEqual([[4, 1], [2, 3]]);
    const interleave = planInterleave251(3, 3, { backOrder: "reverse", mismatchPolicy: "reject" });
    expect(interleave.pages.map((item) => [item.source, item.sourcePage])).toEqual([
      ["front", 1], ["back", 3], ["front", 2], ["back", 2], ["front", 3], ["back", 1],
    ]);
  });
});
