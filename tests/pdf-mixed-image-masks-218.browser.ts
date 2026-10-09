/** Offline source-only Chromium acceptance with independent output reopening.
 * Run in dedicated worktree: ./node_modules/.bin/tsx tests/pdf-mixed-image-masks-218.browser.ts
 * A test harness, NOT the public app, production build, or physical-mobile proof.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const origin = "http://127.0.0.1:18481";
const url = `${origin}/tests/fixtures/pdf-mixed-browser-218.html`;
const fixtures = resolve(root, "tests/fixtures/pdf-image-mixed-218");
const server = spawn(resolve(root, "node_modules/.bin/vite"), ["--config", "tests/vite-pdf-mixed-masks-218.config.mjs"],
  { cwd: root, stdio: "ignore" });
const temp = await mkdtemp(resolve(tmpdir(), "pdf218-mixed-"));
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let checks = 0;
const evidence: Array<Record<string, string | number | boolean>> = [];
function check(value: unknown, why: string) { assert(value, why); checks++; }

type BrowserResult = {
  output: number[];
  analysis: { touched: number; skipped: number; originalBytes: number; outputBytes: number; savedBytes: number;
    recommendOriginal: boolean; downsampleApplied: boolean; grayscaleApplied?: boolean;
    inventory: readonly { action: string; reason: string }[]; visualParity: string };
};

async function render218(data: Uint8Array): Promise<{ bytes: Uint8Array; text: string; page: readonly [number, number] }> {
  const load = getDocument({ data: Uint8Array.from(data), useSystemFonts: true, disableFontFace: true });
  try {
    const pdf = await load.promise;
    check(pdf.numPages === 1, "Independent PDF.js must reopen exactly one output page");
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never,
      viewport, background: "rgb(255,255,255)" }).promise;
    const text = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join("");
    page.cleanup();
    return { bytes: new Uint8Array(canvas.toBuffer("image/png")), text, page: [canvas.width, canvas.height] };
  } finally { await load.destroy(); }
}

try {
  let available = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Vite failed before boot: ${server.exitCode}`);
    try { available = (await fetch(url)).status === 200; if (available) break; } catch { /* starting */ }
    await new Promise<void>((done) => setTimeout(done, 150));
  }
  check(available, "Isolated offline harness must serve locally");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requests: string[] = [], errors: string[] = [];
  page.on("request", (request) => {
    const requestUrl = request.url();
    if (!(requestUrl.startsWith(origin) || requestUrl.startsWith("data:") || requestUrl.startsWith("blob:"))) requests.push(requestUrl);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator('[data-218-ready="true"]').waitFor();
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px harness no overflow");

  async function exercise(scenario: "safe" | "smask" | "multiply" | "form" | "indexed" | "uniform",
    profile: "scan" | "jpeg", expected: "changed" | "unchanged", grayscale = false) {
    const source = new Uint8Array(await readFile(resolve(fixtures, `${scenario}-mixed-218.pdf`)));
    await page.locator("#source-218").setInputFiles(resolve(fixtures, `${scenario}-mixed-218.pdf`));
    const start = performance.now();
    const response = await page.evaluate(async ({ mode, options }) => window.compressMixed218(mode, options), {
      mode: profile, options: { quality: .45, maxLongestEdgePx: 256, grayscale },
    }) as BrowserResult;
    const elapsedMs = Math.round(performance.now() - start);
    const result = Uint8Array.from(response.output), report = response.analysis;
    const outputSame = Buffer.from(source).equals(Buffer.from(result));
    check(report.originalBytes === source.byteLength, `${scenario} ${profile}: source byte report exact`);
    check(report.outputBytes === result.byteLength, `${scenario} ${profile}: output byte report exact`);
    check(report.savedBytes === source.byteLength - result.byteLength, `${scenario} ${profile}: savings arithmetic honest`);
    check(report.visualParity === "not-verified-lossy", `${scenario} ${profile}: no falsely verified lossy parity`);
    check(expected === "changed" ? !outputSame && report.touched > 0 && !report.recommendOriginal
      : outputSame && report.touched === 0 && report.recommendOriginal,
      `${scenario} ${profile}: truthful effective output decision`);
    check(expected === "changed" ? result.byteLength < source.byteLength : result.byteLength === source.byteLength,
      `${scenario} ${profile}: no blindly claimed size savings`);
    check(report.touched + report.skipped === report.inventory.length, `${scenario} ${profile}: counts match inventory`);
    if (expected === "changed") {
      check(report.inventory.some((item) => item.action === "recompressed"), `${scenario} ${profile}: actual rewritten image reported`);
      check(profile !== "scan" || report.downsampleApplied, "Scan cap actually downsamples Flate image");
    } else check(report.inventory.every((item) => item.action === "unchanged"), `${scenario} ${profile}: skipped unsafe layers`);

    const sourcePath = resolve(temp, `source-${scenario}-${profile}-218.pdf`);
    const outputPath = resolve(temp, `result-${scenario}-${profile}-218.pdf`);
    await writeFile(sourcePath, source); await writeFile(outputPath, result);
    const mode = expected === "changed" ? (grayscale ? "scan-gray" : profile) : "unchanged";
    const independent = JSON.parse(execFileSync("python3", [resolve(root, "tests/fixtures/pdf-mixed-forensics-218.py"),
      sourcePath, outputPath, mode], { encoding: "utf8", timeout: 12_000 })) as { same_contents: boolean; same_text: boolean };
    check(independent.same_contents && independent.same_text, `${scenario} ${profile}: pypdf + pdfminer independently preserve page streams/text`);
    const [before, after] = await Promise.all([render218(source), render218(result)]);
    check(before.page.join("x") === after.page.join("x"), `${scenario} ${profile}: PDF.js rendered page geometry preserved`);
    check(before.text === after.text && after.text.includes("SEARCHABLE_MIXED_VECTOR_TEXT_218"),
      `${scenario} ${profile}: independently searchable text stable`);
    const a = await sharp(before.bytes).removeAlpha().raw().toBuffer();
    const b = await sharp(after.bytes).removeAlpha().raw().toBuffer();
    check(a.length === b.length, `${scenario} ${profile}: independent PDF.js raster dimensions match`);
    let summed = 0;
    for (let i = 0; i < a.length; i++) summed += Math.abs(a[i]! - b[i]!);
    const meanDelta = summed / a.length;
    if (expected === "unchanged") check(meanDelta === 0, `${scenario} ${profile}: unsafe mixed layer pixel parity exact`);
    else check(meanDelta < 45, `${scenario} ${profile}: sample-specific lossy visual delta not excessive: ${meanDelta}`);
    evidence.push({ scenario, profile, grayscale, sourceBytes: source.length, outputBytes: result.length, touched: report.touched,
      elapsedMs, meanRgbDelta: Number(meanDelta.toFixed(2)), independentReopened: true });
  }

  await exercise("safe", "scan", "changed");
  await exercise("safe", "scan", "changed", true);
  await exercise("safe", "jpeg", "changed");
  await exercise("indexed", "scan", "changed");
  await exercise("indexed", "jpeg", "changed");
  await exercise("smask", "scan", "unchanged");
  await exercise("smask", "jpeg", "unchanged");
  await exercise("multiply", "scan", "unchanged");
  await exercise("form", "jpeg", "unchanged");
  await exercise("uniform", "scan", "unchanged");
  await exercise("uniform", "jpeg", "unchanged");

  // Large-memory negative: image advertises ten BILLION pixels. It is a
  // resource but not painted; never ask a renderer to decode/render it.
  // Only prove the source image itself was skipped, not whole-PDF rejection.
  await page.locator("#source-218").setInputFiles(resolve(fixtures, "bomb-mixed-218.pdf"));
  const bombSource = new Uint8Array(await readFile(resolve(fixtures, "bomb-mixed-218.pdf")));
  const bombResult = await page.evaluate(() => window.compressMixed218("scan", {
    maxLongestEdgePx: 256, quality: .45,
  })) as BrowserResult;
  const bombOutput = Uint8Array.from(bombResult.output);
  check(bombResult.analysis.inventory.some((image) => image.action === "unchanged" && image.reason === "image-dimensions-over-limit"),
    "Huge declared image must be skipped before any giant canvas allocation");
  check(bombResult.analysis.touched <= 1 && bombResult.analysis.skipped >= 2,
    "Declared giant image and JPEG must never be counted as transformed scan pixels");
  const bombOriginalPath = resolve(temp, "bomb-source-218.pdf"), bombFinalPath = resolve(temp, "bomb-output-218.pdf");
  await writeFile(bombOriginalPath, bombSource); await writeFile(bombFinalPath, bombOutput);
  const bombIndependent = JSON.parse(execFileSync("python3", [resolve(root, "tests/fixtures/pdf-mixed-forensics-218.py"),
    bombOriginalPath, bombFinalPath, "scan"], { encoding: "utf8", timeout: 12_000 })) as { same_contents: boolean; same_text: boolean };
  check(bombIndependent.same_contents && bombIndependent.same_text,
    "Independent pypdf proves untouched huge Image XObject bytes and page text (never rendered bomb)");

  await page.locator("#source-218").setInputFiles(resolve(fixtures, "safe-mixed-218.pdf"));
  const cancelled = await page.evaluate(() => window.cancelMixed218());
  check(cancelled.startsWith("AbortError:"), `In-flight native decompression job must abort, got ${cancelled}`);
  check(requests.length === 0, `No external network requests: ${requests.join("; ")}`);
  check(errors.length === 0, `No browser runtime errors: ${errors.join("; ")}`);
  console.log(`PDF #218 mixed-mask Chromium 390x844: PASS (${checks} checks), PDF.js/Pillow/pypdf/pdfminer independent output reopens; no offsite`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await rm(temp, { recursive: true, force: true });
}
