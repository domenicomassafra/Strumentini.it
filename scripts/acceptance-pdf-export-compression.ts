/**
 * Real browser/output acceptance for #236 raster export and the bounded #218
 * structural compression path. Requires a current `npm run build` first.
 * Validates downloaded bytes, image decoders and PDF.js-rendered pixel parity;
 * does NOT certify image-aware recompression or a physical mobile device.
 */
import { chromium, firefox, webkit, type Page, type BrowserContext } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
import { createSimplePdf, extractPdfText, inspectPdfBytes } from "../src/engines/pdf";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_PDF_EXPORT_PORT ?? 18487);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid PDF export acceptance port");
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const synthetic = Buffer.from(createSimplePdf(["ALPHA", "BETA", "GAMMA"], { width: 192, height: 144 }));
const jpegFixture = await readFile(resolve(root, "quality/fixtures/pdf-gold/jpeg-1page.pdf"));
const pdfUpload = (bytes: Uint8Array, name = "source.pdf") => ({ name, mimeType: "application/pdf", buffer: Buffer.from(bytes) });
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${origin}/tools/pdf-to-images/`);
      if (response.ok && (await response.text()).includes("pdf-to-images")) return;
    } catch { /* server startup */ }
    await pause(100);
  }
  throw new Error("PDF export acceptance needs a current static build (`npm run build`)");
}

interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly corner: readonly number[];
  readonly distinctFromBackground: number;
  readonly pixelHash: string;
}

async function decodeImage(page: Page, bytes: Uint8Array, mime: string, background: readonly number[]): Promise<DecodedImage> {
  return page.evaluate(async ({ encoded, mime, background }) => {
    const bin = atob(encoded);
    const bytes = Uint8Array.from(bin, (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx === null) throw new Error("Image decode canvas unavailable");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    let nonBackground = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      for (let channel = 0; channel < 4; channel += 1) {
        hash = Math.imul(hash ^ pixels[index + channel]!, 16777619) >>> 0;
      }
      if (Math.abs(pixels[index]! - background[0]!) > 30 ||
          Math.abs(pixels[index + 1]! - background[1]!) > 30 ||
          Math.abs(pixels[index + 2]! - background[2]!) > 30) nonBackground += 1;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      corner: Array.from(pixels.subarray(0, 4)),
      distinctFromBackground: nonBackground,
      pixelHash: hash.toString(16).padStart(8, "0"),
    };
  }, { encoded: Buffer.from(bytes).toString("base64"), mime, background: [...background] });
}

function expectEncodedImage(bytes: Uint8Array, mime: "image/png" | "image/jpeg" | "image/webp"): void {
  const valid = mime === "image/png"
    ? bytes.length > 24 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === "image/jpeg"
      ? bytes.length > 20 && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217
      : bytes.length > 20 && Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP";
  if (!valid) throw new Error(`Downloaded ${mime} has invalid encoded signature`);
}

async function download(page: Page, filename: string): Promise<Uint8Array> {
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: `Scarica ${filename}`, exact: true }).click();
  const download = await event;
  if (download.suggestedFilename() !== filename) throw new Error(`Unexpected download filename: ${download.suggestedFilename()}`);
  return new Uint8Array(await readFile(await download.path()));
}

async function openTool(context: BrowserContext, tool: "pdf-to-images" | "pdf-compression-lite", failures: string[]): Promise<Page> {
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) failures.push(`External request: ${request.url()}`);
    if (request.method() !== "GET") failures.push(`Unexpected ${request.method()} request: ${request.url()}`);
  });
  const response = await page.goto(`${origin}/tools/${tool}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`Unavailable ${tool} route`);
  return page;
}

async function exportPages(
  page: Page,
  source: Uint8Array,
  options: { pages: string; mime: "image/png" | "image/jpeg" | "image/webp"; scale: string; background: string },
  expectedStatus: "success" | "error" = "success",
): Promise<void> {
  await page.locator('form input[type="file"]').first().setInputFiles(pdfUpload(source));
  await page.getByLabel("Pagine (facoltativo)").fill(options.pages);
  await page.getByLabel("Formato uscita").selectOption(options.mime);
  await page.getByLabel("Scala render").fill(options.scale);
  await page.getByLabel("Sfondo raster").fill(options.background);
  await page.locator('form button[type="submit"]').first().click();
  const panel = page.locator(".result-panel[data-state='success'], .result-panel[data-state='error']");
  await panel.waitFor({ timeout: 30000 });
  if (await panel.getAttribute("data-state") !== expectedStatus) {
    throw new Error(`Unexpected raster export status (${options.mime}, ${options.scale}x, expected ${expectedStatus}): ${(await page.getByRole("alert").allInnerTexts()).join(" ")}`);
  }
}

