import { describe, expect, it } from "vitest";
import { isBoundedCsvCandidate335 } from "../src/runtime/csv-candidate-335";
import { detectLocalFile, type LocalFileSource } from "../src/runtime/file-detection";

const bytes = (text: string) => new TextEncoder().encode(text);
const source = (text: string, name = "input.csv", type = "text/csv"): LocalFileSource => {
  const content = bytes(text);
  return {
    name, type, size: content.byteLength,
    slice: (start = 0, end = content.byteLength) => new Blob([content.subarray(start, end)]),
  };
};

describe("#335 CSV structural candidates are bounded and fail closed", () => {
  it("recognizes complete strict UTF-8 tables with quoted commas, escaped quotes and multiline cells", async () => {
    const value = 'name,value\r\n"first, last","a ""quoted""\nline"\r\nother,2\r\n';
    expect(isBoundedCsvCandidate335(bytes(value))).toBe(true);
    expect(await detectLocalFile(source(value))).toMatchObject({
      status: "supported", format: "csv", mime: "text/csv",
    });
  });

  it.each([
    ["prose", "Just plain prose without a comma"],
    ["single-field", "x\ny\n"],
    ["ragged", "a,b\n1,2,3\n"],
    ["dangling-quote", 'a,b\n"abc,2\n'],
    ["mixed-quote", 'a,b\n"one"extra,2\n'],
    ["one-row", "a,b\n"],
    ["nul", "a,b\n1,\u0000\n"],
  ])("rejects %s", async (_case, input) => {
    expect(isBoundedCsvCandidate335(bytes(input))).toBe(false);
    expect(await detectLocalFile(source(input))).toMatchObject({ status: "refused", reason: "MALFORMED" });
  });

  it("rejects spoofed suffix/MIME, non-UTF8 content and over-budget reads", async () => {
    const legitimate = "name,value\none,1\n";
    expect(await detectLocalFile(source(legitimate, "readme.txt"))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    expect(await detectLocalFile(source(legitimate, "readme.csv", "image/png"))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    const invalid = new Uint8Array([0xff,0xfe,0x2c,0x0a,0x31,0x2c,0x32]);
    expect(isBoundedCsvCandidate335(invalid)).toBe(false);
    const oversized = "a,b\n" + "x,y\n".repeat(70_000);
    expect(await detectLocalFile(source(oversized))).toMatchObject({ status: "refused", reason: "TOO_LARGE" });
  });
});
