import { deflateSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { coveredRecoverableSource237, PRIVATE_MARKER_237, ORPHAN_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";
import { forensicRedactionGate378, type ForensicPlan378 } from "../scripts/forensic-redaction-378";

// Existing genuine, parsable source with visible covered text and an orphan
// marker. Only the #378 gate is under test: no #237 engine is changed.
const source = coveredRecoverableSource237();
// CI uses Linux runners, where macOS PDFKit cannot exist. Never pretend a
// platform-native independent renderer passed there: the two positive native
// receipts are explicitly NOT_RUN, while rejection/security tests still run.
const nativePdfKitAvailable378 = process.platform === "darwin" && existsSync("/usr/bin/swift");
const plan: ForensicPlan378 = {
  sourceWitnesses: [PRIVATE_MARKER_237, ORPHAN_MARKER_237],
  pages: [{
    page: 1, pageWidth: 20, pageHeight: 20, pixelWidth: 20, pixelHeight: 20,
    regions: [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }],
  }],
};

function actualImageOnlyPdf378(options: {
  orphan?: boolean; metadata?: boolean; blackPixelLeak?: boolean; hiddenContent?: boolean;
} = {}): Uint8Array {
  const rgb = new Uint8Array(20 * 20 * 3);
  for (let index = 200; index < 400; index += 1) {
    rgb[index * 3] = 35;
    rgb[index * 3 + 1] = 170;
    rgb[index * 3 + 2] = 120;
  }
  if (options.blackPixelLeak) rgb[22 * 3] = 180;
  const writer = new PdfBuilder();
  const pages = writer.reserve();
  const image = writer.putAuto({
    kind: "stream",
    dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(20), Height: pdfNumber(20),
      ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
    }),
    bytes: new Uint8Array(deflateSync(rgb)),
  });
  const contents = writer.putAuto({
    kind: "stream", dictionary: pdfDict({}),
    bytes: new TextEncoder().encode(options.hiddenContent
      ? "BT /F0 12 Tf (RECOVERABLE) Tj ET"
      : "q\n20 0 0 20 0 0 cm\n/Im0 Do\nQ\n"),
  });
  const page = writer.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(20), pdfNumber(20)]),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: contents,
  }));
  writer.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  const root = writer.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  if (options.orphan) {
    // An unreferenced, real xref object is invisible in the rendered page and
    // most page-only traversals. The gate must still reject recoverable bytes.
    writer.putAuto({
      kind: "stream", dictionary: pdfDict({}),
      bytes: new TextEncoder().encode("ORPHAN_NEW_UNREFERENCED_SECRET_378"),
    });
  }
  const info = options.metadata
    ? writer.putAuto(pdfDict({ Author: { kind: "literal", value: "PRIVATE_EMBEDDED_AUTHOR_378" } }))
    : null;
  return writer.build(root, info);
}