async function verifyRaster(
  page: Page,
  filename: string,
  mime: "image/png" | "image/jpeg" | "image/webp",
  expected: { width: number; height: number; background: readonly number[] },
): Promise<{ bytes: Uint8Array; decoded: DecodedImage }> {
  const bytes = await download(page, filename);
  expectEncodedImage(bytes, mime);
  const decoded = await decodeImage(page, bytes, mime, expected.background);
  if (decoded.width !== expected.width || decoded.height !== expected.height) {
    throw new Error(`Wrong ${filename} dimensions: ${decoded.width}x${decoded.height} expected ${expected.width}x${expected.height}`);
  }
  if (decoded.corner.slice(0, 3).some((value, index) => Math.abs(value! - expected.background[index]!) > (mime === "image/png" ? 0 : 30))) {
    throw new Error(`Wrong ${filename} background pixel: ${decoded.corner.join(", ")}`);
  }
  if (decoded.distinctFromBackground === 0) throw new Error(`Blank output image: ${filename}`);
  return { bytes, decoded };
}

let assertions = 0;
try {
  await waitForServer();
  for (const [browserName, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const failures: string[] = [];
    let webpRefused = false;
    try {
      const page = await openTool(context, "pdf-to-images", failures);
      await exportPages(page, synthetic, { pages: "3,1-2", mime: "image/png", scale: "1", background: "#12ab34" });
      const pages = new Map<string, Uint8Array>();
      const pixelHashes = new Set<string>();
      for (const pageNumber of [3, 1, 2]) {
        const filename = `page-${String(pageNumber).padStart(3, "0")}.png`;
        const result = await verifyRaster(page, filename, "image/png", { width: 192, height: 144, background: [18, 171, 52] });
        pages.set(filename, result.bytes);
        pixelHashes.add(result.decoded.pixelHash);
        assertions += 1;
      }
      if (pixelHashes.size !== 3) throw new Error("Different source pages rendered identical image pixels");
      const zip = unzipSync(await download(page, "pdf-pages.zip"));
      if (Object.keys(zip).join(",") !== "page-003.png,page-001.png,page-002.png") throw new Error(`ZIP lost selected page order: ${Object.keys(zip).join(",")}`);
      for (const [filename, bytes] of pages) {
        if (!Buffer.from(zip[filename] ?? []).equals(Buffer.from(bytes))) throw new Error(`ZIP ${filename} differs from downloaded image`);
      }
      assertions += 2;

      for (const invalid of ["2,2", "3-1", "1-4", "1,broken"]) {
        await page.getByLabel("Pagine (facoltativo)").fill(invalid);
        await page.locator('form button[type="submit"]').first().click();
        await page.locator(".result-panel[data-state='error']").waitFor({ timeout: 15000 });
        if (await page.getByRole("link", { name: "Scarica pdf-pages.zip" }).count() !== 0) throw new Error(`Stale ZIP visible after invalid range ${invalid}`);
        const alertText = (await page.getByRole("alert").allInnerTexts()).join(" ");
        if (!/operazione|errore|pagin|ripetut|intervall|token/iu.test(alertText)) throw new Error(`Invalid range ${invalid} did not produce an error: ${alertText}`);
        assertions += 1;
      }

      for (const config of [
        { mime: "image/jpeg" as const, ext: "jpg", scale: "0.5", dimension: [96, 72], background: "#cc3311", rgb: [204, 51, 17] },
        { mime: "image/webp" as const, ext: "webp", scale: "1.5", dimension: [288, 216], background: "#1177ee", rgb: [17, 119, 238] },
      ]) {
        const webpSupported = await page.evaluate(() => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          return canvas.toDataURL("image/webp").startsWith("data:image/webp");
        });
        const refusesWebp = config.mime === "image/webp" && !webpSupported;
        await exportPages(page, synthetic, { pages: "2", mime: config.mime, scale: config.scale, background: config.background }, refusesWebp ? "error" : "success");
        if (refusesWebp) {
          webpRefused = true;
          const alertText = (await page.getByRole("alert").allInnerTexts()).join(" ");
          if (!alertText.includes("non può esportare pagine PDF in WebP")) throw new Error(`Unsupported WebP error is not actionable: ${alertText}`);
          if (await page.getByRole("link", { name: /Scarica page-/u }).count() !== 0) throw new Error("WebP rejection exposed a stale image download");
        } else {
          await verifyRaster(page, `page-002.${config.ext}`, config.mime, { width: config.dimension[0]!, height: config.dimension[1]!, background: config.rgb });
        }
        if (await page.getByRole("link", { name: "Scarica pdf-pages.zip" }).count() > 0) throw new Error("One-page export must not expose stale ZIP");
        assertions += 2;
      }

      const compressor = await openTool(context, "pdf-compression-lite", failures);
      for (const source of [synthetic, jpegFixture]) {
        await compressor.locator('form input[type="file"]').first().setInputFiles(pdfUpload(source));
        await compressor.locator('form button[type="submit"]').first().click();
        await compressor.locator(".result-panel[data-state='success']").waitFor({ timeout: 30000 });
        const pdfLink = compressor.getByRole("link", { name: /Scarica .*\.pdf/u }).first();
        const pdfName = (await pdfLink.innerText()).replace(/^Scarica\s+/u, "");
        const compressed = await download(compressor, pdfName);
        const before = inspectPdfBytes(source);
        const after = inspectPdfBytes(compressed);
        if (before.pageCount !== after.pageCount || before.pages.some((entry, index) =>
          entry.width !== after.pages[index]?.width || entry.height !== after.pages[index]?.height || entry.rotation !== after.pages[index]?.rotation)) {
          throw new Error("Downloaded structurally compressed PDF changed page count or geometry");
        }
        const beforeText = (await extractPdfText(source)).map((page) => page.text);
        const afterText = (await extractPdfText(compressed)).map((page) => page.text);
        if (JSON.stringify(beforeText) !== JSON.stringify(afterText)) throw new Error("Compressed PDF lost extracted text");
        assertions += 2;

        // Independent real PDF.js rasterization of both downloaded and source PDFs.
        // Compares decoded pixels, including the embedded JPEG fixture (without
        // pretending any embedded image was recompressed by the compressor).
        const imagesBefore: string[] = [];
        const imagesAfter: string[] = [];
        for (const [candidate, results] of [[source, imagesBefore], [compressed, imagesAfter]] as const) {
          await exportPages(page, candidate, { pages: "", mime: "image/png", scale: "0.5", background: "#ffffff" });
          for (let number = 1; number <= before.pageCount; number += 1) {
            const filename = `page-${String(number).padStart(3, "0")}.png`;
            const bytes = await download(page, filename);
            expectEncodedImage(bytes, "image/png");
            const decoded = await decodeImage(page, bytes, "image/png", [255, 255, 255]);
            results.push(`${decoded.width}x${decoded.height}:${decoded.pixelHash}`);
          }
        }
        if (JSON.stringify(imagesBefore) !== JSON.stringify(imagesAfter)) {
          throw new Error(`Structural compression changed rendered pixels: ${imagesBefore} vs ${imagesAfter}`);
        }
        assertions += 2;
      }
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error("PDF raster UI overflows mobile-width viewport");
      if (failures.length !== 0) throw new Error(`Browser errors or non-local network: ${failures.join(" | ")}`);
      assertions += 2;
      await page.close();
      await compressor.close();
      console.log(`${browserName}: PASS strict ranges, real PNG/JPEG${webpRefused ? ", unsupported WebP rejected" : "/WebP"} decoding, ZIP byte parity, structural PDF text/pixel parity`);
    } finally {
      await context.close();
      await browser.close();
    }
  }
  if (assertions !== 69) throw new Error(`Acceptance assertions incomplete: ${assertions}/69`);
  console.log(`218/236 PDF browser acceptance PASS: ${assertions}/69 assertions (3 engines)`);
} finally {
  server.kill("SIGTERM");
}
