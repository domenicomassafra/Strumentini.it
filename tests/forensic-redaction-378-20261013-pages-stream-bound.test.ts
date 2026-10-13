import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";
import { forensicRedactionGate378, type ForensicPlan378 } from "../scripts/forensic-redaction-378";

const originalSource = coveredRecoverableSource237();
const privatePagesString = "PRIVATE_UNCHECKED_PAGES_DICTIONARY_378_747474";
const nativePDFKit = process.platform === "darwin" && existsSync("/usr/bin/swift");
const plan: ForensicPlan378 = {
  sourceWitnesses: [PRIVATE_MARKER_237],
  pages: [{
    page: 1, pageWidth: 20, pageHeight: 20, pixelWidth: 20, pixelHeight: 20,
    regions: [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }],
  }],
};

function rasterOutput(options: { privatePages?: boolean; inflatedBytes?: number } = {}): Uint8Array {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const rgb = Buffer.alloc(options.inflatedBytes ?? 20 * 20 * 3);
  if (!options.inflatedBytes) for (let pixel = 200; pixel < 400; pixel++) rgb[pixel * 3] = 100;
  const image = builder.putAuto({
    kind: "stream",
    dictionary: pdfDict({
      Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(20), Height: pdfNumber(20),
      ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
    }),
    bytes: new Uint8Array(deflateSync(rgb, { level: options.inflatedBytes ? 1 : 6 })),
  });
  const contents = builder.putAuto({
    kind: "stream", dictionary: pdfDict({}),
    bytes: new TextEncoder().encode("q\n20 0 0 20 0 0 cm\n/Im0 Do\nQ\n"),
  });
  const page = builder.putAuto(pdfDict({
    Type: pdfName("Page"), Parent: pages, MediaBox: pdfArray([
      pdfNumber(0), pdfNumber(0), pdfNumber(20), pdfNumber(20),
    ]),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: contents,
  }));
  builder.put(pages, pdfDict({
    Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1),
    ...(options.privatePages ? { Private: { kind: "literal" as const, value: `(${privatePagesString})` } } : {}),
  }));
  const root = builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages }));
  return builder.build(root, null);
}

/** Exercise the same standalone Python inspector, with no source or PDF files on disk. */
function pythonInspector(output: Uint8Array, memoryBudgetMiB?: number) {
  const sourceText = readFileSync(new URL("../scripts/forensic-redaction-378.ts", import.meta.url), "utf8");
  const embedded = sourceText.match(/const PYTHON_INSPECTOR_378 = String.raw`([\s\S]*?)`;/u)?.[1];
  expect(embedded).toBeDefined();
  // On Linux RLIMIT_AS provides a 512 MiB hard virtual-memory failsafe
  // (virtual mappings are larger than RSS); on both platforms the 90 MiB
  // actual peak RSS budget is independently asserted below. macOS rejects
  // RLIMIT_AS updates on this host.
  const actualInspector = memoryBudgetMiB && process.platform !== "darwin"
    ? embedded!.replace(
      "        decompressor=zlib.decompressobj()",
      `        import resource
        resource.setrlimit(resource.RLIMIT_AS,(512*1024*1024,)*2)
        decompressor=zlib.decompressobj()`,
    )
    : embedded!;
  expect(actualInspector).toContain("        decompressor=zlib.decompressobj()");
  const trampoline = String.raw`
import sys
if len(sys.argv)>2:
    import atexit, resource
    atexit.register(lambda: print("FORENSIC_TEST_PEAK_RSS="+str(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss),file=sys.stderr))
exec(compile(sys.argv[1],"<actual-forensic-378-inspector>","exec"))
`;
  const input = Buffer.from(JSON.stringify({
    source: Buffer.from(originalSource).toString("base64"),
    output: Buffer.from(output).toString("base64"),
    plan,
  }));
  return spawnSync("python3",
    ["-c", trampoline, actualInspector, ...(memoryBudgetMiB ? [String(memoryBudgetMiB)] : [])],
    { input, encoding: "utf8", timeout: 15_000, maxBuffer: 100_000 },
  );
}

describe("#378 independent physical PDF acceptance: page tree and bounded Flate", () => {
  it("rejects physical private bytes in a reachable /Pages dictionary even if both PDF viewers accept", () => {
    const baseline = rasterOutput();
    const contaminated = rasterOutput({ privatePages: true });
    expect(Buffer.from(contaminated).includes(Buffer.from(privatePagesString))).toBe(true);
    const original = pythonInspector(baseline);
    expect(original.status, original.stderr).toBe(0);
    const adversarial = pythonInspector(contaminated);
    expect(adversarial.status).not.toBe(0);
    expect(adversarial.stderr).toMatch(/pypdf-378:.*(?:page tree|Pages|unexpected)/iu);
    expect(adversarial.stderr).not.toContain(PRIVATE_MARKER_237);
    if (nativePDFKit) {
      expect(forensicRedactionGate378(originalSource, baseline, plan).status)
        .toBe("INDEPENDENT_SAMPLE_PASS_NOT_RELEASE");
      expect(() => forensicRedactionGate378(originalSource, contaminated, plan))
        .toThrow(/FORENSIC_378_REFUSED/u);
    }
  }, 35_000);

  it("refuses an 80 MiB Flate expansion within a 90 MiB Python memory budget", () => {
    const inflatedBytes = 80 * 1024 * 1024;
    const hostile = rasterOutput({ inflatedBytes });
    expect(hostile.length).toBeLessThan(512_000);
    const child = pythonInspector(hostile, 90);
    expect(child.error?.message).toBeUndefined();
    expect(child.status).not.toBe(0);
    expect(child.stderr).toMatch(/pypdf-378: trailing\/unconsumed\/oversize private image stream data/u);
    expect(child.stderr).not.toMatch(/MemoryError|cannot allocate|bad_alloc/iu);
    const peak = Number(child.stderr.match(/FORENSIC_TEST_PEAK_RSS=(\d+)/u)?.[1]);
    expect(Number.isFinite(peak)).toBe(true);
    const peakBytes = process.platform === "darwin" ? peak : peak * 1024;
    expect(peakBytes).toBeLessThan(90 * 1024 * 1024);
  }, 25_000);

});
