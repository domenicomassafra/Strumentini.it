/** Real Chromium local-server OCR acceptance; never mocks recognized text. */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const base = process.env.OCR246_TEST_BASE_URL ?? "http://127.0.0.1:4378";
const expected = "Fattura numero 12345 - Totale euro 678,90";
const sample = resolve("spikes/heavy-local-feasibility/public/corpus/ocr-it.png");
assert.equal(createHash("sha256").update(await readFile(sample)).digest("hex"),
  "1bfc71b54560679f6b6d0e8f978201b2ca27fdfcd84d47ef9344d41db0a2f27b");

let browser;
let context;
let page;
try {
  // Use existing MiniPC automation-browser when supplied; preserve the
  // standalone Playwright consumer path for other test hosts.
  browser = process.env.OCR246_CDP_URL
    ? await chromium.connectOverCDP(process.env.OCR246_CDP_URL)
    : await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await context.newPage();
  const allRequests = [];
  const runtimeErrors = [];
  page.on("request", (req) => allRequests.push(req.url()));
  page.on("pageerror", (err) => runtimeErrors.push(err.message));
  const route = new URL("/tools/ocr-italiano-locale-246/", base);
  await page.goto(route.href, { waitUntil: "networkidle", timeout: 25_000 });
  await page.waitForFunction(() => [...document.querySelectorAll("astro-island")].every((island) => !island.hasAttribute("ssr")), null, { timeout: 25_000 });
  assert.match(await page.title(), /OCR immagini in italiano/u);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  assert.equal(allRequests.filter((u) => u.includes("/ocr-246/")).length, 0,
    "OCR runtime must not be loaded on page visit");
  await page.locator("#ocr246-file").setInputFiles(sample);
  assert.equal(allRequests.filter((u) => u.includes("/ocr-246/")).length, 0,
    "OCR runtime must not load merely on file selection");
  await page.locator("[data-ocr-run]").click();
  await page.locator("[data-ocr-result]").waitFor({ state: "visible", timeout: 95_000 });
  const text = (await page.locator('textarea[aria-label="Testo OCR italiano"]').inputValue()).replace(/\s+/gu, " ").trim();
  assert.equal(text, expected);
  assert.match(await page.locator("[data-ocr-confidence]").innerText(), /Tesseract/u);
  assert.equal(await page.locator('#ocr395-language option[value="eng"]').isDisabled(), false,
    "pinned same-origin English model must be selectable");
  assert.equal(allRequests.some((u) => u.endsWith("eng.traineddata.gz")), false,
    "the EN model must never be downloaded during Italian OCR");
  const originalPreview = page.locator("[data-ocr-original-preview]");
  await originalPreview.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const img = document.querySelector("[data-ocr-original-preview]");
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
  }, null, { timeout: 10_000 });
  assert.ok(allRequests.some((u) => u.endsWith("ita.traineddata.gz")), "must fetch locally vendored ITA traineddata");
  assert.ok(allRequests.some((u) => u.includes("tesseract-core") && u.includes(".wasm")), "must fetch local Tesseract WASM core");
  const offsite = allRequests.filter((u) => u.startsWith("http") && new URL(u).origin !== route.origin);
  assert.deepEqual(offsite, [], `OCR browser made offsite requests: ${offsite}`);
  assert.deepEqual(runtimeErrors, [], `browser page JavaScript errors: ${runtimeErrors}`);
  const narrowLayout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("body *")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.right > window.innerWidth + 1;
    }).slice(0, 12).map((element) => ({
      tag: element.tagName, id: element.id, className: String(element.className).slice(0, 90),
      right: Math.ceil(element.getBoundingClientRect().right),
    })),
  }));
  assert.ok(narrowLayout.scrollWidth <= narrowLayout.viewport,
    `390px mobile viewport must not overflow: ${JSON.stringify(narrowLayout)}`);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Scarica TXT locale/u }).click();
  const download = await downloaded;
  assert.equal(download.suggestedFilename(), "ocr-italiano-246.txt");
  assert.equal((await readFile(await download.path(), "utf8")).replace(/\s+/gu, " ").trim(), expected);

  // STR-395: the operator must be able to correct actual recognized text,
  // and TXT must contain the correction while the engine's raw result and
  // confidence remain identified as an unverified OCR draft.
  const editor = page.locator('textarea[aria-label="Testo OCR italiano"]');
  const manuallyCorrected = "Fattura corretta manualmente: 12345 — totale € 678,90";
  await editor.fill(manuallyCorrected);
  assert.equal(await editor.inputValue(), manuallyCorrected);
  assert.match(await page.locator("[data-ocr-result]").innerText(), /corrett[oa].*manual/iu);
  assert.match(await page.locator("[data-ocr-confidence]").innerText(), /non.*(calibrat|correzion)/iu);
  const correctedTxtPending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Scarica TXT locale/u }).click();
  const correctedTxt = await correctedTxtPending;
  assert.equal(await readFile(await correctedTxt.path(), "utf8"), manuallyCorrected);

  // A changed orientation invalidates the old text AND its success status.
  await page.locator("#ocr246-rotation").selectOption("90");
  assert.equal(await page.locator("[data-ocr-result]").count(), 0,
    "changing orientation must hide results obtained with the previous rotation");
  assert.match(await page.locator("[data-ocr-status]").innerText(), /orientamento.*riesegui/iu,
    "do not leave a stale OCR-completed announcement after changing orientation");

  // Independent negative oracle: a fully white 1280x240 scan contains no
  // writing. Tesseract must never turn it into verified or downloadable text.
  const blankScan = await sharp({ create: {
    width: 1280, height: 240, channels: 4, background: "#ffffff",
  } }).png().toBuffer();
  await page.locator("#ocr246-file").setInputFiles({ name: "scansione-senza-testo.png", mimeType: "image/png", buffer: blankScan });
  await page.locator("#ocr246-rotation").selectOption("0");
  await page.locator("[data-ocr-run]").click();
  await page.locator("[data-ocr-result]").waitFor({ state: "visible", timeout: 95_000 });
  assert.equal(await editor.inputValue(), "", "a blank scan must not invent an OCR transcription");
  assert.match(await page.locator("[data-ocr-correction]").innerText(), /nessuna conferma di accuratezza/iu);
  assert.equal(await page.getByRole("button", { name: /Scarica TXT locale/u }).isDisabled(), true,
    "a blank scan cannot expose a downloadable authoritative result");

  // Reproduce the independently observed RAW-90 failure input, then correct
  // orientation only by explicit user choice (270 clockwise); never claim
  // automatic orientation detection based on Tesseract's confidence score.
  const rotated = await sharp(await readFile(sample)).rotate(90).png().toBuffer();
  const rotatedInfo = await sharp(rotated).metadata();
  assert.equal(rotatedInfo.width, 240);
  assert.equal(rotatedInfo.height, 1280);
  await page.locator("#ocr246-file").setInputFiles({ name: "fattura-ruotata-90.png", mimeType: "image/png", buffer: rotated });
  await page.locator("#ocr246-rotation").selectOption("270");
  await page.locator("[data-ocr-run]").click();
  await page.waitForFunction(() => Boolean(document.querySelector("[data-ocr-result]")) ||
    document.querySelector("[data-ocr-status]")?.textContent?.startsWith("OCR non completato:"), null, { timeout: 95_000 });
  const rotationStatus = await page.locator("[data-ocr-status]").innerText();
  assert.equal(await page.locator("[data-ocr-result]").count(), 1,
    `manual rotation OCR failed: ${rotationStatus}; errors=${runtimeErrors.join("; ")}`);
  const corrected = (await page.locator('textarea[aria-label="Testo OCR italiano"]').inputValue()).replace(/\s+/gu, " ").trim();
  assert.equal(corrected, expected, "real browser/Tesseract must recognize the actually corrected raw 90-degree image");
  assert.match(await page.locator("[data-ocr-result]").innerText(), /Correzione manuale applicata: 270°/u);
  const rotatedDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Scarica TXT locale/u }).click();
  const correctedDownload = await rotatedDownloadPromise;
  assert.equal((await readFile(await correctedDownload.path(), "utf8")).replace(/\s+/gu, " ").trim(), expected);
  assert.deepEqual(allRequests.filter((u) => u.startsWith("http") && new URL(u).origin !== route.origin), [],
    "rotated OCR must not fetch from external origins");
  assert.deepEqual(runtimeErrors, [], "rotated OCR must not cause JS exceptions");
  // EN OCR is opt-in: selecting it and choosing a file must not download
  // the second model until the user actually starts recognition.
  const enSample = resolve("tests/fixtures/ocr-395/invoice-en.png");
  const enExpected = (await readFile(resolve("tests/fixtures/ocr-395/invoice-en.txt"), "utf8")).trim();
  assert.equal(createHash("sha256").update(await readFile(enSample)).digest("hex"),
    "76a837a9afb4e7ef0312bdff33c1ea7175f2cae02d417143350bff09a57a685d");
  await page.locator("#ocr395-language").selectOption("eng");
  assert.equal(await page.locator("[data-ocr-result]").count(), 0, "language change must invalidate stale IT result");
  await page.locator("#ocr246-file").setInputFiles(enSample);
  assert.equal(await page.locator("#ocr246-rotation").inputValue(), "0",
    "a newly selected scan must not inherit the previous Italian image rotation");
  assert.equal(allRequests.some((u) => u.endsWith("eng.traineddata.gz")), false,
    "choosing EN or its input must not eagerly fetch traineddata");
  await page.locator("[data-ocr-run]").click();
  await page.locator("[data-ocr-result]").waitFor({ state: "visible", timeout: 95_000 });
  const enEditor = page.locator('textarea[aria-label="English OCR text"]');
  const enRecognized = (await enEditor.inputValue()).replace(/\s+/gu, " ").trim();
  assert.equal(enRecognized, enExpected, "English browser Tesseract must match its independently labeled scan");
  assert.ok(allRequests.some((u) => u.endsWith("/ocr-395/lang/eng.traineddata.gz")), "only the EN job fetches same-origin ENG");
  assert.match(await page.locator("[data-ocr-result]").innerText(), /lingua eng/u);
  assert.match(await page.locator("[data-ocr-confidence]").innerText(), /non.*calibrat/iu);
  const enCorrection = "Reviewed English invoice 24680 — USD 123.45";
  await enEditor.fill(enCorrection);
  assert.match(await page.locator("[data-ocr-correction]").innerText(), /corretto manualmente/iu);
  const enDownloadWaiting = page.waitForEvent("download");
  await page.getByRole("button", { name: /Scarica TXT locale/u }).click();
  const enDownload = await enDownloadWaiting;
  assert.equal(enDownload.suggestedFilename(), "ocr-english-395.txt");
  assert.equal(await readFile(await enDownload.path(), "utf8"), enCorrection,
    "reopen and compare the actual exported Unicode English correction");
  await page.locator("#ocr246-rotation").selectOption("90");
  assert.equal(await page.locator("[data-ocr-result]").count(), 0);

  // A real wrong rotation cannot be treated as verified, regardless of
  // whether the recognizer extracts some accidental characters.
  await page.locator("#ocr246-file").setInputFiles(resolve("tests/fixtures/ocr-395/invoice-en-rotated.png"));
  await page.locator("#ocr246-rotation").selectOption("0");
  await page.locator("[data-ocr-run]").click();
  await page.waitForFunction(() => Boolean(document.querySelector("[data-ocr-result]")) ||
    document.querySelector("[data-ocr-status]")?.textContent?.startsWith("OCR non completato:"),
    null, { timeout: 95_000 });
  if (await page.locator("[data-ocr-result]").count()) {
    assert.match(await page.locator("[data-ocr-correction]").innerText(), /nessuna conferma di accuratezza/iu);
  }
  // Pillow's positive rotation for this fixture is counterclockwise:
  // a 90° clockwise correction restores its upright orientation.
  await page.locator("#ocr246-rotation").selectOption("90");
  assert.equal(await page.locator("[data-ocr-result]").count(), 0);
  await page.locator("[data-ocr-run]").click();
  await page.locator("[data-ocr-result]").waitFor({ state: "visible", timeout: 95_000 });
  assert.equal((await enEditor.inputValue()).replace(/\s+/gu, " ").trim(), enExpected,
    "manual 90-degree clockwise correction must recover labeled English text");
  assert.match(await page.locator("[data-ocr-result]").innerText(), /Correzione manuale applicata: 90°/u);

  await page.locator("#ocr246-file").setInputFiles(resolve("tests/fixtures/ocr-395/invoice-en-low-contrast.png"));
  await page.locator("#ocr246-rotation").selectOption("0");
  await page.locator("[data-ocr-run]").click();
  await page.waitForFunction(() => Boolean(document.querySelector("[data-ocr-result]")) ||
    document.querySelector("[data-ocr-status]")?.textContent?.startsWith("OCR non completato:"),
    null, { timeout: 95_000 });
  if (await page.locator("[data-ocr-result]").count()) {
    assert.match(await page.locator("[data-ocr-correction]").innerText(), /nessuna conferma di accuratezza/iu,
      "degraded scans are always explicitly unverified even if Tesseract returns a score");
    assert.doesNotMatch(await page.locator("[data-ocr-result]").innerText(), /accuratezza confermata/iu);
  }
  assert.deepEqual(allRequests.filter((u) => u.startsWith("http") && new URL(u).origin !== route.origin), []);
  assert.deepEqual(runtimeErrors, []);
  console.log("#395 BROWSER PASS: Italian and English scans matched labeled text; ENG fetched lazily, edited English TXT reopened, wrong rotation and degraded scan not authoritative; only same-origin network.");
  console.log("#246 BROWSER PASS: real Tesseract Italian OCR exact on original and manually corrected RAW-90 invoice; worker/WASM/ITA same origin, lazy load, two actual TXT downloads, 390px responsive, no external HTTP, no JS errors.");
  console.log("#246 OCR ASSET REQUESTS:", allRequests.filter((u) => u.includes("/ocr-246/")).map((u) => new URL(u).pathname).join(", "));
} finally {
  if (page) await page.close();
  if (context) await context.close();
  if (browser) await browser.close();
}
