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

function createFixture(jpeg: Uint8Array): Uint8Array {
  const builder = new PdfBuilder();
  const rootReference = builder.reserve();
  const pagesReference = builder.reserve();
  const pageReference = builder.reserve();
  const font = builder.putAuto(pdfDict({ Type: pdfName("Font"), Subtype: pdfName("Type1"), BaseFont: pdfName("Helvetica") }));
  const image = builder.putAuto({ kind: "stream", dictionary: pdfDict({
    Type: pdfName("XObject"), Subtype: pdfName("Image"), Width: pdfNumber(width), Height: pdfNumber(height),
    ColorSpace: pdfName("DeviceRGB"), BitsPerComponent: pdfNumber(8), Filter: pdfName("DCTDecode"),
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
    assert(errors.length === 0, `Browser errors or offsite requests: ${errors.join(" | ")}`);
    result = { test: "pdf-image-aware-218-browser", status: "PASS", browser: "desktop-chromium-headless",
      viewport: [390, 844], sourceBytes: source.byteLength, structuralBytes: structural.byteLength,
      optimizedBytes: optimized.byteLength, sourceJpegBytes: highQualityJpeg.byteLength, optimizedJpegBytes: jpegAfter.byteLength,
      meanPixelDelta, touched: 1, skipped: 0, defaultPreservedOriginalJpeg: true, noOffsiteRequests: true,
      elapsedStructuralMs: Math.round(lossStart - structuralStart), elapsedJpegMs: Math.round(performance.now() - lossStart),
      physicalDeviceTested: false };
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
