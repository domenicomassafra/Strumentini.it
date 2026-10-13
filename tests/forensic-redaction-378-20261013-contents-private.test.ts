import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { pdfArray, pdfDict, pdfName, pdfNumber } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";
import { coveredRecoverableSource237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";
import { forensicRedactionGate378, type ForensicPlan378 } from "../scripts/forensic-redaction-378";

const source = coveredRecoverableSource237();
const plan: ForensicPlan378 = {
  sourceWitnesses: [PRIVATE_MARKER_237],
  pages: [{ page: 1, pageWidth: 20, pageHeight: 20, pixelWidth: 20, pixelHeight: 20,
    regions: [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }] }],
};
const privateBytes = "RECOVERABLE_DOCUMENT_PRIVATE_NOTE_378_193311";

function rasterOutput(options: { privateDictionary?: boolean; compressed?: boolean; trailing?: boolean } = {}) {
  const builder = new PdfBuilder();
  const pages = builder.reserve();
  const rgb = Buffer.alloc(20 * 20 * 3);
  for (let pixel = 200; pixel < 400; pixel++) rgb[pixel * 3] = 100;
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(20), Height: pdfNumber(20),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("FlateDecode"),
  }), bytes: new Uint8Array(deflateSync(rgb)) });
  const draw = Buffer.from("q\n20 0 0 20 0 0 cm\n/Im0 Do\nQ\n");
  let encoded = options.compressed ? deflateSync(draw) : draw;
  if (options.trailing) encoded = Buffer.concat([encoded, Buffer.from(privateBytes)]);
  const contents = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    ...(options.compressed ? { Filter: pdfName("FlateDecode") } : {}),
    ...(options.privateDictionary ? {
      Private: { kind: "literal" as const, value: `(${privateBytes})` },
      Author: { kind: "literal" as const, value: "(SECRET_PRIVATE_AUTHOR_378_342112)" },
    } : {}),
  }), bytes: new Uint8Array(encoded) });
  const page = builder.putAuto(pdfDict({ Type: pdfName("Page"), Parent: pages,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(20), pdfNumber(20)]),
    Resources: pdfDict({ XObject: pdfDict({ Im0: image }) }), Contents: contents }));
  builder.put(pages, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([page]), Count: pdfNumber(1) }));
  return builder.build(builder.putAuto(pdfDict({ Type: pdfName("Catalog"), Pages: pages })), null);
}

function inspect(output: Uint8Array) {
  const text = readFileSync(new URL("../scripts/forensic-redaction-378.ts", import.meta.url), "utf8");
  const inspector = text.match(/const PYTHON_INSPECTOR_378 = String.raw`([\s\S]*?)`;/u)?.[1];
  expect(inspector).toBeDefined();
  return spawnSync("python3", ["-c", inspector!], {
    input: JSON.stringify({ source: Buffer.from(source).toString("base64"),
      output: Buffer.from(output).toString("base64"), plan }),
    encoding: "utf8", timeout: 15_000, maxBuffer: 100_000,
  });
}

describe("#378 physical Contents bytes must be completely accounted for", () => {
  for (const [name, options] of [
    ["private dictionary fields", { privateDictionary: true }],
    ["plaintext after Flate EOS", { compressed: true, trailing: true }],
  ] as const) {
    it(`refuses ${name} in a real raster PDF`, () => {
      const output = rasterOutput(options);
      expect(Buffer.from(output).includes(Buffer.from(privateBytes))).toBe(true);
      const child = inspect(output);
      expect(child.error).toBeUndefined();
      expect(child.status, child.stderr).not.toBe(0);
      expect(child.stderr).toMatch(/pypdf-378:.*(?:Contents|page draw)/u);
      expect(child.stderr).not.toContain(PRIVATE_MARKER_237);
    }, 20_000);
  }
  it("keeps benign uncompressed and complete Flate drawing streams valid", () => {
    for (const compressed of [false, true]) {
      const output = rasterOutput({ compressed });
      const child = inspect(output);
      expect(child.status, child.stderr).toBe(0);
      if (process.platform === "darwin" && existsSync("/usr/bin/swift")) {
        expect(forensicRedactionGate378(source, output, plan).status)
          .toBe("INDEPENDENT_SAMPLE_PASS_NOT_RELEASE");
      }
    }
  }, 35_000);
});
