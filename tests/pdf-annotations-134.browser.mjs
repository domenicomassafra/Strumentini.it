/** STR-374 #134: real browser mobile/desktop PDF annotations and downloaded independent PDF.js readback. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

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
const source = await readFile("quality/fixtures/pdf-gold/simple-2page.pdf");
assert.equal(source.subarray(0, 5).toString(), "%PDF-");
try {
  let ready = false;
  for (let i = 0; i < 160; i++) {
    if (server.exitCode !== null) throw new Error("Server died: " + serverLogs.slice(-2000));
    try { const response = await fetch(origin + "/tools/pdf-page-reorder/"); if (response.ok) { ready = true; break; } } catch {}
    await sleep(250);
  }
  assert(ready, "PDF workspace route unavailable: " + serverLogs.slice(-1000));
  browser = await chromium.launch({ headless: true });
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
    await page.screenshot({ path: "/tmp/str134-" + width + ".png", fullPage: true });
    await editor.getByRole("button", { name: "Salva PDF annotato e verifica" }).click();
    await page.locator('[data-result-action="download"]').first().waitFor({ timeout: 35_000 });
    const downloadEvent = page.waitForEvent("download");
    await page.locator('[data-result-action="download"]').first().click();
    const download = await downloadEvent;
    const output = await readFile(await download.path());
    assert.equal(output.subarray(0, 5).toString(), "%PDF-");
    const task = getDocument({ data: new Uint8Array(output) });
    try {
      const pdf = await task.promise;
      assert.equal(pdf.numPages, 2);
      const annotations = await (await pdf.getPage(1)).getAnnotations();
      assert(annotations.some((a) => a.subtype === "Highlight"), "Highlight must be a real PDF annotation");
      assert(annotations.some((a) => a.subtype === "Text" && a.contentsObj?.str === "Nota persistente #134"), "Comment text must survive download");
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
    reports.push({ width, outputBytes: output.length, annotations: 2, ...metrics, screenshot: "/tmp/str134-" + width + ".png" });
    await context.close();
  }
  process.stdout.write(JSON.stringify({ ok: true, results: reports }) + "\n");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
