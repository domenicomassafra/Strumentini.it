/** Actual browser #247 acceptance against the experimental Astro route; no mocked OCR text. */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { chromium, firefox, webkit } from "playwright";
import { buildPdfFromJpegs, buildPdfFromPages, createSimplePdf, parseJpeg } from "../src/engines/pdf/writer.ts";
import { parsePdf } from "../src/engines/pdf/parser.ts";

const base = process.env.OCR247_TEST_BASE_URL ?? "http://127.0.0.1:4379";
const browserName = process.env.OCR247_BROWSER ?? "chromium";
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error("OCR247_BROWSER must be chromium, firefox or webkit");
const evidenceDir = resolve(".scratch/strumentini-expansion-20261005/evidence/ticket247");
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
  browser = await browserType.launch({ headless: true, ...(browserName === "chromium" ? { args: ["--no-sandbox", "--disable-dev-shm-usage"] } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const requests = [], errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  const path = new URL("/tools/pdf-scansionato-ocr-247/", base);
  await page.goto(path.href, { waitUntil: "networkidle" });
  assert.match(await page.title(), /PDF scansionato OCR/u);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  assert.equal(requests.filter((url) => url.includes("/ocr-246/")).length, 0, "OCR model must load lazily");
  const accepted = [];
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
    accepted.push({ source: name, pageCount: pages, searched: ["Fattura", "numero", "12345", "678,90"],
      pixelsChangedPercent: 0, maxChannelDifference: 0, digitalDuplicate: false });
    if (browserName === "chromium") {
      await mkdir(evidenceDir, { recursive: true });
      await page.screenshot({ path: resolve(evidenceDir, `chromium-390-${name.replace(".pdf", "")}.png`), fullPage: true });
    }
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
  const modelRequestsBeforeUnsafe = requests.filter((url) => url.endsWith("ita.traineddata.gz")).length;
  const annotated = await readFile(resolve("quality/fixtures/pdf-gold/annotated.pdf"));
  await page.locator("#ocr247-file").setInputFiles({ name: "annotated.pdf", mimeType: "application/pdf", buffer: Buffer.from(annotated) });
  await page.locator("[data-ocr247-run]").click();
  await page.getByText(/OCR247_UNSUPPORTED_INTERACTIVE/u).waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await page.locator("[data-ocr247-result]").count(), 0, "interactive PDF preflight cannot produce output");
  assert.equal(requests.filter((url) => url.endsWith("ita.traineddata.gz")).length, modelRequestsBeforeUnsafe,
    "interactive PDF must be refused before OCR model creation");
  // Real 90-degree sideways raster (PDF /Rotate still 0): #246's corpus shows
  // Italian OCR on this image yields weak/incorrect recognition. No invented text.
  const sideways = parseJpeg(new Uint8Array(await sharp(png).rotate(90).jpeg({ quality: 96 }).toBuffer()), "sideways-italian.jpg");
  assert(sideways);
  await page.locator("#ocr247-file").setInputFiles({ name: "sideways.pdf", mimeType: "application/pdf", buffer: Buffer.from(buildPdfFromJpegs([sideways])) });
  await page.locator("[data-ocr247-run]").click();
  await page.getByText(/Conversione rifiutata:/u).waitFor({ state: "visible", timeout: 150_000 });
  const sidewaysStatus = await page.locator("[data-ocr247-status]").innerText();
  assert.match(sidewaysStatus, /OCR247_(?:LOW_CONFIDENCE|UNRELIABLE_RESULT|NO_WORD_COORDINATES|INVALID_WORD_COORDINATES|UNSUPPORTED_GLYPH)/u,
    "sideways real raster must fail closed when text or word geometry is unreliable");
  assert.equal(await page.locator("[data-ocr247-result]").count(), 0, "unreliable orientation cannot create a searchable PDF");
  await page.locator("#ocr247-file").setInputFiles({ name: "cancel.pdf", mimeType: "application/pdf", buffer: Buffer.from(scannedBytes) });
  const startedWorker = page.waitForEvent("worker", {
    predicate: (worker) => worker.url().includes("/ocr-246/vendor/worker.min.js"), timeout: 40_000,
  });
  await page.locator("[data-ocr247-run]").click();
  const activeWorker = await startedWorker;
  const workerClosed = new Promise((resolveClose) => activeWorker.once("close", resolveClose));
  await page.locator("[data-ocr247-cancel]").click();
  await workerClosed;
  assert.match(await page.locator("[data-ocr247-status]").innerText(), /annullata/u);
  assert.equal(await page.locator("[data-ocr247-result]").count(), 0, "cancelled job must not offer a PDF");
  assert.deepEqual(requests.filter((url) => url.startsWith("http") && new URL(url).origin !== path.origin), [], "no offsite requests");
  assert.deepEqual(errors, [], "no browser errors");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "390px layout must not overflow");
  const receipt = { ticket: 247, date: "2026-10-10", status: "LOCAL_EXPERIMENTAL_PASS", browser: browserName,
    viewport: { width: 390, height: 844 }, realOcrEngine: "tesseract.js@7.0.0 same-origin",
    fixtureSha256: "1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b",
    accepted, refused: ["interactive preflight before model", "born-digital-only", "rotated raster unreliable OCR"],
    cancelled: "active Tesseract worker closed before result", visualTolerance: { changedPixelRatio: 0.0005, maxChannelDifference: 3 },
    offsiteRequests: 0, pageErrors: 0, horizontalOverflow: false,
    limitations: ["Desktop browser mobile viewport, not physical mobile", "Peak native/WASM process memory unmeasured",
      "Italian upright printed invoice fixture only", "#246/#271 production approval still open"] };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, `${browserName}-390-local-ocr.json`), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`#247 REAL_BROWSER_PASS ${browserName}: scanned+mixed, no duplicated digital text, actual Tesseract word boxes, pixel identity, interactive preflight/sideways refusal, active Worker cancellation/closure, no external requests, 390px desktop viewport`);
} finally { if (browser) await browser.close(); }
