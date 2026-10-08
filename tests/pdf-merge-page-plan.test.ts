import { describe, expect, it } from "vitest";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { defaultPdfMergePagePlan, movePdfMergePage, validatePdfMergePagePlan } from "../src/engines/pdf/merge-page-plan";
import merge from "../src/tools/pdf-merge/module";

function sample(texts: string[], filename: string): File {
  return new File([new Uint8Array(createSimplePdf(texts))], filename, { type: "application/pdf" });
}

describe("ticket 52 — mixed source PDF page plan", () => {
  const files = [sample(["A1", "A2", "A3"], "a.pdf"), sample(["B1", "B2"], "b.pdf")];

  it("maintains stable, bounded source/file page identities", () => {
    const initial = defaultPdfMergePagePlan([3, 2]);
    expect(initial).toEqual([{ fileIndex: 0, page: 1 }, { fileIndex: 0, page: 2 }, { fileIndex: 0, page: 3 }, { fileIndex: 1, page: 1 }, { fileIndex: 1, page: 2 }]);
    expect(movePdfMergePage(initial, "1:2", "0:2").map(({ fileIndex, page }) => `${fileIndex}:${page}`)).toEqual(["0:1", "1:2", "0:2", "0:3", "1:1"]);
    expect(initial[4]).toEqual({ fileIndex: 1, page: 2 });
  });

  it("allows cross-file page interleaving, per-page rotation and exclusion with output reparse", async () => {
    const plan = [
      { fileIndex: 1, page: 2, rotation: 90 },
      { fileIndex: 0, page: 3 },
      { fileIndex: 1, page: 1, rotation: 180 },
      { fileIndex: 0, page: 1 },
    ];
    const result = await merge.run({ files, pagePlan: plan }, { defaults: {} }) as Record<string, unknown>;
    expect(result.verifiedOutputPageCount).toBe(4);
    expect(result.sourcePageCount).toBe(5);
    expect(result.removedPages).toBe(1);
    const bytes = (result.artifacts as Array<{ bytes: Uint8Array }>)[0]!.bytes;
    const inspection = inspectPdfBytes(bytes);
    expect(inspection.pageCount).toBe(4);
    expect(inspection.pages.map((page) => page.rotation)).toEqual([90, 0, 180, 0]);
    expect((await extractPdfText(bytes)).map((page) => page.text)).toEqual(["B2", "A3", "B1", "A1"]);
  });

  it("keeps old whole-file merge behavior when no page plan is supplied", async () => {
    const result = await merge.run({ files }, { defaults: {} }) as Record<string, unknown>;
    const bytes = (result.artifacts as Array<{ bytes: Uint8Array }>)[0]!.bytes;
    expect((await extractPdfText(bytes)).map((page) => page.text)).toEqual(["A1", "A2", "A3", "B1", "B2"]);
    expect(result.removedPages).toBeUndefined();
  });

  it("refuses forged, stale, duplicate and oversized plans without output", async () => {
    for (const plan of [
      [], [{ fileIndex: 3, page: 1 }],
      [{ fileIndex: 0, page: 4 }],
      [{ fileIndex: 0, page: 1 }, { fileIndex: 0, page: 1 }],
      [{ fileIndex: 0, page: 2, rotation: 45 }],
      [{ fileIndex: "1", page: 1 }],
      [{ fileIndex: 1, page: 0 }],
      [{ fileIndex: 1, page: 1, rotation: "90" }],
      Array.from({ length: 201 }, (_, page) => ({ fileIndex: 0, page })),
    ]) {
      expect(() => validatePdfMergePagePlan([3, 2], plan)).toThrow();
      await expect(merge.run({ files, pagePlan: plan }, { defaults: {} })).rejects.toThrow();
    }
  });
});
