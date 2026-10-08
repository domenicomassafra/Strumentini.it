/**
 * #238 independent real-browser proof. Run after `npm run catalog:build && npx astro build`:
 *   npx tsx tests/pdf-page-numbers-238.browser.ts
 * Single desktop Chromium 390px viewport, local static files, actual PDF downloads
 * and independent rasterization through the already shipped PDF.js PDF→PNG tool.
 * The screenshots are temporary local receipts, NOT physical-device evidence.
 */
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { parsePdf, resolveReference } from "../src/engines/pdf/parser";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_NUMBERS_PORT ?? 18496);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
const origin = `http://127.0.0.1:${port}`;
const screenshotDir = process.env.STRUMENTINI_PDF_NUMBERS_SCREENSHOT_DIR ?? "/tmp";
const screenshotPreview = resolve(screenshotDir, "str238-numbering-preview.png");
const screenshotRendered = resolve(screenshotDir, "str238-numbered-p2.png");
const fixture = Buffer.from(createSimplePdf(["SOURCE-ONE", "SOURCE-TWO", "SOURCE-THREE", "SOURCE-FOUR"], { width: 320, height: 440 }));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/tools/pdf-page-numbers/`)).ok) return; } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Compiled PDF numbering route not accessible");
}

async function download(page: Page, label: string): Promise<Uint8Array> {
  const event = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("link", { name: label, exact: true }).click();
  return new Uint8Array(await readFile(await (await event).path()));
}

function originalStreams(bytes: Uint8Array): readonly (readonly Uint8Array[])[] {
  const model = parsePdf(bytes);
  return model.pages.map((page) => {
    const dict = page.object.value;
    if (dict.kind !== "dict") throw new Error("Invalid page dictionary");
    const resolved = resolveReference(model, dict.entries.get("Contents"));
    const streams = resolved?.kind === "array" ? resolved.items.map((value) => resolveReference(model, value)) : [resolved];
    return streams.map((value) => {
      if (value?.kind !== "stream") throw new Error("Invalid page contents");
      return value.bytes;
    });
  });
}

async function rasterPage(page: Page, pdf: Uint8Array, pageNumber: number): Promise<Uint8Array> {
  await page.locator('form input[type="file"]').first().setInputFiles({
    name: "source-or-numbered.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf),
  });
  await page.getByLabel("Pagine (facoltativo)").fill(String(pageNumber));
  await page.getByLabel("Scala render").fill("1");
  await page.locator('form button[type="submit"]').first().click();
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 40_000 });
  return download(page, `Scarica page-${String(pageNumber).padStart(3, "0")}.png`);
}

async function pixelDiff(before: Uint8Array, after: Uint8Array): Promise<{ count: number; box: [number, number, number, number] | null }> {
  const a = await sharp(Buffer.from(before)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(Buffer.from(after)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert(a.info.width === b.info.width && a.info.height === b.info.height, "Raster dimensions changed");
  let count = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < a.info.height; y++) {
    for (let x = 0; x < a.info.width; x++) {
      const i = (y * a.info.width + x) * 4;
      const drift = Math.max(Math.abs(a.data[i]! - b.data[i]!), Math.abs(a.data[i + 1]! - b.data[i + 1]!), Math.abs(a.data[i + 2]! - b.data[i + 2]!));
      if (drift <= 24) continue;
      count++;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return { count, box: count === 0 ? null : [minX, minY, maxX, maxY] };
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await waitServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`JS: ${error.message}`));
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) failures.push(`offsite: ${url}`);
    if (request.method() !== "GET") failures.push(`non-GET: ${request.method()}`);
  });
  const response = await page.goto(`${origin}/tools/pdf-page-numbers/`, { waitUntil: "networkidle" });
  assert(response?.status() === 200, "Numbering route did not load");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px viewport overflow");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "four-pages.pdf", mimeType: "application/pdf", buffer: fixture });
  await page.getByLabel("Pagine da numerare").fill("3-2");
  await page.getByRole("alert").filter({ hasText: /intervallo|decrescente/iu }).waitFor({ timeout: 20_000 });
  assert(await page.getByRole("button", { name: "Applica numerazione" }).isDisabled(), "Invalid range allowed write");

  await page.getByLabel("Pagine da numerare").fill("2-3");
  await page.getByLabel("Numero iniziale").fill("10");
  await page.getByLabel("Offset numerazione").fill("3");
  await page.getByLabel("Posizione").selectOption("bottom-right");
  await page.locator('select:has(option[value="Courier"])').selectOption("Courier");
  await page.getByLabel("Dimensione font (pt)").fill("20");
  await page.getByLabel("Margine (pt)").fill("18");
  await page.locator('[data-number-preview-page="2"] img').waitFor({ timeout: 30_000 });
  assert(await page.locator('[data-number-overlay-page="2"] text').textContent() === "13", "Preview 2 number wrong");
  assert(await page.locator('[data-number-overlay-page="3"] text').textContent() === "14", "Preview 3 number wrong");
  assert(await page.locator('[data-number-overlay-page="1"]').count() === 0, "Unselected page had preview overlay");
  await page.locator('[data-number-preview-page="2"]').screenshot({ path: screenshotPreview });

  await page.getByRole("button", { name: "Applica numerazione" }).click();
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 30_000 });
  const numbered = await download(page, "Scarica PDF numerato");
  const before = inspectPdfBytes(fixture);
  const after = inspectPdfBytes(numbered);
  assert(after.pageCount === 4 && after.pages.every((p, i) => p.width === before.pages[i]?.width && p.height === before.pages[i]?.height), "Output PDF geometry changed");
  const sourceContents = originalStreams(fixture);
  const updatedContents = originalStreams(numbered);
  assert(JSON.stringify(updatedContents.map((c) => c.length)) === "[1,2,2,1]", "Overlay was not isolated on exactly selected pages");
  for (let p = 0; p < 4; p++) assert(Buffer.from(updatedContents[p]![0]!).equals(Buffer.from(sourceContents[p]![0]!)), `Original page ${p + 1} stream modified`);
  const text = await extractPdfText(numbered);
  assert(text[0]?.text.includes("SOURCE-ONE") && text[1]?.text.includes("SOURCE-TWO") && text[2]?.text.includes("SOURCE-THREE"), "Original text lost");

  await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" });
  const differences: Record<number, { count: number; box: [number, number, number, number] | null }> = {};
  for (const pageNumber of [1, 2, 3]) {
    const originalPng = await rasterPage(page, fixture, pageNumber);
    const numberedPng = await rasterPage(page, numbered, pageNumber);
    differences[pageNumber] = await pixelDiff(originalPng, numberedPng);
    if (pageNumber === 2) await writeFile(screenshotRendered, Buffer.from(numberedPng));
  }
  assert(differences[1]!.count === 0, `Unselected page visually changed: ${JSON.stringify(differences[1])}`);
  for (const p of [2, 3]) {
    const result = differences[p]!;
    assert(result.count >= 15 && result.box !== null, `Number on page ${p} not visible`);
    assert(result.box[0] >= 250 && result.box[1] >= 390 && result.box[2] <= 310 && result.box[3] <= 432,
      `Number on page ${p} outside bottom-right expected region: ${result.box}`);
  }
  assert(failures.length === 0, `Unexpected network/browser issues: ${failures.join(" | ")}`);
  console.log(JSON.stringify({ status: "PASS", browser: "desktop Chromium at 390x844", physicalDeviceTested: false,
    pages: after.pageCount, numbered: [2, 3], labels: [13, 14], sourceBytes: fixture.length,
    outputBytes: numbered.byteLength, pixelDiff: differences, screenshotPreview, screenshotRendered, offsite: 0 }, null, 2));
  await context.close();
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
