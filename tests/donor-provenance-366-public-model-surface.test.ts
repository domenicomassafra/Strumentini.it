/** A public model or runtime binary must not escape #126's provenance gate. */
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditVendoredAssets366, VENDORED_DIRS_366 } from "../scripts/donor-provenance-366";

describe("#126 model and runtime public distribution boundary", () => {
  it("refuses newly distributed unpinned ONNX models and runtime binaries", () => {
    const root = mkdtempSync(join(tmpdir(), "str-126-public-assets-"));
    try {
      for (const dir of ["public/fonts", "public/ocr-246", "src/engines/video/vendor"]) {
        mkdirSync(join(root, dir), { recursive: true });
      }
      const before = auditVendoredAssets366(root, [], VENDORED_DIRS_366);
      expect(before.status).toBe("VERIFIED_METADATA");

      mkdirSync(join(root, "public/models/portrait-modnet"), { recursive: true });
      mkdirSync(join(root, "public/vendor/portrait-modnet"), { recursive: true });
      writeFileSync(join(root, "public/models/portrait-modnet/model_quantized.onnx"), "unreviewed weights");
      writeFileSync(join(root, "public/vendor/portrait-modnet/ort-wasm-simd-threaded.wasm"), "unreviewed runtime");
      const report = auditVendoredAssets366(root, [], VENDORED_DIRS_366);
      expect(report.status).toBe("NO_GO");
      expect(report.failures).toContain("UNPINNED_ASSET public/models/portrait-modnet/model_quantized.onnx");
      expect(report.failures).toContain("UNPINNED_ASSET public/vendor/portrait-modnet/ort-wasm-simd-threaded.wasm");

      const modelPath = "public/models/portrait-modnet/model_quantized.onnx";
      const fakePin = {
        path: modelPath,
        sha256: createHash("sha256").update("unreviewed weights").digest("hex"),
        license: "Apache-2.0",
        version: "1.0.0",
        source: "https://registry.npmjs.org/unrelated/-/unrelated-1.0.0.tgz",
      };
      const claimed = auditVendoredAssets366(root, [fakePin], VENDORED_DIRS_366);
      expect(claimed.status).toBe("NO_GO");
      expect(claimed.failures).toContain(`UNKNOWN_ASSET_SOURCE ${modelPath}`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