describe("#378 independent forensic output gate, not the #237 internal verifier", () => {
  it.skipIf(!nativePdfKitAvailable378)("independently reads a real raster-only export with pypdf and native PDFKit black pixels", () => {
    const output = actualImageOnlyPdf378();
    expect(output.length).toBeGreaterThan(100);
    expect(Buffer.from(source).includes(Buffer.from(PRIVATE_MARKER_237))).toBe(true);
    expect(Buffer.from(source).includes(Buffer.from(ORPHAN_MARKER_237))).toBe(true);
    const receipt = forensicRedactionGate378(source, output, plan);
    expect(receipt).toEqual({
      status: "INDEPENDENT_SAMPLE_PASS_NOT_RELEASE",
      pages: 1, blackPixels: 200, outputBytes: output.length, witnessesChecked: 2,
      parsers: ["pypdf-strict", "macOS-PDFKit"],
    });
  }, 30_000);

  it("refuses a real xref-indexed orphan stream invisible to copied page text and black pixel tests", () => {
    const output = actualImageOnlyPdf378({ orphan: true });
    // The payload is outside all page-contents and all XObject pixel streams.
    expect(Buffer.from(output).includes(Buffer.from("ORPHAN_NEW_UNREFERENCED_SECRET_378"))).toBe(true);
    expect(() => forensicRedactionGate378(source, output, plan))
      .toThrow(/FORENSIC_378_REFUSED.*(?:orphan|unreachable|xref)/iu);
  });

  it("refuses recovered Info metadata even when image redaction pixels are all black", () => {
    const output = actualImageOnlyPdf378({ metadata: true });
    expect(() => forensicRedactionGate378(source, output, plan))
      .toThrow(/FORENSIC_378_REFUSED/u);
  });

  it("refuses one recoverable pixel and hidden content operators", () => {
    expect(() => forensicRedactionGate378(source, actualImageOnlyPdf378({ blackPixelLeak: true }), plan))
      .toThrow(/FORENSIC_378_REFUSED/u);
    expect(() => forensicRedactionGate378(source, actualImageOnlyPdf378({ hiddenContent: true }), plan))
      .toThrow(/FORENSIC_378_REFUSED/u);
  });

  it("fails closed on missing independent pypdf or native PDFKit, not a degraded PASS", () => {
    const output = actualImageOnlyPdf378();
    expect(() => forensicRedactionGate378(source, output, plan, { python: "/no-such-python-378" }))
      .toThrow(/FORENSIC_378_REFUSED.*parser/u);
    expect(() => forensicRedactionGate378(source, output, plan, { swift: "/no-such-swift-378" }))
      .toThrow(/FORENSIC_378_REFUSED.*renderer/u);
  }, 30_000);

  it.skipIf(!nativePdfKitAvailable378)("runs the standalone local CLI on real PDF bytes, with a machine-readable limited receipt", () => {
    const dir = mkdtempSync(join(tmpdir(), "forensic378-test-"));
    try {
      const sourcePath = join(dir, "source.pdf");
      const outputPath = join(dir, "output.pdf");
      const planPath = join(dir, "plan.json");
      writeFileSync(sourcePath, source);
      writeFileSync(outputPath, actualImageOnlyPdf378());
      writeFileSync(planPath, JSON.stringify(plan));
      const run = spawnSync(process.execPath, [
        "--import", "tsx", "scripts/forensic-redaction-378.ts",
        "--source", sourcePath, "--output", outputPath, "--plan", planPath,
      ], { encoding: "utf8", timeout: 30_000, maxBuffer: 100_000 });
      expect(run.error).toBeUndefined();
      expect(run.status, run.stderr).toBe(0);
      const receipt = JSON.parse(run.stdout) as { status: string; blackPixels: number };
      expect(receipt.status).toBe("INDEPENDENT_SAMPLE_PASS_NOT_RELEASE");
      expect(receipt.blackPixels).toBe(200);
      expect(run.stdout).not.toContain(PRIVATE_MARKER_237);
      expect(run.stdout).not.toContain(ORPHAN_MARKER_237);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 35_000);

  it("refuses source witness not in real source, invalid/missing masks, and bytes appended after EOF", () => {
    const output = actualImageOnlyPdf378();
    expect(() => forensicRedactionGate378(source, output, {
      ...plan, sourceWitnesses: ["SOURCE_WITNESS_IS_NOT_HERE_378"],
    })).toThrow(/FORENSIC_378_REFUSED/u);
    expect(() => forensicRedactionGate378(source, output, { ...plan, pages: [{ ...plan.pages[0]!, regions: [] }] }))
      .toThrow(/FORENSIC_378_REFUSED/u);
    const tail = new Uint8Array([...output, ...new TextEncoder().encode("SECRET_AFTER_EOF_378")]);
    expect(() => forensicRedactionGate378(source, tail, plan)).toThrow(/FORENSIC_378_REFUSED/u);
  });
});
