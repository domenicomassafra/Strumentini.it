import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createSimplePdf } from "../src/engines/pdf/writer";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { OUTPUT_FACTS_338_LIMITS, readOutputFacts338 } from "../src/runtime/output-facts-338";

function artifact(bytes: Uint8Array, name = "generated.pdf", mime = "application/pdf", kind: "pdf" | "file" = "pdf"): OutputArtifactDescriptor {
  return createOutputArtifactDescriptor({
    kind, name, mime, bytes,
    verification: { state: "verified", verifiedMime: mime, method: "already independently reopened" },
    fidelity: "structural", fidelityNote: "Test artifact from local producer",
  });
}

const pdfBytes = (): Uint8Array => createSimplePdf(["CONSUMER408 real PDF generated"]);

describe("#338 output facts strictly derived from produced bytes", () => {
  it("reopens real PDF producer bytes to report pages, version, and exact byte count only", () => {
    const source = artifact(pdfBytes());
    const result = readOutputFacts338(source);
    expect(result).toMatchObject({
      state: "available", format: "pdf", filename: "generated.pdf", byteLength: source.bytes.byteLength,
      pdf: { pageCount: 1 }, source: "actual-output-bytes",
    });
    if (result.state !== "available" || result.format !== "pdf") throw new Error("Unexpected facts state");
    expect(result.pdf.version).toMatch(/^1\.[0-7]$|^2\.0$/u);
    expect(result.pdf.firstPage).toBeDefined();
    expect(result.pdf.firstPage?.width).toBeGreaterThan(0);
    expect(result.pdf.firstPage?.height).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("savedBytes");
    expect(JSON.stringify(result)).not.toContain("confidence");
    expect(readOutputFacts338(source)).toEqual(result);
  });

  it("refuses unverified, unsupported, MIME mismatch and malformed bytes without changing source download or content", () => {
    const source = artifact(pdfBytes());
    const original = source.bytes.slice();
    const rejected = [
      { ...source, verification: { state: "warning", verifiedMime: "application/pdf" } },
      { ...source, download: { ...source.download, ready: false } },
      { ...source, mime: "image/png" },
      { ...source, bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]) },
      { ...source, bytes: new Uint8Array(0) },
      { ...source, byteLength: OUTPUT_FACTS_338_LIMITS.maxOutputBytes + 1 },
    ] as OutputArtifactDescriptor[];
    for (const item of rejected) {
      const before = item.bytes.slice();
      const result = readOutputFacts338(item);
      expect(result.state).toBe("unavailable");
      expect(item.bytes).toEqual(before);
    }
    expect(source.bytes).toEqual(original);
    expect(source.download.ready).toBe(true);
  });

  it("refuses truncated and forged PDF rather than guessing page count from result metadata", () => {
    const source = pdfBytes();
    const broken = source.slice(0, source.length - 16);
    expect(readOutputFacts338(artifact(broken))).toMatchObject({ state: "unavailable", reason: "MALFORMED" });
    const altered = source.slice();
    altered.set(new TextEncoder().encode("XXXX"), 0);
    expect(readOutputFacts338(artifact(altered))).toMatchObject({ state: "unavailable", reason: "MALFORMED" });
    const polyglot = new Uint8Array([...source, 0x50, 0x4b, 3, 4]);
    expect(readOutputFacts338(artifact(polyglot))).toMatchObject({ state: "unavailable", reason: "MALFORMED" });
  });

  it("isolates every exception in the preview and never modifies a prior result", () => {
    const source = artifact(pdfBytes());
    const valid = readOutputFacts338(source);
    const corrupt = artifact(new Uint8Array([1, 2, 3]));
    expect(readOutputFacts338(corrupt)).toMatchObject({ state: "unavailable" });
    expect(readOutputFacts338(source)).toEqual(valid);
    expect(corrupt.download.ready).toBe(true); // Preview failure must not flip producer's earlier verification.
  });

  it("never reads arbitrary artifact sizes beyond its explicit 4MiB preview budget", () => {
    const oversize = new Uint8Array(OUTPUT_FACTS_338_LIMITS.maxOutputBytes + 1);
    oversize.set(pdfBytes().subarray(0, 8));
    expect(readOutputFacts338(artifact(oversize))).toMatchObject({ state: "unavailable", reason: "TOO_LARGE" });
  });

  it("supports bounded PNG dimensions only from a structurally well-formed output, not labels", async () => {
    const { generateOutputSamples408, verifyOutputConsumer408 } = await import("../scripts/verify-output-consumers-408");
    const samples = await generateOutputSamples408();
    const producedPdf = samples.find((sample) => sample.format === "pdf");
    if (!producedPdf) throw Error("#408 PDF producer missing");
    expect(await verifyOutputConsumer408(producedPdf)).toMatchObject({ status: "PASS", facts: { pages: 1 } });
    expect(readOutputFacts338(artifact(producedPdf.bytes, producedPdf.filename, producedPdf.mime))).toMatchObject({
      state: "available", format: "pdf", pdf: { pageCount: 1 }, byteLength: producedPdf.bytes.byteLength,
    });
    const png = samples.find((sample) => sample.format === "png");
    if (!png) throw Error("#408 PNG producer missing");
    const oracle = await verifyOutputConsumer408(png);
    expect(oracle).toMatchObject({ status: "PASS", facts: { width: 32, height: 24 } });
    const a = artifact(png.bytes, png.filename, png.mime, "file");
    expect(readOutputFacts338(a)).toMatchObject({ state: "available", format: "png", png: { width: 32, height: 24 } });
    const corrupt = png.bytes.slice();
    corrupt[corrupt.length - 1] = (corrupt[corrupt.length - 1] ?? 0) ^ 1;
    expect(readOutputFacts338(artifact(corrupt, png.filename, png.mime, "file"))).toMatchObject({ state: "unavailable", reason: "MALFORMED" });
    const truncated = png.bytes.slice(0, png.bytes.length - 5);
    expect(readOutputFacts338(artifact(truncated, png.filename, png.mime, "file"))).toMatchObject({ state: "unavailable", reason: "MALFORMED" });
  }, 30_000);

  it("reopens real CSV bytes for bounded structural facts and rejects malformed rows", () => {
    const csv = new TextEncoder().encode("name,value\nalpha,1\nbeta,2\n");
    const source = createOutputArtifactDescriptor({
      kind: "structured",
      name: "result.csv",
      mime: "text/csv",
      bytes: csv,
      verification: { state: "verified", verifiedMime: "text/csv", method: "CSV fixture reopened" },
      fidelity: "structural",
      fidelityNote: "CSV test artifact",
    });
    const facts = readOutputFacts338(source);
    expect(facts).toMatchObject({
      state: "available",
      format: "csv",
      source: "actual-output-bytes",
      csv: { columns: 2, rows: 2, header: ["name", "value"] },
      byteLength: csv.byteLength,
    });
    const malformed = new TextEncoder().encode("name,value\nalpha,1,extra\n");
    expect(readOutputFacts338(createOutputArtifactDescriptor({
      kind: "structured",
      name: "bad.csv",
      mime: "text/csv",
      bytes: malformed,
      verification: { state: "verified", verifiedMime: "text/csv", method: "CSV fixture reopened" },
      fidelity: "structural",
      fidelityNote: "CSV test artifact",
    }))).toMatchObject({
      state: "unavailable",
      reason: "MALFORMED",
    });
  });

  it("counts quoted RFC4180 CSV cells/rows from real bytes without splitting commas or quoted newlines", () => {
    const fact = (value: string) => readOutputFacts338(createOutputArtifactDescriptor({
      kind: "structured", name: "quoted.csv", mime: "text/csv",
      bytes: new TextEncoder().encode(value),
      verification: { state: "verified", verifiedMime: "text/csv", method: "source fixture" },
      fidelity: "structural", fidelityNote: "No semantic guarantee",
    }));
    expect(fact('"name, display",value\r\n"first\nlast",42\r\n')).toMatchObject({
      state: "available", format: "csv", csv: { columns: 2, rows: 1, header: ["name, display", "value"] },
    });
    expect(fact('"name ""quoted""",value\n"a,b",2\n')).toMatchObject({
      state: "available", format: "csv", csv: { columns: 2, rows: 1, header: ['name "quoted"', "value"] },
    });
    for (const malformed of [
      'name,value\n"unterminated,2',
      'name,value\n"ok"junk,2',
      'name,value\nbad"quote,2',
      'name,value\nonly-one-field',
      'name,value\n1,2,extra',
      'name,value\n1,\u0000',
      'name,value\n1,2\n\n',
    ]) {
      expect(fact(malformed)).toMatchObject({ state: "unavailable", reason: "MALFORMED" });
    }
    const oversizeRows = "name,value\n" + "a,1\n".repeat(OUTPUT_FACTS_338_LIMITS.maxCsvRows + 1);
    expect(fact(oversizeRows)).toMatchObject({ state: "unavailable", reason: "MALFORMED" });
  });

  it("places semantic PDF preview after the existing verified-result/download control and keeps fallback visible", () => {
    const component = readFileSync(new URL("../src/components/tools/pdf/PdfTool.tsx", import.meta.url), "utf8");
    expect(component).toContain('data-output-facts-338');
    expect(component).toContain('readOutputFacts338(artifact)');
    expect(component).toContain('Anteprima non disponibile');
    expect(component).toContain('La disponibilità del download viene valutata separatamente');
    expect(component.indexOf('<PdfResultV2')).toBeLessThan(component.indexOf('data-output-facts-338'));
    expect(component).not.toContain('setResult(readOutputFacts338');
  });
});
