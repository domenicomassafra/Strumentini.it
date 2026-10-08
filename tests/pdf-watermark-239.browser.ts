/**
 * #239 real browser acceptance, independently downloads PDF and uses PDF.js
 * PDF-to-images route to confirm painted pixels. Desktop Chromium at 390px;
 * neither Gold nor physical-device acceptance. Run after static astro build.
 */
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { parsePdf, resolveReference, numberValue, nameValue } from "../src/engines/pdf/parser";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_WM239_PORT ?? 18497);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
const origin = `http://127.0.0.1:${port}`;
const fixture = Buffer.from(createSimplePdf(["SOURCE-A", "SOURCE-B", "SOURCE-C", "SOURCE-D"], { width: 440, height: 600 }));
const screenshotPreview = "/tmp/str239-watermark-preview.png";
const screenshotRendered = "/tmp/str239-watermark-page2.png";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function contents(bytes: Uint8Array): Uint8Array[][] {
  const model = parsePdf(bytes);
  return model.pages.map((page) => {
    const value = page.object.value;
    if (value.kind !== "dict") throw new Error("Invalid page dictionary");
    const original = value.entries.get("Contents");
    const resolved = resolveReference(model, original);
    const parts = resolved?.kind === "array" ? resolved.items : [original];
    return parts.map((item) => {
      const stream = resolveReference(model, item);
      if (stream?.kind !== "stream") throw new Error("Invalid content stream");
      return stream.bytes;
    });
  });
}

async function waitServer() {
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(`${origin}/tools/pdf-watermark/`)).ok) return; } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Compiled watermark route missing");
}

async function download(page: Page, label: string): Promise<Uint8Array> {
  const event = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("link", { name: label, exact: true }).click();
  return new Uint8Array(await readFile(await (await event).path()));
}

async function raster(page: Page, bytes: Uint8Array, pageNumber: number): Promise<Uint8Array> {
  await page.locator('form input[type="file"]').first().setInputFiles({
    name: "source-or-watermark.pdf", mimeType: "application/pdf", buffer: Buffer.from(bytes),
  });
  await page.getByLabel("Pagine (facoltativo)").fill(String(pageNumber));
  await page.getByLabel("Scala render").fill("1");
  await page.locator('form button[type="submit"]').first().click();
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 35_000 });
  return download(page, `Scarica page-${String(pageNumber).padStart(3, "0")}.png`);
}

