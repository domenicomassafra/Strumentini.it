import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createSimplePdf, comparePdfs } from "../src/engines/pdf";
import { alignPdfEvidence, type PdfComparePageEvidence } from "../src/engines/pdf/compare-alignment";

const page = (text: string, index: number): PdfComparePageEvidence =>
  ({ page: index + 1, text, truncated: false, width: 200, height: 300, rotation: 0, imageCount: 0, annotationCount: 0 });
const align = (left: string[], right: string[]) =>
  alignPdfEvidence(left.map(page), right.map(page));
const blob = (text: string[]) => new Blob([new Uint8Array(createSimplePdf(text))], { type: "application/pdf" });

describe("PDF alignment does not confuse additions, content changes and moves", () => {
  it("recognizes insertion and deletion without claiming reorder", () => {
    const inserted = align(["A", "B", "C"], ["A", "X", "B", "C"]);
    expect(inserted.addedPages).toEqual([2]);
    expect(inserted.removedPages).toEqual([]);
    expect(inserted.reorderedPairs).toEqual([]);
    expect(inserted.unchangedPairs).toEqual([
      { firstPage: 1, secondPage: 1 }, { firstPage: 2, secondPage: 3 }, { firstPage: 3, secondPage: 4 },
    ]);
    const deleted = align(["A", "B", "C"], ["A", "C"]);
    expect(deleted.removedPages).toEqual([2]);
    expect(deleted.reorderedPairs).toEqual([]);
  });
  it("identifies unique reordered page and modified text independently", () => {
    const swapped = align(["A", "B", "C"], ["B", "A", "C"]);
    expect(swapped.reorderedPairs).toHaveLength(1);
    expect(swapped.addedPages).toEqual([]);
    expect(swapped.removedPages).toEqual([]);
    const edited = align(["A", "B", "C"], ["A", "B EDITED", "C"]);
    expect(edited.modifiedPairs).toEqual([{ firstPage: 2, secondPage: 2 }]);
  });
  it("does not assume empty-text or duplicated pages have reliable identity", () => {
    const blank = align(["", "A"], ["A", ""]);
    expect(blank.ambiguousEmptyText).toBe(true);
    const dupes = align(["A", "A", "B"], ["A", "B", "A"]);
    expect(dupes.reorderedPairs.length).toBeLessThanOrEqual(1);
  });
  it("never claims pixel identity without rendering even when text matches", async () => {
    const same = await comparePdfs(blob(["alpha", "beta"]), blob(["alpha", "beta"]));
    expect(same.alignment.entries.map((entry) => entry.kind)).toEqual(["unchanged", "unchanged"]);
    expect(same.visual).toMatchObject({ status: "not-rendered", confidence: "unknown" });
    expect(same.summary).toMatch(/NOT checked/u);
    const different = await comparePdfs(blob(["alpha", "beta"]), blob(["alpha", "changed"]));
    expect(different.alignment.modifiedPairs).toEqual([{ firstPage: 2, secondPage: 2 }]);
    expect(different.summary).toMatch(/differences found/u);
  });
  it("reports embedded-image changes separately from extractable text", async () => {
    const scanned = new Uint8Array(await readFile(new URL("../quality/fixtures/pdf-gold/jpeg-1page.pdf", import.meta.url)));
    const blank = createSimplePdf([""]);
    const withImage = await comparePdfs(
      new Blob([scanned.slice().buffer as ArrayBuffer]),
      new Blob([blank.slice().buffer as ArrayBuffer]),
    );
    expect(withImage.first.pages[0]?.imageCount).toBeGreaterThan(0);
    expect(withImage.second.pages[0]?.imageCount).toBe(0);
    expect(withImage.structure.status).toBe("changed");
    expect(withImage.structure.changedPairs).toEqual([{ firstPage: 1, secondPage: 1 }]);
    expect(withImage.visual.status).toBe("not-rendered");
  });
});
