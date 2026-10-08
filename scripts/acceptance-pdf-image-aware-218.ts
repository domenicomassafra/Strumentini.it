/**
 * Browser acceptance for #218, NOT Gold/physical-device certification.
 * Run: npx tsx scripts/acceptance-pdf-image-aware-218.ts
 * Run after npm run build. Uses a localhost static server and desktop Chromium
 * at a 390px viewport; it is not a physical-device or Gold certification.
 */
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { resolve } from "node:path";
import { extractPdfText, inspectPdfBytes } from "../src/engines/pdf";
import { parsePdf, pdfArray, pdfDict, pdfName, pdfNumber, nameValue } from "../src/engines/pdf/parser";
import { PdfBuilder } from "../src/engines/pdf/writer";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_JPEG_PORT ?? 18495);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid PDF JPEG test port");
const origin = `http://127.0.0.1:${port}`;
const width = 320;
const height = 240;
const rgb = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 3;
    rgb[i] = (x * 7 + y * 3 + (x ^ y) * 11) % 256;
    rgb[i + 1] = (x * 11 + y * 13 + (x ^ (y * 3)) * 5) % 256;
    rgb[i + 2] = (x * 17 + y * 5 + ((x + y) % 17) * 9) % 256;
  }
}

function createFixture(jpeg: Uint8Array, filter: "DCTDecode" | "FlateDecode" = "DCTDecode"): Uint8Array {
  const builder = new PdfBuilder();
  const rootReference = builder.reserve();
  const pagesReference = builder.reserve();
  const pageReference = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(width), Height: pdfNumber(height),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName(filter),
  }), bytes: jpeg });
  const contents = builder.putAuto({ kind: "stream", dictionary: pdfDict({}), bytes: new TextEncoder().encode(
    "q 320 0 0 240 0 0 cm /Im0 Do Q\nBT /F1 18 Tf 12 260 Td (BROWSER-VECTOR-TEXT) Tj ET\n") });
  builder.put(pageReference, pdfDict({ Type: pdfName("Page"), Parent: pagesReference,
    MediaBox: pdfArray([pdfNumber(0), pdfNumber(0), pdfNumber(320), pdfNumber(300)]),
    Resources: pdfDict({ Font: pdfDict({ F1: font }), XObject: pdfDict({ Im0: image }) }), Contents: contents }));
  builder.put(pagesReference, pdfDict({ Type: pdfName("Pages"), Kids: pdfArray([pageReference]), Count: pdfNumber(1) }));
  builder.put(rootReference, pdfDict({ Type: pdfName("Catalog"), Pages: pagesReference }));
  return builder.build(rootReference, null);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function getJpeg(bytes: Uint8Array): Uint8Array {
  const model = parsePdf(bytes);
  const images = [...model.objects.values()].filter((object) => object.value.kind === "stream" &&
    nameValue(object.value.dictionary.entries.get("Subtype")) === "Image");
  assert(images.length === 1, `Expected one Image XObject, got ${images.length}`);
  const value = images[0]!.value;
  assert(value.kind === "stream", "JPEG image object is not a stream");
  return value.bytes;
}

async function download(page: Page): Promise<Uint8Array> {
  const link = page.getByRole("link", { name: /Scarica .*\.pdf/u }).first();
  const event = page.waitForEvent("download", { timeout: 20_000 });
  await link.click();
  const file = await event;
  assert(file.suggestedFilename().endsWith(".pdf"), "Download filename is not a PDF");
  return new Uint8Array(await readFile(await file.path()));
}

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" });

