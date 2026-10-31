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

      // pnpm's isolated store must map back to authoritative npm metadata.
      const mapFile = join(root, "dist/_astro/tool.js.map");
      const writeSources = (sources: string[]) =>
        writeFileSync(mapFile, JSON.stringify({ version: 3, sources }));
      writeSources([
        "../../node_modules/.pnpm/onnxruntime-web@1.31.0/node_modules/onnxruntime-web/dist/main.js",
        "../../node_modules/.pnpm/onnxruntime-common@1.31.0/node_modules/onnxruntime-common/dist/index.js",
      ]);
      expect(audit().failures).toEqual([]);
      const scopedRow = {
        name: "@pdf-lib/standard-fonts", version: "1.0.0", license: "MIT",
        source: "https://registry.npmjs.org/@pdf-lib/standard-fonts/-/standard-fonts-1.0.0.tgz",
        integrity: packageRow.integrity,
      };
      packages.push(scopedRow);
      Object.assign(lock, { "node_modules/@pdf-lib/standard-fonts": {
        version: scopedRow.version, license: scopedRow.license,
        resolved: scopedRow.source, integrity: scopedRow.integrity,
      } });
      writeSources(["../../node_modules/.pnpm/@pdf-lib+standard-fonts@1.0.0/node_modules/@pdf-lib/standard-fonts/index.js"]);
      expect(audit().failures).toEqual([]);
      for (const [source, name] of [
        ["../../node_modules/.pnpm/onnxruntime-web@0.0.0/node_modules/onnxruntime-web/dist/main.js", "onnxruntime-web"],
        ["../../node_modules/.pnpm/onnxruntime-web@1.31.0/node_modules/onnxruntime-common/dist/index.js", "onnxruntime-common"],
        ["../../node_modules/.pnpm/onnxruntime-web@1.31.0/node_modules/onnxruntime-web/node_modules/unverified/index.js", "unverified"],
      ]) {
        writeSources([source]);
        expect(audit().failures).toContain("UNVERIFIED_BUNDLED_PACKAGE _astro/tool.js.map -> " + name);
      }
      writeSources(["../../node_modules/.pnpm/onnxruntime-web@1.31.0/node_modules/onnxruntime-web/dist/main.js"]);
      const originalIntegrity = lock["node_modules/onnxruntime-web"].integrity;
      lock["node_modules/onnxruntime-web"].integrity = "sha512-unverified";
      expect(audit().failures).toContain("UNVERIFIED_BUNDLED_PACKAGE _astro/tool.js.map -> onnxruntime-web");
      lock["node_modules/onnxruntime-web"].integrity = originalIntegrity;
      Object.assign(lock, { "node_modules/other/node_modules/onnxruntime-web": {
        ...lock["node_modules/onnxruntime-web"], integrity: "sha512-conflicting",
      } });
      expect(audit().failures).toContain("UNVERIFIED_BUNDLED_PACKAGE _astro/tool.js.map -> onnxruntime-web");
      delete (lock as Record<string, unknown>)["node_modules/other/node_modules/onnxruntime-web"];
      writeSources([
        "../../node_modules/onnxruntime-web/dist/main.js",
        "../../node_modules/onnxruntime-web/node_modules/onnxruntime-common/dist/index.js",
      ]);
      expect(audit().failures).toEqual([]);

      writeFileSync(join(root, "dist/_astro/facade.js"),
        'import{n as e}from"./tool.js";export{e as PublicTool};');
      // Vite 8.3.5 / Rolldown may emit an export-from-only facade without a sourcemap.
      writeFileSync(join(root, "dist/_astro/reexport.js"),
        'export{n as DeveloperWebTool}from"./tool.js";');
      writeFileSync(join(root, "dist/_astro/unsigned.js"), "export {};");
      writeFileSync(join(root, "dist/_astro/unsigned-facade.js"),
        'export{n as DeveloperWebTool}from"./unsigned.js";');
      expect(audit().failures).toContain("UNMAPPED_DISTRIBUTED_SCRIPT _astro/unsigned-facade.js");
      rmSync(join(root, "dist/_astro/unsigned-facade.js"));
      rmSync(join(root, "dist/_astro/unsigned.js"));
      writeFileSync(join(root, "dist/_astro/preload-helper.abc.js"),
        'var x=document.createElement("link");var y="modulepreload";export{x as t};');
      writeFileSync(join(root, "dist/_astro/rolldown-runtime.abc.js"),
        'var x=Object.create,y=Object.getOwnPropertyDescriptor;var z="rolldown.rs/in-depth/bundling-cjs";export{x as t};');
      expect(audit().failures).toEqual([]);

      writeFileSync(join(root, "dist/_astro/reexport.js"),
        'export{n as DeveloperWebTool}from"./tool.js";globalThis.unverified=1;');
      expect(audit().failures).toContain("UNMAPPED_DISTRIBUTED_SCRIPT _astro/reexport.js");
      writeFileSync(join(root, "dist/_astro/reexport.js"),
        'export{n as DeveloperWebTool}from"./tool.js";');

      // PDF.js ?url produces raw .mjs workers: each must map to locked npm bytes.
      const pdfRow = {
        name: "pdfjs-dist", version: "6.4.299", license: "Apache-2.0",
        source: "https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz",
        integrity: packageRow.integrity,
      };
      packages.push(pdfRow);
      Object.assign(lock, { "node_modules/pdfjs-dist": {
        version: pdfRow.version, license: pdfRow.license,
        resolved: pdfRow.source, integrity: pdfRow.integrity,
      } });
      mkdirSync(join(root, "node_modules/pdfjs-dist/build"), { recursive: true });
      mkdirSync(join(root, "node_modules/pdfjs-dist/legacy/build"), { recursive: true });
      writeFileSync(join(root, "node_modules/pdfjs-dist/package.json"),
        JSON.stringify({ name: pdfRow.name, version: pdfRow.version, license: pdfRow.license }));
      writeFileSync(join(root, "node_modules/pdfjs-dist/build/pdf.worker.mjs"), "current PDF worker bytes");
      writeFileSync(join(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"), "legacy PDF worker bytes");
      writeFileSync(join(root, "dist/_astro/pdf.worker.Valid.mjs"), "current PDF worker bytes");
      writeFileSync(join(root, "dist/_astro/pdf.worker-Legacy.mjs"), "legacy PDF worker bytes");
      expect(audit().failures).toEqual([]);
      expect(audit().bundledPackages).toContain("pdfjs-dist@6.4.299");
      expect(audit().bundledModuleAssets).toHaveLength(2);

      writeFileSync(join(root, "dist/_astro/pdf.worker.Valid.mjs"), "tampered PDF worker");
      expect(audit().failures).toContain(
        "UNVERIFIED_DISTRIBUTED_ES_MODULE _astro/pdf.worker.Valid.mjs");
      writeFileSync(join(root, "dist/_astro/pdf.worker.Valid.mjs"), "current PDF worker bytes");
      writeFileSync(join(root, "dist/_astro/unreviewed.mjs"), "unknown ESM");
      expect(audit().failures).toContain(
        "UNVERIFIED_DISTRIBUTED_ES_MODULE _astro/unreviewed.mjs");
      rmSync(join(root, "dist/_astro/unreviewed.mjs"));

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
