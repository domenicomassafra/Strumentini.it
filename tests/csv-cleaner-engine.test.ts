import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanCsvText, CsvCleanerError, normalizeRecordLineEndings, parseCsvText, provePapaAbort, readBlobText } from "../src/engines/table/csv";

const rfc = JSON.parse(readFileSync(new URL("../quality/fixtures/csv-rfc4180/vectors.json", import.meta.url), "utf8")) as { vectors:Array<{input:string;rows:string[][]}>; adversarial:Array<{input:string;expected:string}> };
const cleaning = JSON.parse(readFileSync(new URL("../quality/fixtures/csv-cleaning/vectors.json", import.meta.url), "utf8")) as { vectors:Array<Record<string,unknown>> };

describe("CSV cleaner engine", () => {
  it("matches RFC-style independent row vectors", () => { for (const vector of rfc.vectors) expect(parseCsvText(vector.input).rows).toEqual(vector.rows); });
  it("fails malformed quotes and warns instead of overwriting duplicate headers", () => {
    expect(() => parseCsvText(rfc.adversarial[0]!.input)).toThrow(CsvCleanerError);
    expect(parseCsvText(rfc.adversarial[1]!.input).warnings.some((warning) => warning.code === "DUPLICATE_HEADER")).toBe(true);
  });
  it("strips BOM and normalizes only record separators", () => {
    const vector = cleaning.vectors[0] as {input:string;expected:string}; expect(cleanCsvText(vector.input).output).toBe(vector.expected);
    const quoted = 'a,b\r\n1,"two\r\nlines"\r\n'; const normalized = normalizeRecordLineEndings(quoted); expect(normalized.output).toBe('a,b\n1,"two\r\nlines"\n'); expect(parseCsvText(normalized.output).rows).toEqual(parseCsvText(quoted).rows);
  });
  it("detects semicolon/tab and ragged rows", () => {
    expect(parseCsvText("a;b\n1;2\n").delimiter).toBe(";"); expect(parseCsvText("a\tb\n1\t2\n").delimiter).toBe("\t"); expect(parseCsvText("a,b\n1,2,3\n").warnings.some((warning)=>warning.code==="RAGGED_ROW")).toBe(true);
  });
  it("supports parser abort and cancellable Blob reads", async () => {
    const large = `a,b\n${Array.from({length:1000},(_,i)=>`${i},${i}`).join("\n")}`; expect(provePapaAbort(large, 10)).toBe(true);
    const controller = new AbortController(); controller.abort(); await expect(readBlobText(new Blob([large]), controller.signal)).rejects.toMatchObject({ code:"CANCELLED" });
  });
});
