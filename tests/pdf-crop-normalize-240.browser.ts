/**
 * #240 end-to-end: Chromium desktop viewport 390px. Reopens *downloaded PDFs*
 * through the shipped local PDF.js→PNG route, compares original/cropped pixels,
 * and source/normalized pixel placement independently via sharp. No device/Gold.
 * Run after `npm run catalog:build && npx astro build`:
 *   npx tsx tests/pdf-crop-normalize-240.browser.ts
 */
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { buildPdfFromPages, createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { parsePdf, pdfArray, pdfNumber, resolveReference } from "../src/engines/pdf/parser";

const port = Number(process.env.STRUMENTINI_PDF240_PORT ?? 18498);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Bad port");
const origin = `http://127.0.0.1:${port}`;
const root = resolve(import.meta.dirname, "..");
const screenshotCrop = "/tmp/str240-crop-page2.png";
const screenshotNormalize = "/tmp/str240-normalize-page2.png";

function fixture(): Uint8Array {
  const raw = createSimplePdf(["VISIBLE-ALPHA", "VISIBLE-BETA", "VISIBLE-GAMMA"], { width: 320, height: 440 });
  const model = parsePdf(raw);
  const pages = model.pages.map((page, i) => {
    const dictionary = page.object.value;
    if (dictionary.kind !== "dict") throw new Error("Invalid fixture");
    const entries = new Map(dictionary.entries);
    if (i === 1) {
      entries.set("CropBox", pdfArray([pdfNumber(25), pdfNumber(15), pdfNumber(305), pdfNumber(405)]));
      entries.set("Rotate", pdfNumber(90));
    }
    if (i === 2) entries.set("Rotate", pdfNumber(180));
    return { object: { ...page.object, value: { kind: "dict" as const, entries } }, inherited: page.inherited };
  });
  return buildPdfFromPages(pages.map((page) => ({ document: model, page })), { flatten: false, compress: false });
}
const source = fixture();
function assert(test: unknown, message: string): asserts test { if (!test) throw new Error(message); }

function contents(bytes: Uint8Array) {
  const document = parsePdf(bytes);
  return document.pages.map((page) => {
    const value = page.object.value;
    if (value.kind !== "dict") throw new Error("Invalid page");
    const ref = value.entries.get("Contents");
    const resolved = resolveReference(document, ref);
    const values = resolved?.kind === "array" ? resolved.items : [ref];
    return values.map((item) => {
      const resolvedStream = resolveReference(document, item);
      if (resolvedStream?.kind !== "stream") throw new Error("Invalid stream");
      return resolvedStream.bytes;
    });
  });
}

async function ready() {
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${origin}/tools/pdf-crop-normalize/`)).ok) return; } catch { /* startup */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Static PDF crop route missing");
}
async function download(page: Page, label: string): Promise<Uint8Array> {
  const promise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("link", { name: label, exact: true }).click();
  return new Uint8Array(await readFile(await (await promise).path()));
}
async function png(page: Page, bytes: Uint8Array, index: number): Promise<Uint8Array> {
  await page.locator('form input[type="file"]').first().setInputFiles({ name: "raster.pdf", mimeType: "application/pdf", buffer: Buffer.from(bytes) });
  await page.getByLabel("Pagine (facoltativo)").fill(String(index));
  await page.getByLabel("Scala render").fill("1");
  await page.locator('form button[type="submit"]').first().click();
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 35_000 });
  return download(page, `Scarica page-${String(index).padStart(3, "0")}.png`);
}
async function pixelDifference(a: Uint8Array, b: Uint8Array) {
  const one = await sharp(Buffer.from(a)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const two = await sharp(Buffer.from(b)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert(one.info.width === two.info.width && one.info.height === two.info.height, "Raster size mismatch");
  let different = 0, maxDifference = 0, sum = 0;
  for (let i = 0; i < one.data.length; i++) {
    const delta = Math.abs(one.data[i]! - two.data[i]!);
    maxDifference = Math.max(maxDifference, delta);
    sum += delta;
    if (delta > 16) different++;
  }
  return { width: one.info.width, height: one.info.height, different, maxDifference, meanDifference: sum / one.data.length };
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: false, acceptDownloads: true });
  try {
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`JS ${error.message}`));
    page.on("request", (request) => {
      const url = request.url();
      if (!(url.startsWith(origin) || url.startsWith("blob:") || url.startsWith("data:"))) failures.push(`Offsite ${url}`);
      if (request.method() !== "GET") failures.push(`Non-GET ${request.method()} ${url}`);
    });
    const response = await page.goto(`${origin}/tools/pdf-crop-normalize/`, { waitUntil: "networkidle" });
    assert(response?.status() === 200, "Crop route not HTTP200");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px horizontal overflow");
    assert((await page.locator('[data-pdf-box-semantics]').innerText()).includes("NASCONDE"), "Crop hides-not-deletes warning missing");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "mixed-rotate.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) });
    const selection = page.locator('label:has(> span:text-is("Pagine")) input');
    await selection.fill("3-2");
    await page.getByRole("alert").filter({ hasText: /decrescente|intervallo/iu }).waitFor({ timeout: 20_000 });
    assert(await page.getByRole("button", { name: "Applica crop visivo" }).isDisabled(), "Invalid range accepted");
    await selection.fill("2");
    for (const [label, value] of [["Nascondi sinistra (pt)", "25"], ["Nascondi alto (pt)", "20"],
      ["Nascondi destra (pt)", "15"], ["Nascondi basso (pt)", "10"]] as const) {
      await page.locator(`label:has(> span:text-is("${label}")) input`).fill(value);
    }
    await page.locator('[data-crop-preview] [data-crop-page="2"] img').waitFor({ timeout: 30_000 });
    assert(await page.locator('[data-crop-overlay-page="2"] rect').count() === 1, "Crop preview overlay missing");
    assert(await page.locator('[data-crop-overlay-page="1"]').count() === 0, "Unselected preview was cropped");
    await page.getByRole("button", { name: "Applica crop visivo" }).click();
    await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 30_000 });
    const cropped = await download(page, "Scarica PDF modificato");
    assert(inspectPdfBytes(cropped).pageCount === 3, "Cropped PDF count mismatch");
    const original = contents(source), cropContents = contents(cropped);
    assert(JSON.stringify(original.map((p) => p.length)) === JSON.stringify(cropContents.map((p) => p.length)), "Crop changed content streams");
    original.forEach((value, i) => assert(Buffer.from(value[0]!).equals(Buffer.from(cropContents[i]![0]!)), `Crop mutated Contents page ${i + 1}`));
    const hiddenText = await extractPdfText(cropped);
    assert(hiddenText[1]?.text.includes("VISIBLE-BETA"), "Hidden source content was deleted");

    await page.locator('select:has(option[value="normalize"])').selectOption("normalize");
    await page.locator('select:has(option[value="custom"])').selectOption("custom");
    await page.locator('label:has(> span:text-is("Larghezza destinazione (pt)")) input').fill("500");
    await page.locator('label:has(> span:text-is("Altezza destinazione (pt)")) input').fill("600");
    await page.locator('select:has(option[value="center"])').selectOption("center");
    await page.locator('label:has(> span:text-is("Margine minimo destinazione (pt)")) input').fill("0");
    await page.locator('[data-normalize-overlay-page="2"] image').waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "Normalizza pagine" }).click();
    await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 30_000 });
    const normalized = await download(page, "Scarica PDF modificato");
    const normalizedInspection = inspectPdfBytes(normalized);
    assert(normalizedInspection.pageCount === 3 && normalizedInspection.pages[1]?.rotation === 0 &&
      normalizedInspection.pages[1]?.width === 500 && normalizedInspection.pages[1]?.height === 600, "Normalized geometry mismatch");
    const normalizedContents = contents(normalized);
    assert(JSON.stringify(normalizedContents.map((p) => p.length)) === "[1,3,1]", "Transform wrappers not isolated");
    assert(Buffer.from(normalizedContents[1]![1]!).equals(Buffer.from(original[1]![0]!)), "Normalization mutated original stream");

    await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" });
    const sourceP1 = await png(page, source, 1), cropP1 = await png(page, cropped, 1);
    const identical = await pixelDifference(sourceP1, cropP1);
    assert(identical.different === 0, "Unselected PDF page changed visually");
    const sourceP2 = await png(page, source, 2);
    const cropP2 = await png(page, cropped, 2);
    const croppedFromSource = new Uint8Array(await sharp(Buffer.from(sourceP2))
      .extract({ left: 25, top: 20, width: 350, height: 250 }).png().toBuffer());
    const croppedMatch = await pixelDifference(croppedFromSource, cropP2);
    await writeFile("/tmp/str240-crop-expected.png", Buffer.from(croppedFromSource));
    await writeFile(screenshotCrop, Buffer.from(cropP2));
    assert(croppedMatch.meanDifference < 3 && croppedMatch.different < 6000,
      `Crop rendered pixels differ from pure visible-source rectangle: ${JSON.stringify(croppedMatch)}`);
    const normalizedP2 = await png(page, normalized, 2);
    const normalizedCenter = new Uint8Array(await sharp(Buffer.from(normalizedP2))
      .extract({ left: 55, top: 160, width: 390, height: 280 }).png().toBuffer());
    const centeredMatch = await pixelDifference(sourceP2, normalizedCenter);
    assert(centeredMatch.meanDifference < 3 && centeredMatch.different < 250, `Normalize center source mismatch: ${JSON.stringify(centeredMatch)}`);
    await writeFile(screenshotCrop, Buffer.from(cropP2));
    await writeFile(screenshotNormalize, Buffer.from(normalizedP2));
    assert(failures.length === 0, `Browser requests/errors: ${failures.join(" | ")}`);
    console.log(JSON.stringify({ status: "PASS", browser: "desktop Chromium", viewport: [390, 844], physicalDeviceTested: false,
      sourcePages: 3, sourceRotationPage2: 90, cropBoxPage2: [35, 40, 285, 390], cropRendered: croppedMatch,
      normalizedPage2: [500, 600, 0], normalizeCenteredPixels: centeredMatch, unselected: identical,
      originalStreamBytesPreserved: true, screenshotCrop, screenshotNormalize, offsite: 0 }, null, 2));
  } finally { await context.close(); }
} finally { await browser?.close(); server.kill("SIGTERM"); }
