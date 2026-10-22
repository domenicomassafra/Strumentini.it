/** STR-374 #134: real browser mobile/desktop PDF annotations and downloaded independent PDF.js readback. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, degrees } from "pdf-lib";

const port = 19434;
const origin = "http://127.0.0.1:" + port;
const pythonServer = [
  "from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer",
  "class Handler(SimpleHTTPRequestHandler):",
  " def __init__(self,*args,**kwargs): super().__init__(*args,directory='dist',**kwargs)",
  " def end_headers(self):",
  `  self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'")`,
  "  super().end_headers()",
  "ThreadingHTTPServer(('127.0.0.1',19434),Handler).serve_forever()",
].join("\n");
const server = spawn("python3", ["-c", pythonServer], { stdio: ["ignore", "pipe", "pipe"] });
let serverLogs = "";
for (const stream of [server.stdout, server.stderr]) stream.on("data", (buffer) => { serverLogs += buffer.toString(); });
let browser;
const runnerBrowser = process.env.STR134_BROWSER_MODE === "launch";
const sourcePath = "quality/fixtures/pdf-gold/simple-2page.pdf";
const originalSource = await readFile(sourcePath);
const input = await PDFDocument.load(originalSource);
input.getPage(1).setCropBox(18, 24, 240, 300);
input.getPage(1).setRotation(degrees(90));
const source = Buffer.from(await input.save({ useObjectStreams: false }));
const unchangedInput = Buffer.from(source);
assert.equal(source.subarray(0, 5).toString(), "%PDF-");
function assertRectNear(actual, expected, description) {
  assert(actual && actual.length === 4, description + ": missing /Rect");
  expected.forEach((value, index) => assert(Math.abs(actual[index] - value) < 1,
    `${description}: /Rect[${index}] is ${actual[index]}, expected ${value}`));
}
try {
  let ready = false;
  for (let i = 0; i < 160; i++) {
    if (server.exitCode !== null) throw new Error("Server died: " + serverLogs.slice(-2000));
    try { const response = await fetch(origin + "/tools/pdf-page-reorder/"); if (response.ok) { ready = true; break; } } catch {}
    await sleep(250);
  }
  assert(ready, "PDF workspace route unavailable: " + serverLogs.slice(-1000));
  // GitHub CI owns an isolated Chromium; MiniPC reuses the authorized shared CDP browser.
  browser = runnerBrowser
    ? await chromium.launch({ headless: true })
    : await chromium.connectOverCDP("http://127.0.0.1:17629");
  const reports = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 880 }, isMobile: width === 390, hasTouch: width === 390, acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [], egress = [];
    await page.addInitScript(() => {
      window.__str134CspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        window.__str134CspViolations.push(event.effectiveDirective + " " + event.blockedURI);
      });
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(origin + "/") || /^(blob|data):/u.test(url)) return route.continue();
      egress.push(route.request().method() + " " + url);
      return route.abort();
    });
    const response = await page.goto(origin + "/tools/pdf-page-reorder/", { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(() => Array.from(document.querySelectorAll("astro-island")).every((island) => !island.hasAttribute("ssr")), null, { timeout: 30_000 });
    await page.locator('input[type="file"][accept*="pdf"]').first().setInputFiles({ name: "proof134.pdf", mimeType: "application/pdf", buffer: source });
    await page.locator("[data-pdf-thumbnail-workspace]").waitFor({ timeout: 25_000 });
    await page.getByRole("button", { name: "Evidenzia, commenta e annota le pagine" }).click();
    const editor = page.locator("[data-pdf-annotations-134]");
    await editor.waitFor();
    await editor.locator("img").first().waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-pdf-annotations-134] img');
      return img && img.complete && img.naturalWidth > 0;
    }, null, { timeout: 30_000 });
    await editor.getByRole("button", { name: "Aggiungi con coordinate" }).click();
    await editor.getByRole("radio", { name: "Commento" }).check();
    await editor.getByRole("textbox", { name: "Testo del commento" }).fill("Nota persistente #134");
    const previousPreview = await editor.locator("img").getAttribute("src");
    await editor.getByRole("combobox", { name: "Pagina da annotare" }).selectOption("2");
    await editor.getByRole("combobox", { name: "Ruota anteprima" }).selectOption("90");
    await editor.getByRole("combobox", { name: "Zoom anteprima" }).selectOption("1.5");
    await page.waitForFunction((previous) => {
      const next = document.querySelector('[data-pdf-annotations-134] img');
      return next && next.complete && next.naturalWidth > 0 && next.getAttribute("src") !== previous;
    }, previousPreview, { timeout: 30_000 });
    if (width === 390) {
      const overlay = editor.getByRole("img", { name: "Area touch per annotazioni PDF" });
      const box = await overlay.boundingBox();
      assert(box);
      await page.touchscreen.tap(box.x + box.width * 0.64, box.y + box.height * 0.25);
    } else {
      await editor.getByRole("button", { name: "Aggiungi con coordinate" }).focus();
      await page.keyboard.press("Enter");
    }
    assert.match(await editor.locator('[role="status"]').last().innerText(), /2 annotazioni/u);
    // A second position uses a different display rotation and zoom. Its PDF rectangle
    // is calculated from the fixture's known CropBox, not from the editor viewport.
    const beforeSecondRotation = await editor.locator("img").getAttribute("src");
    await editor.getByRole("combobox", { name: "Ruota anteprima" }).selectOption("270");
    await editor.getByRole("combobox", { name: "Zoom anteprima" }).selectOption("0.75");
    await page.waitForFunction((previous) => {
      const img = document.querySelector('[data-pdf-annotations-134] img');
      return img && img.complete && img.naturalWidth > 0 && img.getAttribute("src") !== previous;
    }, beforeSecondRotation, { timeout: 30_000 });
    await editor.getByRole("radio", { name: "Evidenzia" }).check();
    for (const [field, value] of [["x", "10"], ["y", "30"], ["w", "20"], ["h", "15"]]) {
      await editor.getByRole("spinbutton", { name: field + " percentuale" }).fill(value);
    }
    await editor.getByRole("button", { name: "Aggiungi con coordinate" }).click();
    assert.match(await editor.locator('[role="status"]').last().innerText(), /3 annotazioni/u);
    await page.screenshot({ path: "/tmp/str134-" + width + ".png", fullPage: true });
    await editor.getByRole("button", { name: "Salva PDF annotato e verifica" }).click();
    await page.locator('[data-result-action="download"]').first().waitFor({ timeout: 35_000 });
    const downloadEvent = page.waitForEvent("download");
    await page.locator('[data-result-action="download"]').first().click();
    const download = await downloadEvent;
    const output = await readFile(await download.path());
    assert.equal(output.subarray(0, 5).toString(), "%PDF-");
    assert.deepEqual(source, unchangedInput, "Uploaded PDF must remain byte-for-byte unchanged");
    assert.deepEqual(await readFile(sourcePath), originalSource, "Original fixture must remain byte-for-byte unchanged");
    const task = getDocument({ data: new Uint8Array(output) });
    try {
      const pdf = await task.promise;
      assert.equal(pdf.numPages, 2);
      const firstAnnotations = await (await pdf.getPage(1)).getAnnotations();
      const secondAnnotations = await (await pdf.getPage(2)).getAnnotations();
      assert(firstAnnotations.some((a) => a.subtype === "Highlight"), "Page-one highlight must be a real PDF annotation");
      const note = secondAnnotations.find((a) => a.subtype === "Text" && a.contentsObj?.str === "Nota persistente #134");
      assert(note, "Page-two comment must survive rotation, zoom and download");
      assertRectNear(note.rect, width === 390 ? [104.4, 99, 126.4, 121] : [138, 84, 160, 106],
        "Note from rotated view at 150% zoom");
      const highlight = secondAnnotations.find((a) => a.subtype === "Highlight");
      assertRectNear(highlight?.rect, [42, 189, 90, 234], "Highlight from upright view at 75% zoom");
      assert.equal((await pdf.getPage(2)).rotate, 90);
    } finally { await task.destroy(); }
    assert.deepEqual(pageErrors, [], "Browser JavaScript errors");
    assert.deepEqual(egress, [], "Unexpected network egress");
    assert.deepEqual(await page.evaluate(() => window.__str134CspViolations), [], "CSP violations in built editor");
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      renderedPixels: (() => { const img = document.querySelector("[data-pdf-annotations-134] img"); return img ? img.naturalWidth * img.naturalHeight : 0; })(),
      sourceRequests: performance.getEntriesByType("resource").filter((e) => e.name.includes("pdf")).length,
    }));
    assert(metrics.renderedPixels > 0 && metrics.renderedPixels <= 960 * 1200, "Canvas memory budget");
    // Integration with #138: a project B restored over annotated A must not
    // inherit A's in-memory marks or the stale annotation download.
    const alternate = await PDFDocument.create();
    alternate.addPage([455, 500]).drawText("SECOND_PROJECT_B");
    const alternateBytes = Buffer.from(await alternate.save({ useObjectStreams: false }));
    const unchangedB = Buffer.from(alternateBytes);
    const fileInput = page.getByLabel("PDF da modificare");
    await fileInput.setInputFiles({ name: "project-B.pdf", mimeType: "application/pdf", buffer: alternateBytes });
    await page.locator("[data-pdf-order-status]").filter({ hasText: /1 pagine/u }).waitFor();
    await page.getByRole("button", { name: "Salva copia del progetto su questo dispositivo" }).click();
    await page.locator("[data-pdf-project-message]").getByText(/hash SHA-256 verificato/u).waitFor();
    await fileInput.setInputFiles({ name: "project-A.pdf", mimeType: "application/pdf", buffer: source });
    await page.locator("[data-pdf-order-status]").filter({ hasText: /2 pagine/u }).waitFor();
    await page.getByRole("button", { name: "Evidenzia, commenta e annota le pagine" }).click();
    await editor.waitFor();
    await editor.getByRole("button", { name: "Aggiungi con coordinate" }).click();
    assert.match(await editor.locator('[role="status"]').last().innerText(), /1 annotazioni/u);
    await page.getByRole("button", { name: "Riprendi progetto" }).click();
    await page.locator("[data-pdf-order-status]").filter({ hasText: /1 pagine/u }).waitFor();
    await editor.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Evidenzia, commenta e annota le pagine" }).click();
    await editor.waitFor();
    assert.match(await editor.locator('[role="status"]').last().innerText(), /0 annotazioni/u);
    assert(await editor.getByRole("button", { name: "Salva PDF annotato e verifica" }).isDisabled());
    assert.equal(await page.getByText("Nota persistente #134").count(), 0);
    await page.getByRole("button", { name: "Crea PDF e verifica" }).click();
    await page.locator('[data-result-action="download"]').first().waitFor({ timeout: 30_000 });
    const resumedDownload = page.waitForEvent("download");
    await page.locator('[data-result-action="download"]').first().click();
    const resumedBytes = await readFile(await (await resumedDownload).path());
    const resumedPdf = await PDFDocument.load(resumedBytes);
    assert.equal(resumedPdf.getPage(0).getWidth(), 455, "restored B exported A's pages");
    assert.equal(resumedPdf.getPageCount(), 1);
    assert.deepEqual(source, unchangedInput);
    assert.deepEqual(alternateBytes, unchangedB);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(egress, []);
    reports.push({ width, outputBytes: output.length, annotations: 3, crossProjectMarks: 0,
      restoredPageWidth: 455, ...metrics, screenshot: "/tmp/str134-" + width + ".png" });
    await context.close();
  }
  process.stdout.write(JSON.stringify({ ok: true, results: reports }) + "\n");
} finally {
  if (browser) {
    if (runnerBrowser) await browser.close();
    else browser._connection.close();
  }
  server.kill("SIGTERM");
}