async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Local Astro server exited: ${server.exitCode}`);
    try {
      const response = await fetch(`${origin}/tools/pdf-compression-lite/`);
      if (response.ok && (await response.text()).includes("pdf-compression-lite")) return;
    } catch { /* startup */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("Built local static route did not start; run npm run build first");
}

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let result: Record<string, unknown> = { test: "pdf-image-aware-218-browser", status: "FAIL", physicalDeviceTested: false };
try {
  const highQualityJpeg = new Uint8Array(await sharp(rgb, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100 }).toBuffer());
  const source = createFixture(highQualityJpeg);
  await ready();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: false, acceptDownloads: true });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`JS error: ${error.message}`));
    page.on("request", (request) => {
      const url = request.url();
      if (!(url.startsWith(origin) || url.startsWith("blob:") || url.startsWith("data:"))) errors.push(`Offsite: ${url}`);
      if (request.method() !== "GET") errors.push(`Unexpected non-GET: ${request.method()} ${url}`);
    });
    const response = await page.goto(`${origin}/tools/pdf-compression-lite/`, { waitUntil: "networkidle" });
    assert(response?.status() === 200, "PDF compression route unavailable");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px viewport overflow");
    const upload = { name: "image-and-vector.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) };
    await page.locator('form input[type="file"]').first().setInputFiles(upload);
    const profile = page.locator('select:has(option[value="jpeg-rgb-reencode"])');
    await profile.waitFor({ timeout: 30_000 });
    assert(await profile.inputValue() === "structural-only", "Structural mode is not the default");
    const structuralStart = performance.now();
    await page.locator('form button[type="submit"]').first().click();
    const resultPanel = page.locator('.result-panel[data-state="success"], .result-panel[data-state="error"]');
    await resultPanel.waitFor({ timeout: 45_000 });
    assert(await resultPanel.getAttribute("data-state") === "success",
      `Structural default returned error: ${(await page.getByRole("alert").allInnerTexts()).join(" | ")} / ${errors.join(" | ")}`);
    const structural = await download(page);
    assert(Buffer.from(getJpeg(structural)).equals(Buffer.from(highQualityJpeg)), "Default mode modified JPEG bytes");
    assert((await extractPdfText(structural))[0]?.text.includes("BROWSER-VECTOR-TEXT"), "Default mode lost text");

    await profile.selectOption("jpeg-rgb-reencode");
    await page.locator('input[type="number"][min="0.35"][max="0.85"]').fill("0.45");
    const lossStart = performance.now();
    await page.locator('form button[type="submit"]').first().click();
    await resultPanel.waitFor({ timeout: 45_000 });
    assert(await resultPanel.getAttribute("data-state") === "success",
      `JPEG path returned error: ${(await page.getByRole("alert").allInnerTexts()).join(" | ")} / ${errors.join(" | ")}`);
    const optimized = await download(page);
    assert(optimized.byteLength < source.byteLength, "JPEG profile did not reduce PDF bytes");
    const before = inspectPdfBytes(source);
    const after = inspectPdfBytes(optimized);
    assert(after.pageCount === before.pageCount && after.pages[0]?.width === before.pages[0]?.width &&
      after.pages[0]?.height === before.pages[0]?.height, "Page geometry changed");
    assert((await extractPdfText(optimized))[0]?.text.includes("BROWSER-VECTOR-TEXT"), "JPEG profile lost vector text");
    const jpegAfter = getJpeg(optimized);
    assert(jpegAfter.byteLength < highQualityJpeg.byteLength, "Embedded JPEG was not recompressed");
    const decodedA = await sharp(Buffer.from(highQualityJpeg)).raw().toBuffer();
    const decodedB = await sharp(Buffer.from(jpegAfter)).raw().toBuffer();
    assert(decodedA.length === decodedB.length, "Embedded image dimensions changed");
    let errorSum = 0;
    for (let i = 0; i < decodedA.length; i += 1) errorSum += Math.abs(decodedA[i]! - decodedB[i]!);
    const meanPixelDelta = errorSum / decodedA.length;
    assert(meanPixelDelta < 45, `Excessive image pixel delta ${meanPixelDelta}`);
    const summary = await page.locator('[data-result-slot="operation-summary"]').innerText();
    assert(/JPEG effettivamente ricodificati\s*1/u.test(summary) && /JPEG\/immagini lasciati invariati\s*0/u.test(summary),
      `Image inventory not surfaced: ${summary}`);
    // Second, independent browser path: lossless Flate/PNG-style raw RGB scan
    // must become a smaller actual JPEG with visible gray/downsample settings.
    const scanPdf = createFixture(new Uint8Array(deflateSync(rgb)), "FlateDecode");
    await page.locator('form input[type="file"]').first().setInputFiles({
      name: "scan-with-vector-text.pdf", mimeType: "application/pdf", buffer: Buffer.from(scanPdf),
    });
    await profile.selectOption("scan-flate-to-jpeg");
    await page.getByLabel("Lato lungo massimo dell'immagine (pixel)").fill("256");
    await page.getByLabel("Converti le immagini idonee in grigio").check();
    await page.locator('form button[type="submit"]').first().click();
    await resultPanel.waitFor({ timeout: 45_000 });
    assert(await resultPanel.getAttribute("data-state") === "success",
      `Flate scan path returned error: ${(await page.getByRole("alert").allInnerTexts()).join(" | ")} / ${errors.join(" | ")}`);
    const scanOutput = await download(page);
    assert(scanOutput.byteLength < scanPdf.byteLength, "Flate scan PDF did not become smaller");
    const scanBefore = inspectPdfBytes(scanPdf);
    const scanAfter = inspectPdfBytes(scanOutput);
    assert(scanBefore.pageCount === scanAfter.pageCount &&
      scanBefore.pages[0]?.width === scanAfter.pages[0]?.width &&
      scanBefore.pages[0]?.height === scanAfter.pages[0]?.height, "Scan PDF geometry changed");
    assert((await extractPdfText(scanOutput))[0]?.text.includes("BROWSER-VECTOR-TEXT"), "Scan conversion lost vector text");
    const scanModel = parsePdf(scanOutput);
    const embedded = [...scanModel.objects.values()].find((object) => object.value.kind === "stream" &&
      nameValue(object.value.dictionary.entries.get("Subtype")) === "Image")?.value;
    assert(embedded?.kind === "stream" && nameValue(embedded.dictionary.entries.get("Filter")) === "DCTDecode",
      "Flate scan did not produce an actual DCTDecode image");
    const decodedScan = await sharp(Buffer.from(embedded.bytes)).raw().toBuffer({ resolveWithObject: true });
    assert(decodedScan.info.width === 256 && decodedScan.info.height === 192, "Downsample dimensions incorrect");
    let grayError = 0;
    for (let i = 0; i < decodedScan.info.width * decodedScan.info.height; i += 1) {
      const offset = i * decodedScan.info.channels;
      grayError += Math.abs(decodedScan.data[offset]! - decodedScan.data[offset + 1]!) +
        Math.abs(decodedScan.data[offset]! - decodedScan.data[offset + 2]!);
    }
    grayError /= decodedScan.info.width * decodedScan.info.height;
    assert(grayError < 3, `Grayscale request did not produce gray scan JPEG: ${grayError}`);
    const scanSummary = await page.locator('[data-result-slot="operation-summary"]').innerText();
    assert(/Immagini Flate ricodificate\s*1/u.test(scanSummary) &&
      /Downsample applicato\s*Sì/u.test(scanSummary) &&
      /Grigio applicato\s*Sì/u.test(scanSummary),
      `Scan inventory and effective settings not displayed: ${scanSummary}`);
    // Independent real PDF.js page render of the downloaded source/output:
    // keep the vector/text page rendered, while lossy grayscale visibly differs.
    await page.goto(`${origin}/tools/pdf-to-images/`, { waitUntil: "networkidle" });
    async function renderActualPdf(pdf: Uint8Array): Promise<{ hash: string; bytes: number; width: number; height: number }> {
      await page.locator('form input[type="file"]').first().setInputFiles({
        name: "scan-render-verification.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf),
      });
      await page.getByLabel("Formato uscita").selectOption("image/png");
      await page.getByLabel("Scala render").fill("1");
      await page.locator('form button[type="submit"]').first().click();
      const renderPanel = page.locator('.result-panel[data-state="success"], .result-panel[data-state="error"]');
      await renderPanel.waitFor({ timeout: 45_000 });
      assert(await renderPanel.getAttribute("data-state") === "success", "PDF.js render failed for scan PDF");
      const event = page.waitForEvent("download", { timeout: 20000 });
      await page.getByRole("link", { name: "Scarica page-001.png", exact: true }).click();
      const file = await event;
      const png = await readFile(await file.path());
      const decoded = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      let checksum = 2166136261;
      for (const byte of decoded.data) checksum = Math.imul(checksum ^ byte, 16777619) >>> 0;
      return { hash: checksum.toString(16), bytes: png.length, width: decoded.info.width, height: decoded.info.height };
    }
    const sourceRendered = await renderActualPdf(scanPdf);
    const resultRendered = await renderActualPdf(scanOutput);
    assert(sourceRendered.bytes > 2000 && resultRendered.bytes > 2000, "PDF.js rendered blank/small scan output");
    assert(sourceRendered.width === resultRendered.width && sourceRendered.height === resultRendered.height,
      "Source/output PDF.js page render dimensions differ");
    assert(sourceRendered.hash !== resultRendered.hash, "Lossy grayscale scan rendered identically to colored source");
    assert(errors.length === 0, `Browser errors or offsite requests: ${errors.join(" | ")}`);
    result = { test: "pdf-image-aware-218-browser", status: "PASS", browser: "desktop-chromium-headless",
      viewport: [390, 844], sourceBytes: source.byteLength, structuralBytes: structural.byteLength,
      optimizedBytes: optimized.byteLength, sourceJpegBytes: highQualityJpeg.byteLength, optimizedJpegBytes: jpegAfter.byteLength,
      meanPixelDelta, touched: 1, skipped: 0, defaultPreservedOriginalJpeg: true, noOffsiteRequests: true,
      elapsedStructuralMs: Math.round(lossStart - structuralStart), elapsedJpegMs: Math.round(performance.now() - lossStart),
      scanSourceBytes: scanPdf.byteLength, scanOutputBytes: scanOutput.byteLength,
      scanPixels: [decodedScan.info.width, decodedScan.info.height], scanGrayscaleMeanDelta: grayError,
      scanTouched: 1, scanSkipped: 0, pdfJsRenderedSource: sourceRendered,
      pdfJsRenderedOutput: resultRendered, physicalDeviceTested: false };
  } finally {
    await context.close();
  }
} catch (error) {
  result = { ...result, failure: error instanceof Error ? error.stack ?? error.message : String(error) };
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  console.log(JSON.stringify(result, null, 2));
}
