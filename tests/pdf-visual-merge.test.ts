import { describe, expect, it } from "vitest";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import merge from "../src/tools/pdf-merge/module";

function asFile(pages: string[], name: string): File {
  return new File([new Uint8Array(createSimplePdf(pages))], name, { type: "application/pdf" });
}

describe("ticket 216 — visual mixed source merge contract", () => {
  it("produces exact source/page provenance and reopens the final merged PDF", async () => {
    const b = asFile(["BRAVO-1"], "bravo.pdf");
    const a = asFile(["ALFA-1", "ALFA-2"], "alfa.pdf");
    const result = await merge.run({ files: [b, a] }, { defaults: {} }) as Record<string, unknown>;
    expect(result.pageCount).toBe(3);
    expect(result.verifiedOutputPageCount).toBe(3);
    expect(result.sourcePageCount).toBe(3);
    expect(result.sources).toEqual([
      { name: "bravo.pdf", pageCount: 1, byteLength: b.size },
      { name: "alfa.pdf", pageCount: 2, byteLength: a.size },
    ]);
    expect(result.sourceBytes).toBe(a.size + b.size);
    const artifact = (result.artifacts as Array<{ bytes: Uint8Array }>)[0]!;
    expect(result.verifiedOutputBytes).toBe(artifact.bytes.length);
    expect(inspectPdfBytes(artifact.bytes).pageCount).toBe(3);
    const pages = await extractPdfText(artifact.bytes);
    expect(pages.map((page) => page.text)).toEqual(expect.arrayContaining(["BRAVO-1", "ALFA-1", "ALFA-2"]));
  });
  it("refuses unreadable source without claiming verified output", async () => {
    const invalid = new File([new TextEncoder().encode("%PDF-1.7\nno xref\n%%EOF")], "bad.pdf", { type: "application/pdf" });
    await expect(merge.run({ files: [asFile(["ok"], "ok.pdf"), invalid] }, { defaults: {} })).rejects.toThrow();
  });
});
