/**
 * Unpublished #237 security acceptance: real Chromium canvas redaction plus
 * independent pypdf byte/structure/Flate extraction and Node PDF.js raster.
 * Run after linking dependencies in this dedicated worktree:
 *   ./node_modules/.bin/tsx tests/pdf-redaction-malicious-237.browser.ts
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { IMAGE_MARKER_237, ORPHAN_MARKER_237, PRIVATE_MARKER_237 } from "./fixtures/pdf-redaction-malicious-237";

const root = resolve(import.meta.dirname, "..");
const fixtures = resolve(root, "tests/fixtures/pdf-redaction-malicious-237");
const origin = "http://127.0.0.1:18479";
const bridge = `${origin}/tests/fixtures/pdf-redaction-malicious-237.html`;
const server = spawn(resolve(root, "node_modules/.bin/vite"), ["--config", "tests/vite-pdf-redaction-malicious-237.config.mjs"],
  { cwd: root, stdio: "ignore" });
const caseNames = [
  "covered-orphan-237.pdf", "complex-smask-form-237.pdf", "complex-rotate-90-237.pdf",
  "complex-rotate-180-237.pdf", "complex-rotate-270-237.pdf",
] as const;
const regions = [{ page: 1, left: 0, top: 0, width: 1, height: 0.5 }] as const;
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
const temp = await mkdtemp(resolve(tmpdir(), "str-237-malicious-"));
let checks = 0;
const observed: unknown[] = [];

function check(condition: unknown, message: string) { assert(condition, message); checks += 1; }

async function independentlyRender(bytes: Uint8Array, pageNumber: number) {
  const loader = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true, disableFontFace: true });
  try {
    const document = await loader.promise;
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas, canvasContext: canvas.getContext("2d") as never, viewport }).promise;
    const text = (await page.getTextContent()).items.map((entry) => "str" in entry ? entry.str : "").join("");
    const ops = await page.getOperatorList();
    const result = { width: canvas.width, height: canvas.height, text, ops: ops.fnArray.length,
      pixels: canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data };
    page.cleanup();
    return result;
  } finally { await loader.destroy(); }
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Isolated Vite process exited (${server.exitCode})`);
    try { ready = (await fetch(bridge)).ok; if (ready) break; } catch { /* starting */ }
    await new Promise<void>((done) => setTimeout(done, 150));
  }
  check(ready, "Local unpublished test page must load");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: false });
  const pageErrors: string[] = [], offsite: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (!(url.startsWith(origin) || url.startsWith("blob:") || url.startsWith("data:"))) offsite.push(url);
  });
  await page.goto(bridge, { waitUntil: "networkidle" });
  await page.locator('[data-237-ready="true"]').waitFor();
  check(await page.locator("#source237").count() === 1, "Real PDF File input exists");

  for (const name of caseNames) {
    const source = new Uint8Array(await readFile(resolve(fixtures, name)));
    await page.locator("#source237").setInputFiles(resolve(fixtures, name));
    const started = performance.now();
    const generated = await page.evaluate(async (selectedRegions) => window.runMalicious237(selectedRegions), regions);
    const spentMs = Math.round(performance.now() - started);
    const output = Uint8Array.from(generated.bytes);
    const plan = generated.proof as {
      policy: string; pageCount: number; verifiedBlackPixels: number;
      pages: readonly { page: number; pixelWidth: number; pixelHeight: number; pageWidth: number; pageHeight: number; regions: unknown[] }[];
    };
    check(output.length > 100 && output.length < 24 * 1024 * 1024, `${name}: bounded actual PDF artifact`);
    check(plan.policy === "new-raster-only-lossless-flate-no-source-objects", `${name}: claimed raster-only policy`);
    check(plan.verifiedBlackPixels > 0, `${name}: selected area actually redacted`);
    const raw = Buffer.from(output);
    check(![PRIVATE_MARKER_237, ORPHAN_MARKER_237].some((value) => raw.includes(Buffer.from(value))),
      `${name}: no recoverable raw secret marker`);
    check(!raw.includes(Buffer.from(IMAGE_MARKER_237)), `${name}: no original raw Image XObject survived`);

    const sourcePath = resolve(temp, `source-${name}`), outputPath = resolve(temp, `export-${name}`), planPath = resolve(temp, `plan-${name}.json`);
    await writeFile(sourcePath, source);
    await writeFile(outputPath, output);
    await writeFile(planPath, JSON.stringify(plan));
    const forensic = JSON.parse(execFileSync("python3", [
      resolve(root, "tests/fixtures/pdf-redaction-forensics-237.py"), sourcePath, outputPath, planPath,
    ], { encoding: "utf8", timeout: 12_000 })) as { pypdf: string; pdfminer: string; blackPixels: number; outsideColoredPixels: number };
    check(forensic.pypdf === "PASS", `${name}: independent pypdf structural, Flate and object forensic check`);
    check(forensic.pdfminer === "PASS", `${name}: independent pdfminer source/output text extraction`);
    check(forensic.blackPixels === plan.verifiedBlackPixels, `${name}: independently calculated black pixel count`);
    check(forensic.outsideColoredPixels > 0, `${name}: unrelated visible raster evidence remains outside selected area`);

    const [before, after] = await Promise.all([independentlyRender(source, 1), independentlyRender(output, 1)]);
    check(after.text === "", `${name}: no PDF.js search text recoverable in downloaded output`);
    check(after.ops > 0, `${name}: output PDF.js independently rendered real image operators`);
    check(before.width === after.width && before.height === after.height, `${name}: displayed page geometry preserved`);
    const quarterX = Math.round(after.width * 0.5), topY = Math.round(after.height * 0.25);
    const blackAt = (topY * after.width + quarterX) * 4;
    check(after.pixels[blackAt] === 0 && after.pixels[blackAt + 1] === 0 && after.pixels[blackAt + 2] === 0,
      `${name}: independently rendered pixel inside redaction is black`);
    const bottomY = Math.round(after.height * 0.75), bottomAt = (bottomY * after.width + quarterX) * 4;
    const outside = Array.from(after.pixels.subarray(bottomAt, bottomAt + 3));
    check(outside.some((value) => value > 0), `${name}: non-redacted rendered pixels stay colored`);
    observed.push({ name, elapsedMs: spentMs, sourceBytes: source.length, outputBytes: output.length,
      outputPage: [after.width, after.height], outsideRgb: outside, forensic });
  }

  check(pageErrors.length === 0, `No Chromium JS errors: ${pageErrors.join("; ")}`);
  check(offsite.length === 0, `No offsite requests: ${offsite.join("; ")}`);
  console.log(`PASS #237 malicious PDF raster acceptance (${checks} checks), Chromium 390x844, independent pypdf+Node PDF.js, no offsite`);
  console.log(JSON.stringify(observed, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await rm(temp, { recursive: true, force: true });
}
