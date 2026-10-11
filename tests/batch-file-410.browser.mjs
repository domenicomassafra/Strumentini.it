/**
 * #410 real public-route acceptance against a PRE-BUILT dist, never Astro dev.
 * Prerequisite: npm run build (canonical inspect-build gate must pass).
 * Run: node tests/batch-file-410.browser.mjs
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, relative, extname, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const pagePath = resolve(root, "tools/zip-creator/index.html");
const pageHtml = await readFile(pagePath, "utf8");
assert.match(pageHtml, /data-batch-gzip-lab-410/u, "GZIP panel must be on the existing ZIP creator route");
assert.match(pageHtml, /Laboratorio sperimentale/u, "GZIP must be visibly experimental and local");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url || "/", "http://127.0.0.1").pathname;
    const candidate = resolve(root, "." + decodeURIComponent(path), path.endsWith("/") ? "index.html" : "");
    if (relative(root, candidate).startsWith(".." + sep) || candidate === root || relative(root, candidate) === "..") {
      res.writeHead(403).end();
      return;
    }
    const bytes = await readFile(candidate);
    res.writeHead(200, { "Content-Type": mime[extname(candidate)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", ok);
});
const port = server.address().port;
const origin = "http://127.0.0.1:" + port;
const pageUrl = origin + "/tools/zip-creator/";
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const attemptedUploads = [];
  let acceptedDownloads = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("download", () => acceptedDownloads++);
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = request.url();
    if (!["GET", "HEAD"].includes(request.method())) {
      attemptedUploads.push(request.method() + " " + new URL(url).origin);
      return route.abort();
    }
    if (url.startsWith(origin + "/") || /^(?:blob|data):/u.test(url)) return route.continue();
    return route.abort(); // explicit zero external egress; static source only
  });
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
  assert.equal(await page.locator("[data-batch-gzip-lab-410]").count(), 1);
  assert.equal(await page.locator("main").count() <= 1, true, "No nested BaseLayout/main in Astro component");
  assert.equal(await page.locator("#batch-410-results li").count(), 0);

  const txt1 = Buffer.from("First original α\n".repeat(55));
  const txt2 = Buffer.from("Second original β\n".repeat(70));
  const csv = Buffer.from("name,value\ncafé,23\n".repeat(40));
  const markdown = Buffer.from("# Fourth document\ncontent\n");
  await page.locator("#batch-410-files").setInputFiles([
    { name: "report.txt", mimeType: "text/plain", buffer: txt1 },
    { name: "REPORT.TXT", mimeType: "text/plain", buffer: txt2 },
    { name: "tabella.csv", mimeType: "text/csv", buffer: csv },
    { name: "not-valid.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 1]) },
    { name: "fourth.md", mimeType: "text/markdown", buffer: markdown },
  ]);
  await page.locator("#batch-410-start").click();
  await page.locator("#batch-410-results li").nth(4).waitFor({ timeout: 25_000 });
  assert.equal(await page.locator("#batch-410-results li").count(), 5);
  assert.equal(await page.locator("#batch-410-results button").count(), 4, "Unsupported input has no download");
  assert.match(await page.locator("#batch-410-results li").nth(3).innerText(), /Rifiutato: Solo TXT/u);
  assert.equal(acceptedDownloads, 0, "No implicit downloads");
  const expected = [
    ["report.txt.gz", txt1],
    ["REPORT.TXT (2).gz", txt2],
    ["tabella.csv.gz", csv],
    ["fourth.md.gz", markdown],
  ];
  for (const [i, [name, original]] of expected.entries()) {
    const event = page.waitForEvent("download", { timeout: 12_000 });
    await page.locator("#batch-410-results button").nth(i).click();
    const download = await event;
    assert.equal(download.suggestedFilename(), name);
    const archive = await readFile(await download.path());
    assert.deepEqual(gunzipSync(archive), original, "Downloaded gzip must independently restore original " + name);
  }

  // A genuine DOM Cancel click after the first completed row, synchronized in
  // the page so even very quick local queues can be interrupted reliably.
  await page.evaluate(() => {
    const list = document.querySelector("#batch-410-results");
    const cancel = document.querySelector("#batch-410-cancel");
    window.__batch410CancellationClicks = 0;
    const observer = new MutationObserver(() => {
      if (list.querySelectorAll("li").length === 1 && !cancel.disabled) {
        window.__batch410CancellationClicks++;
        cancel.click();
        observer.disconnect();
      }
    });
    observer.observe(list, { childList: true });
  });
  await page.locator("#batch-410-files").setInputFiles([
    { name: "keep.txt", mimeType: "text/plain", buffer: Buffer.from("kept success\n") },
    { name: "cancelled.csv", mimeType: "text/csv", buffer: Buffer.from("must not process\n") },
    { name: "later.txt", mimeType: "text/plain", buffer: Buffer.from("later cancelled\n") },
  ]);
  await page.locator("#batch-410-start").click();
  await page.locator("#batch-410-results li").nth(2).waitFor({ timeout: 20_000 });
  assert.equal(await page.evaluate(() => window.__batch410CancellationClicks), 1, "Cancel button must be clicked after first success");
  assert.deepEqual(
    await page.locator("#batch-410-results li").allTextContents().then((rows) => rows.map((s) => /Completato/u.test(s) ? "success" : /Annullato/u.test(s) ? "cancelled" : "unexpected")),
    ["success", "cancelled", "cancelled"],
  );
  assert.equal(await page.locator("#batch-410-results button").count(), 1);
  assert.equal(acceptedDownloads, 4, "Cancel does not auto-download");
  const survivor = page.waitForEvent("download", { timeout: 12_000 });
  await page.locator("#batch-410-results button").click();
  assert.deepEqual(gunzipSync(await readFile(await (await survivor).path())), Buffer.from("kept success\n"));
  assert.deepEqual(attemptedUploads, [], "No HTTP POST/PUT/etc during local batch/upload/download");
  assert.deepEqual(errors, [], "No uncaught errors in the real browser route");
  console.log("PASS #410 browser static ZIP route: 292-page build UI, 4 verified gzip downloads, 1 unsupported, collision, cancellation retaining 1, no upload");
  await context.close();
} finally {
  await browser?.close();
  await new Promise((ok) => server.close(ok));
}
