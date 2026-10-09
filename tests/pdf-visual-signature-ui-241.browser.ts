/**
 * Isolated Astro/Vite Chromium acceptance for #241; run with
 * ./node_modules/.bin/tsx tests/pdf-visual-signature-ui-241.browser.ts
 * Verifies real browser UX and PDF.js independently reopens downloaded bytes.
 * Physical iOS/Android, Firefox/Safari and legal/certificate signing are NOT certified.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createSimplePdf, buildPdfFromPages } from "../src/engines/pdf/writer";
import { parsePdf, pdfArray, pdfDict, pdfNumber, pdfReference, type PdfValue } from "../src/engines/pdf/parser";

const root = resolve(import.meta.dirname, "..");
const port = 18471;
const origin = `http://127.0.0.1:${port}`;
const route = `${origin}/tools/pdf-visual-signature/`;
const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port),
  "--config", "tests/astro-visual-signature-241.config.mjs"], { cwd: root, stdio: "ignore" });
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let checks = 0;
const check = (condition: unknown, message: string) => { assert(condition, message); checks += 1; };
const source = createSimplePdf(["FIRST_241_PAGE", "SECOND_241_PAGE", "THIRD_241_PAGE"], { width: 300, height: 400 });
const pixels = new Uint8Array(16 * 8 * 4);
for (let row = 0; row < 8; row++) for (let col = 0; col < 16; col++) {
  pixels.set(row < 4 ? [230, 12, 32, 255] : [11, 240, 18, 0], (row * 16 + col) * 4);
}
const png = await sharp(pixels, { raw: { width: 16, height: 8, channels: 4 } }).png().toBuffer();

function catalogMutation(key: string, value: PdfValue): Uint8Array {
  const model = parsePdf(source);
  const root = model.root && model.objects.get(model.root.id);
  assert(root && root.value.kind === "dict");
  const objects = new Map(model.objects);
  objects.set(root.id, { ...root, value: { ...root.value, entries: new Map([...root.value.entries, [key, value]]) } });
  const changed = { ...model, objects };
  return buildPdfFromPages(model.pages.map((page) => ({ document: changed, page })), { flatten: false, compress: false });
}

async function sample(bytes: Uint8Array, pageIndex: number, x: number, y: number) {
  const loading = getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true, disableFontFace: true });
  try {
    const document = await loading.promise;
    check(document.numPages === 3, "Three-page output must independently reopen in PDF.js");
    const page = await document.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(viewport.width, viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d") as never, canvas: canvas as never, viewport }).promise;
    const rgba = Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data);
    page.cleanup();
    return rgba;
  } finally { await loading.destroy(); }
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite/Astro exited with code ${server.exitCode}`);
    try { ready = (await fetch(route)).ok; if (ready) break; } catch { /* booting */ }
    await new Promise<void>((done) => setTimeout(done, 150));
  }
  check(ready, "Astro isolated route must load");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const offsite: string[] = [], errors: string[] = [], missing: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!(url.startsWith(origin) || url.startsWith("blob:") || url.startsWith("data:"))) offsite.push(url);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // Astro dev has no auth endpoint: shared ShellChrome probes the optional
    // session API and gets an expected local 404. Verify its exact URL below.
    if (message.type() === "error" && !/^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/u.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => { if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(route, { waitUntil: "networkidle" });
  check(response?.status() === 200, "Candidate route returns 200");
  check((await page.locator('meta[name="robots"]').getAttribute("content")) === "noindex, nofollow", "Candidate route must be noindex");
  check((await page.locator("[data-241-disclosure]").innerText()).includes("Non è una firma digitale"), "No digital signing claim");
  check(await page.locator("[data-241-download]").count() === 0, "No download before evidence");
  check(!(await page.getByRole("button", { name: /Applica immagine visiva/u }).isEnabled()), "No submit without files");

  // Force the independent original-page renderer to stay pending after both
  // files have validated. A placement cannot be approved before it is visible.
  const holdNextPreview = `(() => {
    window.__pdf241PendingPreview = false;
    window.__pdf241ReleasePreview = undefined;
    const original = HTMLCanvasElement.prototype.toBlob;
    let first = true;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (!first) return original.call(this, callback, type, quality);
      first = false;
      const canvas = this;
      Object.assign(window, {
        __pdf241PendingPreview: true,
        __pdf241ReleasePreview: () => {
          HTMLCanvasElement.prototype.toBlob = original;
          original.call(canvas, callback, type, quality);
        },
      });
    };
  })()`;
  await page.evaluate(holdNextPreview);

  const sourceFile = { name: "unsigned-241.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) };
  const pngFile = { name: "sig-visible-241.png", mimeType: "image/png", buffer: png };
  await page.locator("[data-241-source]").setInputFiles(sourceFile);
  try { await page.getByRole("combobox", { name: "Pagina della firma" }).waitFor({ timeout: 8_000 }); }
  catch (reason) { console.error("Debug #241", { errors, html: (await page.locator("[data-pdf-visual-signature-241]").innerText()).slice(0, 900) }); throw reason; }
  await page.locator("[data-241-png]").setInputFiles(pngFile);
  try {
    await page.waitForFunction(() => Boolean((window as Window & { __pdf241PendingPreview?: boolean }).__pdf241PendingPreview), undefined, { timeout: 10_000 });
  } catch (reason) {
    console.error("#241 delayed preview diagnostic", { errors, missing,
      content: (await page.locator("[data-pdf-visual-signature-241]").innerText()).slice(0, 1100),
      original: await page.locator("[data-241-original]").count() });
    throw reason;
  }
  await page.waitForTimeout(300);
  check(!(await page.getByRole("button", { name: /Applica immagine visiva/u }).isEnabled()),
    "Preview of selected source must finish before applying a visible signature");
  await page.evaluate(() => (window as Window & { __pdf241ReleasePreview?: () => void }).__pdf241ReleasePreview?.());
  await page.locator("[data-241-original]").waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>("[data-241-original]");
    const submit = document.querySelector<HTMLButtonElement>("[data-pdf-visual-signature-241] button[type=submit]");
    return Boolean(image?.complete && image.naturalWidth > 0 && submit && !submit.disabled);
  });
  await page.evaluate(holdNextPreview);
  await page.getByRole("combobox", { name: "Pagina della firma" }).selectOption("2");
  await page.waitForFunction(() => Boolean((window as Window & { __pdf241PendingPreview?: boolean }).__pdf241PendingPreview), undefined, { timeout: 10_000 });
  check(await page.locator("[data-241-original]").count() === 0,
    "Changing page hides old-page PDF.js thumbnail while the new page renders");
  check(!(await page.getByRole("button", { name: /Applica immagine visiva/u }).isEnabled()),
    "Changing page requires its own preview; the previous page cannot authorize placement");
  await page.evaluate(() => (window as Window & { __pdf241ReleasePreview?: () => void }).__pdf241ReleasePreview?.());
  await page.getByRole("spinbutton", { name: "X da sinistra (pt)" }).fill("100");
  await page.getByRole("spinbutton", { name: "Y dal basso (pt)" }).fill("100");
  await page.getByRole("spinbutton", { name: "Larghezza (pt)" }).fill("100");
  await page.getByRole("spinbutton", { name: "Altezza (pt)" }).fill("60");
  await page.locator("[data-241-area]").waitFor();
  check(await page.locator("[data-241-original]").count() === 1, "PDF.js original preview exists");
  check(await page.locator("[data-241-area]").count() === 1, "Selected area overlay appears");
  check(await page.locator("[data-241-download]").count() === 0, "No early download on preflight only");
  await page.getByRole("button", { name: /Applica immagine visiva/u }).click();
  await page.locator("[data-241-result]").waitFor({ timeout: 20_000 });
  await page.locator("[data-241-final]").waitFor();
  check(await page.locator("[data-241-download]").count() === 1, "Download only after output preview and PDF.js reopen");
  const pendingDownload = page.waitForEvent("download");
  await page.locator("[data-241-download]").click();
  const download = await pendingDownload;
  check(download.suggestedFilename().includes("NON-digitale"), "Download filename clearly not digital signature");
  const output = new Uint8Array(await readFile(await download.path()));
  check(new TextDecoder("latin1").decode(output).includes("/VS241Image Do"), "Actual output paints visible PNG overlay");
  const outputDoc = parsePdf(output);
  check(!/\/(?:AcroForm|ByteRange|DocMDP|SigFlags|FT\s*\/Sig)\b/u.test(outputDoc.text), "Output has no cryptographic signatures or form fields");
  const opaque = await sample(output, 2, 150, 255), transparent = await sample(output, 2, 150, 285);
  const unchanged1 = await sample(output, 1, 150, 255), unchanged3 = await sample(output, 3, 150, 255);
  check(opaque[0]! >= 210 && opaque[1]! < 45 && opaque[2]! < 65, `PDF.js independent rendered red signature: ${opaque}`);
  check(transparent.slice(0, 3).every((value) => value > 240), `Transparent pixels preserve PDF background: ${transparent}`);
  check(unchanged1.slice(0, 3).every((value) => value > 240), "Page 1 remains untouched");
  check(unchanged3.slice(0, 3).every((value) => value > 240), "Page 3 remains untouched");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px viewport has no horizontal overflow");

  // Altering geometry must revoke stale success. Out-of-bounds cannot download.
  await page.getByRole("spinbutton", { name: "Larghezza (pt)" }).fill("9999");
  await page.locator("[data-241-validation]").waitFor();
  check(await page.locator("[data-241-download]").count() === 0, "Invalid geometry invalidates previous downloadable result");
  check(!(await page.getByRole("button", { name: /Applica immagine visiva/u }).isEnabled()), "Out-of-bounds region is blocked");
  await page.locator("[data-241-reset]").click();
  await page.locator("[data-241-original]").waitFor({ state: "detached" });
  check(await page.locator("[data-241-original]").count() === 0, "Reset clears previews");
  check(await page.locator("[data-241-source]").inputValue() === "", "Reset clears PDF picker");
  check(await page.locator("[data-241-png]").inputValue() === "", "Reset clears PNG picker");

  for (const [label, bytes] of [
    ["signature certification", catalogMutation("Perms", pdfDict({ DocMDP: pdfReference(1) }))],
    ["existing signed byte-range", catalogMutation("ByteRange", pdfArray([pdfNumber(0), pdfNumber(100), pdfNumber(150), pdfNumber(40)]))],
    ["existing PDF form", catalogMutation("AcroForm", pdfDict({ Fields: pdfArray([]) }))],
  ] as const) {
    await page.locator("[data-241-source]").setInputFiles({ name: `${label}.pdf`, mimeType: "application/pdf", buffer: Buffer.from(bytes) });
    await page.locator("[data-241-png]").setInputFiles(pngFile);
    await page.locator("[data-241-validation]").waitFor();
    check((await page.locator("[data-241-validation]").innerText()).match(/PDF241_(?:SIGNED_OR_FORM_REFUSED|UNSAFE_SOURCE)/u), `Refuse ${label}`);
    check(await page.locator("[data-241-download]").count() === 0, `Never download ${label}`);
  }
  check(offsite.length === 0, `No offsite requests: ${offsite.join(", ")}`);
  check(missing.every((value) => value === `404 ${origin}/api/auth/session`), `Unexpected local HTTP failure: ${missing.join(", ")}`);
  check(errors.length === 0, `No browser page errors: ${errors.join(", ")} ; unsuccessful requests: ${missing.join(", ")}`);
  console.log(`PDF #241 visual-signature isolated Chromium 390x844: PASS (${checks} checks); independent PDF.js output reopened, unsigned PNG overlay; no offsite; NO physical-device acceptance`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
