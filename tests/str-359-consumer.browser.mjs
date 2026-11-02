// #120 / STR-359: compiled dist consumer, real local operations and five widths.
// Run from repository root after npm run build: node tests/str-359-consumer.browser.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const dist = resolve("dist");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) return response.writeHead(405).end();
    const path = new URL(request.url, "http://localhost").pathname;
    const filename = resolve(dist, path.replace(/^\/+/, ""), path.endsWith("/") ? "index.html" : "");
    if (!filename.startsWith(dist + sep)) return response.writeHead(403).end();
    const file = (await stat(filename)).isDirectory() ? resolve(filename, "index.html") : filename;
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : await readFile(file));
  } catch { response.writeHead(404).end(); }
});
const origin = await new Promise((resolveOrigin, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => resolveOrigin(`http://127.0.0.1:${server.address().port}`));
});
const browser = await chromium.launch({ headless: true, ...(process.platform === "darwin" ? { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" } : {}) });
const sizes = [320, 390, 768, 1024, 1440];
const outbound = [];

try {
  for (const width of sizes) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (!request.url().startsWith(origin + "/") && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) outbound.push(request.url());
      if (!["GET", "HEAD"].includes(request.method())) outbound.push(`${request.method()} ${request.url()}`);
    });
    await page.goto(`${origin}/risorse/#come-funziona`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".resources-heading h1").count(), 1);
    assert.equal(await page.getByRole("heading", { name: "Stati e ripresa" }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}: no horizontal overflow on resources`);
    await page.goto(`${origin}/tools/filename-sanitizer/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
      .every((island) => !island.hasAttribute("ssr")));
    const result = page.locator(".result-panel");
    assert.equal(await result.getAttribute("data-state"), "idle", `${width}: initial state`);
    assert.equal(await result.locator("[data-result-class]").count(), 0, `${width}: no stale result`);
    await page.getByRole("button", { name: "Esegui in locale" }).click();
    await result.locator('[data-result-state="error"]').waitFor();
    assert.equal(await result.locator("[data-result-class]").count(), 0, `${width}: failed input cannot be a success`);
    await page.getByPlaceholder("Un nome per riga").fill("originale.txt");
    assert.equal(await result.getAttribute("data-state"), "idle", `${width}: editing invalidates failure`);
    if (width === 390) await context.setOffline(true);
    await page.getByRole("button", { name: "Esegui in locale" }).click();
    await result.locator('[data-result-state="success"]').waitFor();
    assert(await result.locator("[data-result-class]").count() > 0, `${width}: result is actually present`);
    assert.equal(await page.getByPlaceholder("Un nome per riga").inputValue(), "originale.txt", `${width}: input unchanged`);
    if (width === 390) await context.setOffline(false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}: tool no horizontal overflow`);
    assert.deepEqual(errors, [], `${width}: no uncaught browser errors`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Hold a genuine File read open until after clicking Annulla, then let the
  // actual engine notice AbortSignal. No mocked tool result or synthetic click.
  await context.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 750));
      return original.call(this);
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => outbound.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin + "/") && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) outbound.push(request.url());
    if (!["GET", "HEAD"].includes(request.method())) outbound.push(`${request.method()} ${request.url()}`);
  });
  await page.goto(`${origin}/tools/batch-checksum-manifest/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((island) => !island.hasAttribute("ssr")));
  await page.locator('input[type="file"]').setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("contenuto") });
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  const panel = page.locator(".result-panel");
  await panel.locator('[data-result-state="running"]').waitFor();
  await page.getByRole("button", { name: "Annulla" }).click();
  await panel.locator('[data-result-state="cancelled"]').waitFor({ timeout: 5000 });
  assert.equal(await panel.locator("[data-result-class]").count(), 0, "cancelled work cannot publish output");
  assert.equal(await page.locator('input[type="file"]').evaluate((element) => element.files[0]?.name), "note.txt", "cancel retains source selection");
  assert.match(await panel.innerText(), /Annullata/u);
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  await panel.locator('[data-result-state="success"]').waitFor();
  await page.goto(`${origin}/tools/zip-contents-inspector/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => [...document.querySelectorAll('astro-island[client="load"]')]
    .every((island) => !island.hasAttribute("ssr")));
  await page.locator('input[type="file"]').setInputFiles({ name: "non-zip.zip", mimeType: "application/zip", buffer: Buffer.from("not a ZIP archive") });
  await page.getByRole("button", { name: "Esegui in locale" }).click();
  const invalidZip = page.locator(".result-panel");
  await invalidZip.locator('[data-result-state="error"]').waitFor();
  assert.equal(await invalidZip.locator("[data-result-class]").count(), 0, "unsupported/corrupt ZIP cannot publish a success");
  assert.match(await page.locator('[data-tool-error]').innerText(), /archivio|ZIP/iu);
  await context.close();
  assert.deepEqual(outbound, [], "no unexpected requests, uploads, or console page errors");
  console.log("PASS #120 STR-359 built consumer: idle/loading/error/success, offline-local, corrupt ZIP refusal, cancellation and retry; five widths 320/390/768/1024/1440, no page errors or unexpected network requests");
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
