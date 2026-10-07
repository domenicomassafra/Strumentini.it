import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const evidenceDir = path.join(repoRoot, "quality/benchmarks/heavy-local-feasibility");
const matrix = JSON.parse(await readFile(path.join(evidenceDir, "decision-matrix.json"), "utf8"));
const runtime = JSON.parse(await readFile(path.join(evidenceDir, "desktop-runtime.json"), "utf8"));

test("decision matrix covers every heavy family and required feasibility field", () => {
  const families = new Set(matrix.familyRecommendations.map((item) => item.family));
  assert.deepEqual([...families].sort(), ["audio", "heic", "ocr", "office", "pdf", "video"]);
  assert.equal(matrix.rows.length, 16);
  for (const row of matrix.rows) {
    assert.ok(row.id);
    assert.ok(row.package);
    assert.ok(row.version);
    assert.ok(row.license);
    assert.ok(row.formats.length > 0);
    assert.ok(["SPIKE", "DENY"].includes(row.decision));
    assert.equal(typeof row.productionAllowed, "boolean");
    assert.ok(row.cancellation.status);
    assert.equal(row.locality.mode, "LOCAL_ONLY");
    assert.ok(row.mobile.iosSafari.status);
    assert.ok(row.mobile.androidChrome.status);
    assert.ok(row.fallback);
    assert.ok("gzipBytes" in row.lazyBundle);
  }
});

test("no production promotion is possible without genuine physical mobile receipts", () => {
  assert.equal(matrix.policy.promotedPaths, 0);
  assert.equal(matrix.physicalMobile.iosSafari.status, "NOT_RUN");
  assert.equal(matrix.physicalMobile.androidChrome.status, "NOT_RUN");
  assert.equal(matrix.rows.filter((row) => row.productionAllowed).length, 0);
  for (const row of matrix.rows.filter((candidate) => candidate.productionAllowed)) {
    assert.equal(row.mobile.iosSafari.status, "PASS");
    assert.equal(row.mobile.androidChrome.status, "PASS");
  }
  const webkit = runtime.results.find((engine) => engine.engine === "webkit");
  assert.equal(webkit.classification, "desktop-regression-not-safari");
});

test("desktop real-file runs stay local and all executed cases pass", () => {
  for (const engine of runtime.results) {
    assert.equal(engine.status, "OBSERVED");
    assert.deepEqual(engine.externalRequests, []);
    const failures = (engine.payload?.results ?? []).filter((item) => item.status !== "PASS");
    assert.deepEqual(failures, []);
  }
});

test("known security and license blockers remain denied", () => {
  const xlsx = matrix.rows.find((row) => row.id === "xlsx");
  assert.equal(xlsx.decision, "DENY");
  assert.equal(xlsx.securityAudit.status, "FAIL");
  assert.ok(xlsx.securityAudit.advisories.length >= 2);

  const pptx = matrix.rows.find((row) => row.id === "pptxgenjs");
  assert.equal(pptx.decision, "DENY");
  assert.equal(pptx.securityAudit.status, "FAIL");

  const ffmpegCore = matrix.rows.find((row) => row.id === "ffmpeg-core");
  assert.equal(ffmpegCore.decision, "DENY");
  assert.equal(ffmpegCore.licenseGate.status, "DENY");
  assert.match(ffmpegCore.license, /^GPL-/u);
});

test("OCR size evidence includes the observed local core, worker and Italian language asset", () => {
  const engine = matrix.rows.find((row) => row.id === "tesseract-js");
  const language = matrix.rows.find((row) => row.id === "tesseract-ita");
  assert.equal(engine.runtime.status, "PASS");
  assert.ok(engine.lazyBundle.runtimeAssets.some((asset) => asset.file === "worker.min.js"));
  assert.ok(engine.lazyBundle.runtimeAssets.some((asset) => /core\/.+\.wasm\.js$/u.test(asset.file)));
  assert.ok(language.lazyBundle.runtimeAssets.some((asset) => asset.file === "lang/ita.traineddata.gz"));
  assert.ok(language.lazyBundle.rawBytes > 6_000_000);
});

test("corpus receipt contains the real file families exercised by the harness", () => {
  const names = new Set(matrix.corpus.files.map((file) => file.name));
  for (const name of ["sample.heic", "ocr-it.png", "sample.xlsx", "sample.docx", "sample.pptx", "sample.pdf", "sample.wav", "sample.mp4"]) {
    assert.ok(names.has(name), `${name} missing from corpus receipt`);
  }
  for (const file of matrix.corpus.files) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/u);
    assert.ok(file.bytes > 0);
    assert.ok(file.provenance);
  }
});
