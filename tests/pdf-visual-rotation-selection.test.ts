import { describe, expect, it } from "vitest";
import { createSimplePdf, inspectPdfBytes } from "../src/engines/pdf";
import rotate from "../src/tools/pdf-rotate/module";

const file = new File([new Uint8Array(createSimplePdf(["a", "b", "c", "d"]))], "pages.pdf", { type: "application/pdf" });

describe("ticket 52 — rotation selection with strict range grammar", () => {
  it("rotates exactly the selected range and preserves other pages", async () => {
    const value = await rotate.run({ file, pages: "2-3", rotation: 90 }, { defaults: {} }) as {
      artifacts: Array<{ bytes: Uint8Array }>;
      rotations: Record<number, number>;
    };
    expect(value.rotations).toEqual({ 2: 90, 3: 90 });
    expect(inspectPdfBytes(value.artifacts[0]!.bytes).pages.map((page) => page.rotation)).toEqual([0, 90, 90, 0]);
  });
  it("refuses malformed selections or unsupported angles", async () => {
    for (const pages of ["1-9", "1,,2", "2-1", "not-a-page", ""]) {
      await expect(rotate.run({ file, pages, rotation: 90 }, { defaults: {} }), pages).rejects.toThrow();
    }
    await expect(rotate.run({ file, pages: "1", rotation: 45 }, { defaults: {} })).rejects.toThrow();
  });
});
