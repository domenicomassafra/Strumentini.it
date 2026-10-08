import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import splitModule from "../src/tools/pdf-split/module";
import selectModule from "../src/tools/pdf-page-delete-extract/module";
import type { ToolModule } from "../src/runtime/types";

const doc = (texts: string[]) => new File([new Uint8Array(createSimplePdf(texts))], "fixture.pdf", { type: "application/pdf" });
const run = (module: ToolModule, value: unknown) =>
  module.run(value, { defaults: {} }) as Promise<Record<string, unknown>>;

describe("ticket 217 — verified group split and page extraction", () => {
  it("creates exact page groups, a byte-verified multi-output ZIP and deterministic names", async () => {
    const result = await run(splitModule, { file: doc(["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"]), groups: "blocchi:2" });
    expect(result.groups).toEqual([[1, 2], [3, 4], [5]]);
    expect(result.sourcePageCount).toBe(5);
    expect(result.zipIncluded).toBe(true);
    expect(result.zipEntries).toBe(3);
    const outputs = result.artifacts as Array<{ bytes: Uint8Array; filename: string }>;
    expect(outputs.map(({ filename }) => filename)).toEqual(["fixture.pdf-part-01.pdf", "fixture.pdf-part-02.pdf", "fixture.pdf-part-03.pdf", "pdf-divisi.zip"]);
    const expanded = unzipSync(outputs[3]!.bytes);
    for (let index = 0; index < 3; index += 1) {
      const output = outputs[index]!;
      expect(expanded[output.filename]).toEqual(output.bytes);
      expect(inspectPdfBytes(output.bytes).pageCount).toBe(index < 2 ? 2 : 1);
    }
    expect((await extractPdfText(outputs[0]!.bytes)).map((page) => page.text)).toEqual(["FIRST", "SECOND"]);
    expect((await extractPdfText(outputs[2]!.bytes)).map((page) => page.text)).toEqual(["FIFTH"]);
  });
  it("keeps exact single-group output separate from ZIP and respects custom order", async () => {
    const result = await run(splitModule, { file: doc(["ONE", "TWO", "THREE"]), groups: "3,1" });
    expect(result.zipIncluded).toBe(false);
    const outputs = result.artifacts as Array<{ bytes: Uint8Array }>;
    expect(outputs).toHaveLength(1);
    expect((await extractPdfText(outputs[0]!.bytes)).map((page) => page.text)).toEqual(["THREE", "ONE"]);
  });
  it("extracts or deletes exactly the requested identities, including every nth page", async () => {
    const file = doc(["P1", "P2", "P3", "P4", "P5"]);
    const extracted = await run(selectModule, { file, pages: "ogni:2", mode: "extract" });
    expect(extracted.pages).toEqual([2, 4]);
    expect(extracted.verifiedOutputPageCount).toBe(2);
    expect((await extractPdfText((extracted.artifacts as Array<{ bytes: Uint8Array }>)[0]!.bytes)).map((page) => page.text)).toEqual(["P2", "P4"]);
    const deleted = await run(selectModule, { file, pages: "2,4", mode: "delete" });
    expect(deleted.verifiedOutputPageCount).toBe(3);
    expect((await extractPdfText((deleted.artifacts as Array<{ bytes: Uint8Array }>)[0]!.bytes)).map((page) => page.text)).toEqual(["P1", "P3", "P5"]);
  });
  it("rejects malformed or missing selections, out-of-range groups and delete-all", async () => {
    const file = doc(["P1", "P2", "P3"]);
    for (const groups of ["1;;2", "1-4", "x", "", [[1, 1]], [[4]]]) {
      await expect(run(splitModule, { file, groups }), String(groups)).rejects.toThrow();
    }
    for (const pages of ["1,1", "2-5", "bad", "", [1, 1], [0]]) {
      await expect(run(selectModule, { file, pages, mode: "extract" }), String(pages)).rejects.toThrow();
    }
    await expect(run(selectModule, { file, pages: "tutte", mode: "delete" })).rejects.toThrow();
  });
});
