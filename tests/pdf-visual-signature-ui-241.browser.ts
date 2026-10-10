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
import { chromium, firefox, webkit } from "@playwright/test";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createSimplePdf, buildPdfFromPages } from "../src/engines/pdf/writer";
import { parsePdf, pdfArray, pdfDict, pdfNumber, pdfReference, type PdfValue } from "../src/engines/pdf/parser";

const root = resolve(import.meta.dirname, "..");
const port = 18471;
const publicOrigin = process.env.PDF241_PUBLIC_ORIGIN?.replace(/\/$/u, "");
const browserName = process.env.PDF241_BROWSER ?? "chromium";
if (!["chromium", "firefox", "webkit"].includes(browserName)) throw new Error("PDF241_BROWSER must be chromium, firefox or webkit");
const origin = publicOrigin ?? `http://127.0.0.1:${port}`;
const route = `${origin}/tools/${publicOrigin ? "pdf-watermark" : "pdf-visual-signature"}/`;
const server = publicOrigin ? null : spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port),
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

async function inkDifferenceInPlacement(bytes: Uint8Array, pageNumber: number): Promise<number> {
  const render = async (contents: Uint8Array) => {
    const loading = getDocument({ data: Uint8Array.from(contents), useSystemFonts: true, disableFontFace: true });
    try {
      const document = await loading.promise;
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context as never, viewport, canvas: canvas as never }).promise;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      page.cleanup();
      return { pixels, width: canvas.width };
    } finally { await loading.destroy(); }
  };
  const original = await render(source), changed = await render(bytes);
  let painted = 0;
  for (let y = 292; y < 352; y++) for (let x = 48; x < 208; x++) {
    const offset = (y * changed.width + x) * 4;
    if ([0, 1, 2].some((channel) => Math.abs(changed.pixels[offset + channel]! - original.pixels[offset + channel]!) >= 30)) painted++;
  }
  return painted;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server && server.exitCode !== null) throw new Error(`Vite/Astro exited with code ${server.exitCode}`);
    try { ready = (await fetch(route)).ok; if (ready) break; } catch { /* booting */ }
    await new Promise<void>((done) => setTimeout(done, 150));
  }
  check(ready, "Astro isolated route must load");
  browser = await ({ chromium, firefox, webkit }[browserName as "chromium" | "firefox" | "webkit"]).launch({ headless: true });
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
    if (message.type() === "error" && !/^Failed to load resource: the server responded with a status of 404 \((?:Not Found|File not found)\)$/u.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => { if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(route, { waitUntil: "networkidle" });
  check(response?.status() === 200, "Candidate route returns 200");
  if (publicOrigin) check(await page.locator("[data-pdf-241-public]").count() === 1, "Compiled public route contains exactly one visual-signature panel");
  else check((await page.locator('meta[name="robots"]').getAttribute("content")) === "noindex, nofollow", "Candidate route must be noindex");
  check((await page.locator("[data-241-disclosure]").innerText()).includes("Non è una firma digitale"), "No digital signing claim");
  check(await page.locator("[data-241-download]").count() === 0, "No download before evidence");
  check(!(await page.getByRole("button", { name: /Applica firma visiva/u }).isEnabled()), "No submit without files");

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
  try { await page.getByRole("textbox", { name: "Pagine della firma" }).waitFor({ timeout: 8_000 }); }
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
  check(!(await page.getByRole("button", { name: /Applica firma visiva/u }).isEnabled()),
    "Preview of selected source must finish before applying a visible signature");
  await page.evaluate(() => (window as Window & { __pdf241ReleasePreview?: () => void }).__pdf241ReleasePreview?.());
  await page.locator("[data-241-original]").waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>("[data-241-original]");
    const submit = document.querySelector<HTMLButtonElement>("[data-pdf-visual-signature-241] button[type=submit]");
    return Boolean(image?.complete && image.naturalWidth > 0 && submit && !submit.disabled);
  });
  await page.evaluate(holdNextPreview);
  await page.getByRole("textbox", { name: "Pagine della firma" }).fill("2,3");
  await page.waitForFunction(() => Boolean((window as Window & { __pdf241PendingPreview?: boolean }).__pdf241PendingPreview), undefined, { timeout: 10_000 });
  check(await page.locator("[data-241-original]").count() === 0,
    "Changing page hides old-page PDF.js thumbnail while the new page renders");
  check(!(await page.getByRole("button", { name: /Applica firma visiva/u }).isEnabled()),
    "Changing page requires its own preview; the previous page cannot authorize placement");
  await page.evaluate(() => (window as Window & { __pdf241ReleasePreview?: () => void }).__pdf241ReleasePreview?.());
  await page.getByRole("spinbutton", { name: "X da sinistra (pt)" }).fill("100");
  await page.getByRole("spinbutton", { name: "Y dal basso (pt)" }).fill("100");
  await page.getByRole("spinbutton", { name: "Larghezza (pt)" }).fill("100");
  await page.getByRole("spinbutton", { name: "Altezza (pt)" }).fill("60");
  await page.locator("[data-241-area]").waitFor();
  check(await page.locator("[data-241-original]").count() === 1, "PDF.js original preview exists");
  check(await page.locator("[data-241-area]").count() === 1, "Selected area overlay appears");
  check((await page.getByRole("combobox", { name: "Pagina di anteprima" }).locator("option").allTextContents()).join("|") === "Pagina 2|Pagina 3", "Both pages exposed in original preview selector");
  await page.getByRole("combobox", { name: "Pagina di anteprima" }).selectOption("3");
  await page.waitForFunction(() => {
    const picture = document.querySelector<HTMLImageElement>("[data-241-original]");
    const button = document.querySelector<HTMLButtonElement>("[data-pdf-visual-signature-241] button[type=submit]");
    return picture?.getAttribute("alt") === "PDF originale, pagina 3" && picture.complete && picture.naturalWidth > 0 && !button?.disabled;
  });
  check((await page.locator("[data-241-original]").getAttribute("alt")) === "PDF originale, pagina 3",
    "Multi-page preview can inspect another selected page with a fresh PDF.js source render");
  await page.getByRole("combobox", { name: "Pagina di anteprima" }).selectOption("2");
  await page.waitForFunction(() => {
    const picture = document.querySelector<HTMLImageElement>("[data-241-original]");
    const button = document.querySelector<HTMLButtonElement>("[data-pdf-visual-signature-241] button[type=submit]");
    return picture?.getAttribute("alt") === "PDF originale, pagina 2" && picture.complete && picture.naturalWidth > 0 && !button?.disabled;
  });
  check(await page.locator("[data-241-download]").count() === 0, "No early download on preflight only");
  await page.getByRole("button", { name: /Applica firma visiva/u }).click();
  await page.locator("[data-241-result]").waitFor({ timeout: 20_000 });
  await page.locator("[data-241-final]").first().waitFor();
  check(await page.locator("[data-241-final]").count() === 2, "Every selected page independently reopened and previewed");
  await page.screenshot({ path: "/tmp/strumentini-241-chromium-390.png", fullPage: true });
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
  const unchanged1 = await sample(output, 1, 150, 255), opaque3 = await sample(output, 3, 150, 255);
  check(opaque[0]! >= 210 && opaque[1]! < 45 && opaque[2]! < 65, `PDF.js independent rendered red signature: ${opaque}`);
  check(transparent.slice(0, 3).every((value) => value > 240), `Transparent pixels preserve PDF background: ${transparent}`);
  check(unchanged1.slice(0, 3).every((value) => value > 240), "Page 1 remains untouched");
  check(opaque3[0]! >= 210 && opaque3[1]! < 45 && opaque3[2]! < 65, "Page 3 also contains signature image");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px viewport has no horizontal overflow");

  // Altering geometry must revoke stale success. Out-of-bounds cannot download.
  await page.getByRole("spinbutton", { name: "Larghezza (pt)" }).fill("9999");
  await page.locator("[data-241-validation]").waitFor();
  check(await page.locator("[data-241-download]").count() === 0, "Invalid geometry invalidates previous downloadable result");
  check(!(await page.getByRole("button", { name: /Applica firma visiva/u }).isEnabled()), "Out-of-bounds region is blocked");
  await page.locator("[data-241-reset]").click();
  await page.locator("[data-241-original]").waitFor({ state: "detached" });
  check(await page.locator("[data-241-original]").count() === 0, "Reset clears previews");
  check(await page.locator("[data-241-source]").inputValue() === "", "Reset clears PDF picker");
  check(await page.locator("[data-241-png]").inputValue() === "", "Reset clears PNG picker");

  // Real Chromium responsive viewport, handwritten and raster text modes.
  await page.setViewportSize({ width: 320, height: 720 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "320px viewport has no horizontal overflow");
  await page.locator("[data-241-source]").setInputFiles(sourceFile);
  await page.getByRole("combobox", { name: "Modalità della firma visiva" }).selectOption("text");
  await page.locator("[data-241-text]").fill("Mario Rossi");
  await page.getByRole("textbox", { name: "Pagine della firma" }).fill("1,3");
  await page.locator("[data-241-original]").waitFor();
  await page.getByRole("button", { name: /Applica firma visiva/u }).click();
  await page.locator("[data-241-result]").waitFor({ timeout: 20_000 });
  check(await page.locator("[data-241-final]").count() === 2, "Text mode independently reopened pages 1 and 3");
  await page.screenshot({ path: "/tmp/strumentini-241-chromium-320.png", fullPage: true });
  check(await page.locator("[data-241-download]").count() === 1, "Text mode downloadable on 320px viewport");
  const textDownloadPending = page.waitForEvent("download");
  await page.locator("[data-241-download]").click();
  const textDownload = await textDownloadPending;
  const textOutput = new Uint8Array(await readFile(await textDownload.path()));
  const textInk1 = await inkDifferenceInPlacement(textOutput, 1);
  const textInk3 = await inkDifferenceInPlacement(textOutput, 3);
  const textInk2 = await inkDifferenceInPlacement(textOutput, 2);
  check(textInk1 > 50 && textInk3 > 50 && textInk2 === 0,
    `PDF.js independently confirms text pixels on selected pages only: ${textInk1}/${textInk2}/${textInk3}`);
  await page.locator("[data-241-reset]").click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("[data-241-source]").setInputFiles(sourceFile);
  await page.getByRole("combobox", { name: "Modalità della firma visiva" }).selectOption("draw");
  const canvas = page.locator("[data-241-draw]");
  // The public watermark route has a separate editor above this component;
  // low-level Playwright mouse movements do not auto-scroll an offscreen canvas.
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert(box);
  await page.mouse.move(box.x + 30, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 90, { steps: 10 });
  await page.mouse.up();
  await page.locator("[data-241-original]").waitFor();
  await page.getByRole("button", { name: /Applica firma visiva/u }).click();
  await page.locator("[data-241-result]").waitFor({ timeout: 20_000 });
  check(await page.locator("[data-241-download]").count() === 1, "Pointer drawing mode independently verifies and exports PDF");
  await page.screenshot({ path: "/tmp/strumentini-241-chromium-1440.png", fullPage: true });
  const drawDownloadPending = page.waitForEvent("download");
  await page.locator("[data-241-download]").click();
  const drawDownload = await drawDownloadPending;
  const drawOutput = new Uint8Array(await readFile(await drawDownload.path()));
  const drawnInk = await inkDifferenceInPlacement(drawOutput, 1);
  check(drawnInk > 30, `PDF.js independently confirms drawn signature ink: ${drawnInk}`);
  await page.locator("[data-241-clear-draw]").click();
  check(await page.locator("[data-241-download]").count() === 0, "Clearing drawing revokes stale result");
  check(!(await page.getByRole("button", { name: /Applica firma visiva/u }).isEnabled()), "Blank drawing cannot submit");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "1440px viewport has no horizontal overflow");
  await page.locator("[data-241-reset]").click();

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
  console.log(`PDF #241 ${publicOrigin ? "public compiled" : "isolated"} ${browserName} 320/390/1440: PASS (${checks} checks); independent PDF.js output reopened, unsigned PNG/text/drawing overlays; no offsite; NO physical-device acceptance`);
} finally {
  if (browser) await browser.close();
  server?.kill("SIGTERM");
}
