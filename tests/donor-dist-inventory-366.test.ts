import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditDistributedAssets366 } from "../scripts/donor-dist-inventory-366";

const runtimeFiles = ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"];
const packageRow = {
  name: "onnxruntime-web", version: "1.31.0", license: "MIT",
  source: "https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.31.0.tgz",
  integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}`,
};

describe("#126 actual static distribution provenance", () => {
  it("verifies pinned public copies, npm-emitted runtime bytes and mapped transitive modules", () => {
    const root = mkdtempSync(join(tmpdir(), "str-126-distribution-"));
    try {
      mkdirSync(join(root, "dist/_astro"), { recursive: true });
      mkdirSync(join(root, "dist/models"), { recursive: true });
      mkdirSync(join(root, "dist/vendor/portrait-modnet"), { recursive: true });
      mkdirSync(join(root, "node_modules/onnxruntime-web/dist"), { recursive: true });
      for (const file of runtimeFiles) {
        writeFileSync(join(root, "node_modules/onnxruntime-web/dist", file), `upstream ${file}`);
        writeFileSync(join(root, "dist/vendor/portrait-modnet", file), `upstream ${file}`);
      }
      writeFileSync(join(root, "node_modules/onnxruntime-web/package.json"),
        JSON.stringify({ name: packageRow.name, version: packageRow.version, license: packageRow.license }));
      writeFileSync(join(root, "dist/models/model.onnx"), "pinned model");
      writeFileSync(join(root, "dist/_astro/tool.js"), "export {}");
      writeFileSync(join(root, "dist/_astro/tool.js.map"),
        JSON.stringify({ version: 3, sources: [
          "../../node_modules/onnxruntime-web/dist/main.js",
          "../../node_modules/onnxruntime-web/node_modules/onnxruntime-common/dist/index.js",
        ] }));
      const pins = [{
        path: "public/models/model.onnx",
        sha256: createHash("sha256").update("pinned model").digest("hex"),
        license: "Apache-2.0", version: "1.0.0", source: "https://example.org/model",
      }];
      const packages = [packageRow, { ...packageRow, name: "onnxruntime-common" }];
      const lock = {
        "node_modules/onnxruntime-web": {
          version: packageRow.version, license: packageRow.license,
          resolved: packageRow.source, integrity: packageRow.integrity,
        },
        "node_modules/onnxruntime-web/node_modules/onnxruntime-common": {
          version: packageRow.version, license: packageRow.license,
          resolved: packageRow.source, integrity: packageRow.integrity,
        },
      };
      const audit = () => auditDistributedAssets366(root, pins, packages, lock);
      expect(audit().failures).toEqual([]);

      writeFileSync(join(root, "dist/_astro/facade.js"),
        'import{n as e}from"./tool.js";export{e as PublicTool};');
      writeFileSync(join(root, "dist/_astro/preload-helper.abc.js"),
        'var x=document.createElement("link");var y="modulepreload";export{x as t};');
      writeFileSync(join(root, "dist/_astro/rolldown-runtime.abc.js"),
        'var x=Object.create,y=Object.getOwnPropertyDescriptor;var z="rolldown.rs/in-depth/bundling-cjs";export{x as t};');
      expect(audit().failures).toEqual([]);
      writeFileSync(join(root, "dist/_astro/other.js"), "var unreviewedExternalSource=1;");
      expect(audit().failures).toContain("UNMAPPED_DISTRIBUTED_SCRIPT _astro/other.js");
      rmSync(join(root, "dist/_astro/other.js"));

      writeFileSync(join(root, "node_modules/onnxruntime-web/package.json"),
        JSON.stringify({ name: packageRow.name, version: "0.0.0", license: packageRow.license }));
      expect(audit().failures).toContain(
        "UNVERIFIED_GENERATED_RUNTIME vendor/portrait-modnet/ort-wasm-simd-threaded.wasm");
      writeFileSync(join(root, "node_modules/onnxruntime-web/package.json"),
        JSON.stringify({ name: packageRow.name, version: packageRow.version, license: packageRow.license }));

      lock["node_modules/onnxruntime-web/node_modules/onnxruntime-common"].version = "2.0.0";
      expect(audit().failures).toContain(
        "UNVERIFIED_BUNDLED_PACKAGE _astro/tool.js.map -> onnxruntime-common");
      lock["node_modules/onnxruntime-web/node_modules/onnxruntime-common"].version = packageRow.version;

      writeFileSync(join(root, "dist/models/model.onnx"), "changed model");
      expect(audit().failures)
        .toContain("DISTRIBUTED_ASSET_HASH_MISMATCH models/model.onnx");
      writeFileSync(join(root, "dist/models/model.onnx"), "pinned model");

      mkdirSync(join(root, "dist/other-models"));
      writeFileSync(join(root, "dist/other-models/weights.ONNX"), "unreviewed weights");
      expect(audit().failures)
        .toContain("UNPINNED_DISTRIBUTED_ASSET other-models/weights.ONNX");

      writeFileSync(join(root, "dist/vendor/portrait-modnet/ort-wasm-simd-threaded.wasm"), "altered runtime");
      expect(audit().failures)
        .toContain("UNVERIFIED_GENERATED_RUNTIME vendor/portrait-modnet/ort-wasm-simd-threaded.wasm");

      writeFileSync(join(root, "dist/_astro/tool.js.map"),
        JSON.stringify({ version: 3, sources: ["../../node_modules/unlicensed-package/index.js"] }));
      expect(audit().failures)
        .toContain("UNVERIFIED_BUNDLED_PACKAGE _astro/tool.js.map -> unlicensed-package");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("requires source maps and refuses an absent built distribution", () => {
    const root = mkdtempSync(join(tmpdir(), "str-126-dist-missing-"));
    try {
      expect(auditDistributedAssets366(root, [], [], {}).failures).toContain("MISSING_DISTRIBUTION dist");
      mkdirSync(join(root, "dist/_astro"), { recursive: true });
      writeFileSync(join(root, "dist/_astro/unmapped.js"), "export {}");
      expect(auditDistributedAssets366(root, [], [], {}).failures)
        .toContain("UNMAPPED_DISTRIBUTED_SCRIPT _astro/unmapped.js");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
