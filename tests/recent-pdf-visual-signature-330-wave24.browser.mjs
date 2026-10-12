/** #330 wave24 - ONLY visible PDF graphic, never electronic/digital signing.
 * node tests/recent-pdf-visual-signature-330-wave24.browser.mjs
 * Local Chrome390, independent pypdf + PDF.js visual proof, exact IndexedDB
 * metadata, RAF duplicate/cancel/stale, storage denied. No live backend.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

const root = resolve(import.meta.dirname, "..");
const port = 18652;
const origin = `http://127.0.0.1:${port}`;
const route = `${origin}/tools/pdf-visual-signature/`;
const toolId = "pdf-visual-signature";
const secretName = "PRIV_WAVE24";
const sourceName = "PRIVATE_SOURCE_WAVE24.pdf";
const source = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
const ink = new Uint8Array(16 * 8 * 4);
for (let row = 0; row < 8; row++) for (let col = 0; col < 16; col++)
  ink.set(row < 4 ? [234, 9, 26, 255] : [5, 240, 50, 0], (row * 16 + col) * 4);
const signaturePng = await sharp(ink, { raw: { width: 16, height: 8, channels: 4 } }).png().toBuffer();
const sourceFile = { name: sourceName, mimeType: "application/pdf", buffer: source };
const imageFile = { name: "PRIVATE_SIG_WAVE24.png", mimeType: "image/png", buffer: signaturePng };
const browserErrors = [];
const badRequests = [];

async function recent(page) {
  return page.evaluate(async () => {
    if (typeof indexedDB.databases === "function"
        && !(await indexedDB.databases()).some((entry) => entry.name === "utility-workbench")) return [];
    return new Promise((resolve, reject) => {
      const opened = indexedDB.open("utility-workbench", 1);
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result;
        if (!db.objectStoreNames.contains("state")) { db.close(); resolve([]); return; }
        const tx = db.transaction("state", "readonly");
        const item = tx.objectStore("state").get("workbench/state:v1");
        item.onsuccess = () => resolve(item.result?.recent ?? []);
        item.onerror = () => reject(item.error);
        tx.oncomplete = () => db.close();
      };
    });
  });
}
async function count(page, expected, timeout = 4500) {
  const end = Date.now() + timeout;
  let rows = [];
  do {
    rows = await recent(page);
    const matching = rows.filter((row) => row.toolId === toolId);
    if ((!expected && matching.length === 0) || (matching.length === 1 && matching[0].useCount === expected)) {
      if (expected > 0) {
        assert.deepEqual(Object.keys(matching[0]).sort(), ["lastUsedAt", "toolId", "useCount"]);
        assert(Number.isFinite(Date.parse(matching[0].lastUsedAt)));
      }
      assert(![secretName, sourceName, imageFile.name, "%PDF-", "NON-digitale", "rgba"].some((secret) => JSON.stringify(rows).includes(secret)),
        "Recenti must not persist signature, input/output, filename, text or PDF bytes");
      return rows;
    }
    await new Promise((done) => setTimeout(done, 60));
  } while (Date.now() < end);
  throw Error(`Expected Recenti ${expected} but observed ${JSON.stringify(rows)}`);
}
async function ready() {
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(route)).ok) return; } catch { /* local startup */ }
    await new Promise((done) => setTimeout(done, 150));
  }
  throw Error("Local Astro #241 route not ready");
}
function monitor(page) {
  page.on("pageerror", (e) => browserErrors.push(e.message));
  page.on("request", (req) => {
    if (!["GET", "HEAD"].includes(req.method())
        || ![origin, "blob:", "data:"].some((prefix) => req.url().startsWith(prefix))) {
      badRequests.push(`${req.method()} ${req.url()}`);
    }
  });
}
async function open(page) {
  assert.equal((await page.goto(route, { waitUntil: "networkidle" }))?.status(), 200);
  await page.locator("[data-pdf-visual-signature-241]").waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("astro-island[client='load']")]
    .every((island) => !island.hasAttribute("ssr")));
}
async function setup(page, selectedPage = "2") {
  await page.locator("[data-241-source]").setInputFiles(sourceFile);
  await page.locator("[data-241-pages]").waitFor({ timeout: 15000 });
  await page.locator("[data-241-png]").setInputFiles(imageFile);
  await page.locator("[data-241-pages]").fill(selectedPage);
  await page.waitForFunction(() => {
    const original = document.querySelector("[data-241-original]");
    const submit = document.querySelector("[data-pdf-visual-signature-241] button[type=submit]");
    return original?.complete && original.naturalWidth > 0 && submit && !submit.disabled;
  }, null, { timeout: 20000 });
}
async function submitTwice(page) {
  await page.evaluate(() => {
    const form = document.querySelector("[data-pdf-visual-signature-241]");
    for (let i = 0; i < 2; i++)
      assertDispatch(form);
    function assertDispatch(element) {
      if (element.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })))
        throw Error("Unprevented PDF form submit");
    }
  });
}
async function stopFrame(page) {
  await page.evaluate(() => {
    window.__wave24OrigFrame = requestAnimationFrame;
    window.__wave24Frames = [];
    window.requestAnimationFrame = (cb) => { window.__wave24Frames.push(cb); return 8888; };
  });
}
async function releaseFrame(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = window.__wave24OrigFrame;
    for (const cb of window.__wave24Frames.splice(0)) cb(performance.now());
  });
}
async function output(page) {
  const pending = page.waitForEvent("download", { timeout: 20000 });
  await page.locator("[data-241-download]").click();
  const download = await pending;
  assert.match(download.suggestedFilename(), /NON-digitale/u);
  const filepath = await download.path();
  const bytes = await readFile(filepath);
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  const py = `from pypdf import PdfReader
import sys,json,re
r=PdfReader(sys.argv[1],strict=True)
print(json.dumps({"pageCount":len(r.pages),"pages":[{"width":float(p.mediabox.width),"height":float(p.mediabox.height),"stream":p.get_contents().get_data().decode("latin1"),"xObjects":list((p.get("/Resources",{}).get("/XObject",{}) or {}).keys())} for p in r.pages],"hasAcroForm":bool(r.trailer["/Root"].get("/AcroForm"))}))`;
  const inspected = spawnSync("python3", ["-c", py, filepath], { encoding: "utf8", timeout: 12000 });
  assert.equal(inspected.status, 0, `pypdf independent reopen ${inspected.stderr}`);
  const pdf = JSON.parse(inspected.stdout);
  assert.equal(pdf.pageCount, 2);
  assert(!pdf.hasAcroForm, "No certificate, digital signature or form may be introduced");
  const render = async (content, pageNumber) => {
    const task = getDocument({ data: Uint8Array.from(content), useSystemFonts: true, disableFontFace: true });
    try {
      const doc = await task.promise;
      assert.equal(doc.numPages, 2);
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      page.cleanup();
      return { pixels, width: canvas.width, height: canvas.height };
    } finally { await task.destroy(); }
  };
  let changed = 0;
  for (let n = 1; n <= 2; n++) {
    const before = await render(source, n), after = await render(bytes, n);
    assert.deepEqual([after.width, after.height], [before.width, before.height]);
    let marks = 0, outside = 0;
    for (let y = 0; y < after.height; y++) for (let x = 0; x < after.width; x++) {
      const p = (y * after.width + x) * 4;
      const delta = Math.max(...[0, 1, 2].map((c) => Math.abs(after.pixels[p + c] - before.pixels[p + c])));
      if (delta < 40) continue;
      // Selected visual mark is x=48..208, PDF y=48..108 => raster top=height-108..height-48.
      if (x >= 46 && x <= 210 && y >= after.height - 110 && y <= after.height - 46) marks++;
      else outside++;
    }
    if (n === 2) { assert(marks > 80, `Page2 visual overlay missing actual PDF.js pixels: ${marks}`); changed = marks; }
    else assert.equal(marks + outside, 0, "Unselected page1 must be pixel-identical");
    assert.equal(outside, 0, "Visual mark must be restricted to selected exact page/rectangle");
  }
  assert(pdf.pages[1].stream.includes(" Do"), "pypdf page2 must contain genuine image XObject invocation");
  assert(!pdf.pages[0].stream.includes(" Do"), "pypdf page1 not visually signed");
  return { bytes: bytes.length, changedPixels: changed, page2XObjects: pdf.pages[1].xObjects };
}

