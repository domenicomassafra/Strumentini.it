import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { OCR_ENGLISH_ASSETS_395, recognizeLocalOcr395 } from "../src/engines/ocr/language-395";

const root = resolve(import.meta.dirname, "..");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("STR-395 pinned English OCR model and labeled scans", () => {
  it("ships exact upstream ENG bytes and a copy of tessdata's Apache-2.0 notice", () => {
    expect(OCR_ENGLISH_ASSETS_395.modelUrl).toBe("/ocr-395/lang/eng.traineddata.gz");
    expect(OCR_ENGLISH_ASSETS_395.languageUrl).toBe("/ocr-395/lang");
    const zipped = readFileSync(resolve(root, "public/ocr-395/lang/eng.traineddata.gz"));
    expect(zipped.byteLength).toBe(10_923_060);
    expect(hash(zipped)).toBe(OCR_ENGLISH_ASSETS_395.sha256);
    const original = gunzipSync(zipped);
    expect(original.byteLength).toBe(23_466_654);
    expect(hash(original)).toBe("daa0c97d651c19fba3b25e81317cd697e9908c8208090c94c3905381c23fc047");
    const license = readFileSync(resolve(root, "public/ocr-395/lang/COPYING-tessdata-Apache-2.0.txt"), "utf8");
    expect(license).toMatch(/Apache License/u);
  });

  it("anchors each labeled English scan with unchanged image bytes", () => {
    const folder = "tests/fixtures/ocr-395/";
    const expected: Record<string, string> = {
      "invoice-en.png": "76a837a9afb4e7ef0312bdff33c1ea7175f2cae02d417143350bff09a57a685d",
      "invoice-en-rotated.png": "9ea6d40ba5e594b8e69a4b3fc1362b08f69f2f9d73b8994778f200c2c73c14a4",
      "invoice-en-low-contrast.png": "8bd4490ee27b7e678c36ce8722b1c105e0306435f706678514ed675ea0ecd431",
    };
    for (const [name, digest] of Object.entries(expected)) {
      expect(hash(readFileSync(resolve(root, folder, name)))).toBe(digest);
    }
    expect(readFileSync(resolve(root, folder, "invoice-en.txt"), "utf8").trim())
      .toBe("Invoice number 24680 - Total USD 123.45");
  });

  it("refuses a foreign language before loading a worker", async () => {
    await expect(recognizeLocalOcr395({} as File, "fra" as "eng"))
      .rejects.toThrow("OCR395_LANGUAGE_REFUSED");
  });
});