async function diff(a: Uint8Array, b: Uint8Array): Promise<{ count: number; box: [number, number, number, number] | null; avgRedDelta: number }> {
  const original = await sharp(Buffer.from(a)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const changed = await sharp(Buffer.from(b)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert(original.info.width === changed.info.width && original.info.height === changed.info.height, "Raster geometry changed");
  let count = 0, left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, sum = 0;
  for (let y = 0; y < original.info.height; y++) {
    for (let x = 0; x < original.info.width; x++) {
      const i = (y * original.info.width + x) * 3;
      const delta = Math.abs(original.data[i]! - changed.data[i]!);
      if (delta < 14) continue;
      count++; sum += delta; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return { count, box: count === 0 ? null : [left, top, right, bottom], avgRedDelta: count ? Math.round(sum / count) : 0 };
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root, stdio: "ignore",
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await waitServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, isMobile: false });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`js:${error.message}`));
    page.on("request", (request) => {
      const url = request.url();
      if (!(url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:"))) errors.push(`offsite:${url}`);
      if (request.method() !== "GET") errors.push(`method:${request.method()}`);
    });
    const response = await page.goto(`${origin}/tools/pdf-watermark/`, { waitUntil: "networkidle" });
    assert(response?.status() === 200, "Watermark route returned non-200");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px horizontal overflow");
    const warning = (await page.locator('[data-not-redaction]').innerText()).toLowerCase();
    assert(warning.includes("non") && warning.includes("redazione"), "Missing visible not-redaction warning");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "four-pages.pdf", mimeType: "application/pdf", buffer: fixture });
    await page.locator('label:has(> span:text-is("Pagine")) input').fill("3-2");
    await page.getByRole("alert").filter({ hasText: /decrescente|intervallo/iu }).waitFor({ timeout: 20_000 });
    assert(await page.getByRole("button", { name: "Applica filigrana" }).isDisabled(), "Invalid range permits export");
    await page.locator('label:has(> span:text-is("Pagine")) input').fill("2-3");
    await page.locator('label:has(> span:text-is("Testo filigrana")) input').fill("DRAFT");
    await page.locator('input[min="0.1"][max="1"]').fill("0.45");
    await page.locator('input[min="-180"][max="180"]').fill("0");
    await page.locator('input[min="0.5"][max="3"]').fill("1");
    await page.locator('select:has(option[value="center"])').selectOption("center");
    await page.locator('[data-watermark-preview-page="2"] img').waitFor({ timeout: 30_000 });
    assert(await page.locator('[data-watermark-overlay-page="2"] text').textContent() === "DRAFT", "Preview text wrong");
    assert(await page.locator('[data-watermark-overlay-page="1"]').count() === 0, "Unselected page preview contains watermark");
    await page.locator('[data-watermark-preview-page="2"]').screenshot({ path: screenshotPreview });
    await page.getByRole("button", { name: "Applica filigrana" }).click();
    await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 30_000 });
    const pdf = await download(page, "Scarica PDF con filigrana");
    const before = inspectPdfBytes(fixture), after = inspectPdfBytes(pdf);
    assert(after.pageCount === before.pageCount && after.pages.every((value, i) =>
      value.width === before.pages[i]?.width && value.height === before.pages[i]?.height && value.rotation === before.pages[i]?.rotation), "Page count/geometry changed");
    const sourceContents = contents(fixture), outputContents = contents(pdf);
    assert(JSON.stringify(outputContents.map((p) => p.length)) === "[1,2,2,1]", "Watermark streams not isolated");
    for (let p = 0; p < sourceContents.length; p++) {
      assert(Buffer.from(sourceContents[p]![0]!).equals(Buffer.from(outputContents[p]![0]!)), `Original page ${p + 1} mutated`);
    }
    const pdfModel = parsePdf(pdf);
    const gs = [...pdfModel.objects.values()].find((object) => object.value.kind === "dict" &&
      nameValue(object.value.entries.get("Type")) === "ExtGState");
    assert(gs?.value.kind === "dict" && numberValue(gs.value.entries.get("ca")) === 0.45, "Transparency not encoded in PDF");
    const text = await extractPdfText(pdf);
    assert(text[0]?.text.includes("SOURCE-A") && text[1]?.text.includes("SOURCE-B") && text[2]?.text.includes("SOURCE-C"), "Source PDF text lost");

    await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" });
    const rasterBefore1 = await raster(page, fixture, 1), rasterAfter1 = await raster(page, pdf, 1);
    const rasterBefore2 = await raster(page, fixture, 2), rasterAfter2 = await raster(page, pdf, 2);
    const untouched = await diff(rasterBefore1, rasterAfter1);
    const marked = await diff(rasterBefore2, rasterAfter2);
    assert(untouched.count === 0, `Untouched page changed pixels: ${JSON.stringify(untouched)}`);
    assert(marked.count >= 70 && marked.box !== null, "Watermark has no real visible pixels");
    assert(marked.box[0] >= 120 && marked.box[2] <= 325 && marked.box[1] >= 190 && marked.box[3] <= 410,
      `Watermark rendered outside expected center region: ${JSON.stringify(marked)}`);
    await writeFile(screenshotRendered, Buffer.from(rasterAfter2));
    assert(errors.length === 0, `Browser errors or network requests: ${errors.join(" | ")}`);
    console.log(JSON.stringify({ status: "PASS", browser: "desktop Chromium", viewport: [390, 844], physicalDeviceTested: false,
      sourceBytes: fixture.length, outputBytes: pdf.length, selected: [2, 3], opacity: 0.45,
      untouched, marked, screenshots: [screenshotPreview, screenshotRendered], offsite: errors.length }, null, 2));
  } finally { await context.close(); }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
