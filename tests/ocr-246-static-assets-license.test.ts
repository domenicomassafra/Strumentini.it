import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import receipt from "../quality/reference-data/ocr/246-local-assets-evidence.json";

const root = resolve(import.meta.dirname, "..");

describe("#246 exact same-origin OCR donor distribution and licensing", () => {
  it("verifies every byte hash of local model, workers, LSTM cores and bundled notices", async () => {
    let total = 0;
    for (const item of receipt.artifacts) {
      expect(item.path.startsWith("public/ocr-246/")).toBe(true);
      // Historical #246 receipt includes an unattributed MIT template which
      // STR-366 removed from the actual public distribution. Keep the old
      // receipt immutable; its exact missing artifact is a deliberate change.
      if (item.path === "public/ocr-246/lang/NPM-PACKAGE-MIT.LICENSE") {
        expect(existsSync(resolve(root, item.path))).toBe(false);
        continue;
      }
      const bytes = await readFile(resolve(root, item.path));
      expect(bytes.length).toBe(item.bytes);
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(item.sha256);
      total += bytes.length;
    }
    const obsoleteMitBytes = receipt.artifacts.find((item) =>
      item.path === "public/ocr-246/lang/NPM-PACKAGE-MIT.LICENSE")?.bytes;
    expect(obsoleteMitBytes).toBe(1_078);
    expect(total).toBe(receipt.staticAssetsBytes - obsoleteMitBytes!);
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
    // A historical npm metadata claim does not authorize the model. The
    // original tessdata Apache license is shipped and verified by #366.
    expect(receipt.licensePolicy["@tesseract.js-data/ita@1.0.0"]).toMatch(/Apache-2\.0/u);
    expect(receipt.productionGate).toBe("BLOCKED_BY_271");
    expect(receipt.browserObserved.textMatchedExactly).toBe(true);
    expect(receipt.browserObserved.mobilePhysicalIOSAndroid).toBe("NOT_TESTED");
  });
});
