/** Actual browser #247 acceptance against the experimental Astro route; no mocked OCR text. */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { chromium } from "playwright";
import { buildPdfFromJpegs, buildPdfFromPages, createSimplePdf, parseJpeg } from "../src/engines/pdf/writer.ts";
import { parsePdf } from "../src/engines/pdf/parser.ts";

const base = process.env.OCR247_TEST_BASE_URL ?? "http://127.0.0.1:4379";
const png = await readFile(resolve("spikes/heavy-local-feasibility/public/corpus/ocr-it.png"));
assert.equal(createHash("sha256").update(png).digest("hex"), "1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b");
const jpeg = await sharp(png).jpeg({ quality: 96 }).toBuffer();
const inputJpeg = parseJpeg(new Uint8Array(jpeg), "fatura-scansionata.jpg");
assert(inputJpeg);
const scannedBytes = buildPdfFromJpegs([inputJpeg]);
const image = parsePdf(scannedBytes);
const digital = parsePdf(createSimplePdf(["TESTO DIGITALE ORIGINALE"], { width: 1280, height: 240 }));
const mixedBytes = buildPdfFromPages([{ document: image, page: image.pages[0] },
  { document: digital, page: digital.pages[0] }]);
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const requests = [], errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  const path = new URL("/tools/pdf-scansionato-ocr-247/", base);
  await page.goto(path.href, { waitUntil: "networkidle" });
  assert.match(await page.title(), /PDF scansionato OCR/u);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  assert.equal(requests.filter((url) => url.includes("/ocr-246/")).length, 0, "OCR model must load lazily");
  for (const [name, bytes, pages] of [["scanned.pdf", scannedBytes, 1], ["mixed.pdf", mixedBytes, 2]]) {
    await page.locator("#ocr247-file").setInputFiles({ name, mimeType: "application/pdf", buffer: Buffer.from(bytes) });
    await page.locator("[data-ocr247-run]").click();
    await page.locator("[data-ocr247-result]").waitFor({ state: "visible", timeout: 150_000 });
    const receipt = await page.locator("[data-ocr247-result]").innerText();
    assert.match(receipt, /OCR inserito/u);
    assert.match(receipt, /Pixel modificati: 0\.0000%/u);
    assert.match(receipt, /differenza massima 0\/255/u);
    if (pages === 2) assert.match(receipt, /testo PDF originale preservato/u);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Scarica PDF OCR verificato" }).click();
    const downloaded = await downloadPromise;
    assert.match(downloaded.suggestedFilename(), /-ocr-sperimentale\.pdf$/u);
    const reopened = await readFile(await downloaded.path());
    // Independent PDF.js reopen: do not trust the browser's UI string alone.
    const pdfjs = await import("pdfjs-dist");
    const task = pdfjs.getDocument({ data: Uint8Array.from(reopened), useSystemFonts: true });
    try {
      const document = await task.promise;
      assert.equal(document.numPages, pages);
      const pg1 = await document.getPage(1);
      const text1 = (await pg1.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
      assert.match(text1, /Fattura\s+numero\s+12345/u);
      assert.match(text1, /678,90/u);
      if (pages === 2) {
        const pg2 = await document.getPage(2);
        const text2 = (await pg2.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
        assert.match(text2, /TESTO DIGITALE ORIGINALE/u);
        assert.doesNotMatch(text2, /Fattura numero/u);
      }
    } finally { await task.destroy(); }
    console.log(`#247 REAL_BROWSER ${name} passed; ${reopened.length} output bytes, ${pages} pages, independent PDF.js text reopen and zero-pixel visual delta`);
  }
  assert.equal(requests.filter((url) => url.endsWith("ita.traineddata.gz")).length, 2, "only scanned pages use the same-origin Italian model");
  assert(requests.some((url) => url.includes("tesseract-core") && url.includes(".wasm")));
  const requestsBeforeDigital = requests.filter((url) => url.endsWith("ita.traineddata.gz")).length;
  await page.locator("#ocr247-file").setInputFiles({ name: "digital-only.pdf", mimeType: "application/pdf",
    buffer: Buffer.from(createSimplePdf(["TESTO DIGITALE ORIGINALE"])) });
  await page.locator("[data-ocr247-run]").click();
  await page.getByText(/OCR247_ALREADY_SEARCHABLE/u).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await page.locator("[data-ocr247-result]").count(), 0, "digital-only PDF never gets an OCR artifact");
  assert.equal(requests.filter((url) => url.endsWith("ita.traineddata.gz")).length, requestsBeforeDigital,
    "digital-only document must not instantiate Tesseract");
  await page.locator("#ocr247-file").setInputFiles({ name: "cancel.pdf", mimeType: "application/pdf", buffer: Buffer.from(scannedBytes) });
  await page.locator("[data-ocr247-run]").click();
  await page.locator("[data-ocr247-cancel]").click();
  assert.match(await page.locator("[data-ocr247-status]").innerText(), /annullata/u);
  assert.equal(await page.locator("[data-ocr247-result]").count(), 0, "cancelled job must not offer a PDF");
  assert.deepEqual(requests.filter((url) => url.startsWith("http") && new URL(url).origin !== path.origin), [], "no offsite requests");
  assert.deepEqual(errors, [], "no browser errors");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "390px layout must not overflow");
  console.log("#247 REAL_BROWSER_PASS: scanned+mixed, no duplicated digital text, actual Tesseract word boxes, pixel identity, no external requests, 390px headless Chromium");
} finally { if (browser) await browser.close(); }