const server = spawn(resolve(root, "node_modules/.bin/astro"), ["dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--ignore-lock"],
  { cwd: root, stdio: "ignore" });
let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  monitor(page);
  await open(page);
  await count(page, 0);
  await page.locator("[data-241-source]").setInputFiles({ name: sourceName, mimeType: "application/pdf", buffer: Buffer.from("NOT PDF") });
  await page.getByRole("alert").first().waitFor();
  await count(page, 0);
  await setup(page);
  await page.locator("[data-241-pages]").fill("999");
  assert(await page.getByRole("button", { name: /Applica firma visiva/u }).isDisabled());
  await count(page, 0);
  await page.locator("[data-241-pages]").fill("2");
  await page.waitForFunction(() => !document.querySelector("[data-pdf-visual-signature-241] button[type=submit]")?.disabled);
  await submitTwice(page);
  try { await page.locator("[data-241-result]").waitFor({ timeout: 30000 }); }
  catch (reason) { console.error("WAVE24 FIRST SUBMIT DIAGNOSTIC", JSON.stringify({
    body: (await page.locator("[data-pdf-visual-signature-241]").innerText()).slice(-2200),
    alerts: await page.locator("[role=alert]").allInnerTexts(), errors: browserErrors,
    submit: await page.locator("[data-pdf-visual-signature-241] button[type=submit]").isDisabled(),
    preview: await page.locator("[data-241-original]").count(),
  })); throw reason; }
  const firstPdf = await output(page);
  await count(page, 1); // genuine RED before #330 producer hook
  await page.waitForTimeout(200);
  await count(page, 1); // duplicate submit must count ONCE

  await stopFrame(page);
  await submitTwice(page);
  await page.locator("[data-241-cancel]").click();
  await releaseFrame(page);
  await page.waitForTimeout(120);
  assert.equal(await page.locator("[data-241-result]").count(), 0);
  await count(page, 1);
  await stopFrame(page);
  await submitTwice(page);
  await page.locator("[data-241-pages]").fill("997");
  await releaseFrame(page);
  await page.waitForTimeout(120);
  assert.equal(await page.locator("[data-241-result]").count(), 0);
  await count(page, 1);
  await page.locator("[data-241-pages]").fill("2");
  await page.waitForFunction(() => !document.querySelector("[data-pdf-visual-signature-241] button[type=submit]")?.disabled);
  await page.getByRole("button", { name: /Applica firma visiva/u }).click();
  await page.locator("[data-241-result]").waitFor({ timeout: 30000 });
  const secondPdf = await output(page);
  await count(page, 2);
  // A focus/edit change to the text-signature field while RAF is held must
  // invalidate an in-flight image output, not publish a stale prior artifact.
  await page.getByRole("combobox", { name: "Modalità della firma visiva" }).selectOption("text");
  await page.locator("[data-241-text]").fill(secretName);
  await page.waitForFunction(() => !document.querySelector("[data-pdf-visual-signature-241] button[type=submit]")?.disabled);
  await stopFrame(page);
  await submitTwice(page);
  await page.locator("[data-241-text]").fill(secretName + "2");
  await releaseFrame(page);
  await page.waitForTimeout(120);
  assert.equal(await page.locator("[data-241-result]").count(), 0, "Text edited during held worker frame cannot publish stale PDF");
  await count(page, 2);
  await page.locator("[data-241-text]").fill(secretName);
  await page.waitForFunction(() => !document.querySelector("[data-pdf-visual-signature-241] button[type=submit]")?.disabled);
  await page.getByRole("button", { name: /Applica firma visiva/u }).click();
  await page.locator("[data-241-result]").waitFor({ timeout: 30000 });
  const textPdf = await output(page);
  await count(page, 3); // No persisted text or rasterized signature.
  await page.reload({ waitUntil: "networkidle" });
  await count(page, 3);
  assert.equal(await page.locator("[data-241-result]").count(), 0);
  await context.close();

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await denied.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } });
  });
  const blocked = await denied.newPage();
  monitor(blocked);
  await open(blocked);
  await setup(blocked);
  await blocked.getByRole("button", { name: /Applica firma visiva/u }).click();
  await blocked.locator("[data-241-result]").waitFor({ timeout: 30000 });
  const deniedPdf = await output(blocked);
  await denied.close();
  assert.deepEqual(browserErrors, [], "Uncaught JS errors");
  assert.deepEqual(badRequests, [], "No offsite/POST/auth mutation");
  console.log("PASS #330 wave24 Chrome390 visual-only PDF, no certificate:", JSON.stringify({ firstPdf, secondPdf, textPdf, deniedPdf,
    counts: [0, 1, 1, 1, 2, 2, 3], indexedDbDenied: "PDF still downloadable", canonicalMetadataOnly: true, offsite: 0 }));
} finally { await browser?.close(); server.kill("SIGTERM"); }
