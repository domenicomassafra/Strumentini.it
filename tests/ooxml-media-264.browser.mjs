// Actual Chromium browser encoder + downloadable OOXML artifacts, not a
// simulated in-memory Node-only callback. Run with one browser, no Astro build.
// node tests/ooxml-media-264.browser.mjs
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { unzipSync } from "fflate";

const root = resolve(import.meta.dirname, "..");
const baseUrl = "http://127.0.0.1:18486";
const receiptPath = resolve(root, "tests/ooxml-media-receipts");
const src = resolve(root, "src/engines/ooxml/media-compress.ts");
const output = resolve(root, "dist/ooxml-media-264-runtime.mjs");
await build({ entryPoints: [src], bundle: true, format: "esm", platform: "browser", outfile: output });
await mkdir(receiptPath, { recursive: true });

const server = spawn("python3", ["-m", "http.server", "18486", "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser;
const evidence = [];
let checks = 0;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break; } catch { /* loading */ }
    await new Promise((done) => setTimeout(done, 120));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const offsite = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(baseUrl) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
  });
  const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200);

  for (const kind of ["docx", "pptx", "xlsx"]) {
    const original = new Uint8Array(await readFile(resolve(root, `tests/ooxml-media-fixtures/embedded.${kind}`)));
    const downloadPromise = page.waitForEvent("download");
    const observed = await page.evaluate(async ({ source, type }) => {
      const { compressOoxmlEmbeddedMedia } = await import("/ooxml-media-264-runtime.mjs");
      const result = await compressOoxmlEmbeddedMedia(new Uint8Array(source), {
        approveLossyJpeg: true, jpegQuality: 0.65,
      });
      const blob = new Blob([result.bytes], { type: type === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : type === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compressed-real.${type}`;
      document.body.append(a);
      a.click();
      a.remove();
      // Deferred revoke avoids WebKit/Chromium download cancel races.
      queueMicrotask(() => URL.revokeObjectURL(url));
      return {
        outcome: result.outcome, changedCount: result.changedCount, skippedCount: result.skippedCount,
        savedBytes: result.savedBytes, mediaSavedBytes: result.mediaSavedBytes,
        fidelityWarning: result.fidelityWarning, verification: result.verification,
        parts: result.parts,
      };
    }, { source: Array.from(original), type: kind });
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), `compressed-real.${kind}`);
    const bytes = new Uint8Array(await readFile(await download.path()));
    assert(bytes.byteLength < original.byteLength, "Browser result must actually reduce OOXML package bytes");
    assert.equal(observed.outcome, "optimized");
    assert.equal(observed.changedCount, 2);
    assert.equal(observed.savedBytes, original.length - bytes.byteLength);
    assert.match(observed.fidelityWarning, /APPROVED LOSSY/u);

    const a = unzipSync(original);
    const b = unzipSync(bytes);
    assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort(), "No Office part name changes");
    for (const [path, content] of Object.entries(a)) {
      if (/(?:^|\/)media\//u.test(path)) continue;
      assert.deepEqual(b[path], content, `Office XML/rels must remain byte-identical: ${path}`);
    }
    await writeFile(resolve(receiptPath, `compressed-real.${kind}`), bytes);
    // Independent ZIP parser and real application libraries via Python, not
    // the fflate used inside our browser engine.
    const reopened = spawnSync("python3", [
      resolve(root, "tests/ooxml-media-264-independent-reopen.py"),
      resolve(receiptPath, `compressed-real.${kind}`),
      resolve(root, `tests/ooxml-media-fixtures/embedded.${kind}`),
    ], { cwd: root, encoding: "utf8", timeout: 10_000 });
    assert.equal(reopened.status, 0, `Independent ${kind} reopen failed: ${reopened.stderr || reopened.stdout}`);
    evidence.push({
      kind,
      beforeBytes: original.byteLength,
      afterBytes: bytes.byteLength,
      browserSha256: createHash("sha256").update(bytes).digest("hex"),
      browserMime: kind,
      independentReopen: reopened.stdout.trim(),
      result: observed,
    });
    checks += 10;
  }

  // Fail-closed browser: no JPEG approval means JPEG skipped. Bad option
  // contracts reject before producing downloadable Office output.
  const source = new Uint8Array(await readFile(resolve(root, "tests/ooxml-media-fixtures/embedded.docx")));
  const refusal = await page.evaluate(async (bytes) => {
    const { compressOoxmlEmbeddedMedia } = await import("/ooxml-media-264-runtime.mjs");
    const r = await compressOoxmlEmbeddedMedia(new Uint8Array(bytes));
    let invalidResizeRejected = false;
    try { await compressOoxmlEmbeddedMedia(new Uint8Array(bytes), { approveResize: true }); }
    catch (error) { invalidResizeRejected = String(error).includes("REBUILD_VERIFICATION_FAILED"); }
    return { jpegSkip: r.parts.find((item) => item.type === "jpeg")?.skipReason, invalidResizeRejected };
  }, Array.from(source));
  assert.equal(refusal.jpegSkip, "lossy-approval-required");
  assert(refusal.invalidResizeRejected);
  assert.deepEqual(offsite, []);
  checks += 3;
  await writeFile(resolve(receiptPath, "browser-264.json"), JSON.stringify({
    ticket: 264, scope: "bounded-office-embedded-raster-media", engine: "chromium",
    browserVersion: browser.version(), browserViewport: { width: 390, height: 844 },
    notPhysicalDevice: true, checks, outcome: "PASS", offsiteRequests: offsite.length, documents: evidence,
    limitations: ["No public UI integration; core browser engine only", "JPEG opt-in lossy; PNG decode RGBA equivalence only", "No unsupported SVG/GIF/EMF/vector/embedded object codec"],
  }, null, 2) + "\n");
  console.log(`STR-264 OOXML real browser export: PASS (${checks} checks; DOCX/PPTX/XLSX independently reopened)`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
