import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import receipt from "../quality/reference-data/ocr/246-local-assets-evidence.json";

const root = resolve(import.meta.dirname, "..");

describe("#246 exact same-origin OCR donor distribution and licensing", () => {
  it("verifies every byte hash of local model, workers, LSTM cores and bundled notices", async () => {
    let total = 0;
    for (const item of receipt.artifacts) {
      expect(item.path.startsWith("public/ocr-246/")).toBe(true);
      const bytes = await readFile(resolve(root, item.path));
      expect(bytes.length).toBe(item.bytes);
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(item.sha256);
      total += bytes.length;
    }
    expect(total).toBe(receipt.staticAssetsBytes);
    expect(receipt.staticAssetsBytes).toBe(27_421_073);
    expect(receipt.artifacts.find((item) => item.path.endsWith("ita.traineddata.gz"))).toMatchObject({
      bytes: 6_933_830,
      sha256: "sha256:21c1bfde62571d76b923e270bb2cde583ccc18fa8bfd83454c021b28d8b5cb5a",
    });
    for (const flavor of ["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"]) {
      expect(receipt.artifacts.some((item) => item.path.endsWith(`${flavor}.wasm.js`))).toBe(true);
      expect(receipt.artifacts.some((item) => item.path.endsWith(`${flavor}.wasm`))).toBe(true);
    }
  });

  it("pins permissive upstream donor licenses and avoids fake full-production certification", () => {
    expect(receipt.licensePolicy["tesseract.js@7.0.0"]).toBe("Apache-2.0");
    expect(receipt.licensePolicy["tesseract.js-core@7.0.0"]).toBe("Apache-2.0");
    expect(receipt.licensePolicy["@tesseract.js-data/ita@1.0.0"]).toMatch(/^MIT /u);
    expect(receipt.productionGate).toBe("BLOCKED_BY_271");
    expect(receipt.browserObserved.textMatchedExactly).toBe(true);
    expect(receipt.browserObserved.mobilePhysicalIOSAndroid).toBe("NOT_TESTED");
  });
});
