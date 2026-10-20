/** #277 MiniPC built app + existing automation-browser CDP: viewport 390; no physical Safari claim. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19377;
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
async function ready() {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("Static server exited");
    try { if ((await fetch(origin)).ok) return; } catch { /* initial startup */ }
    await delay(200);
  }
  throw Error("Static server unavailable");
}

let page;
let context;
try {
  await ready();
  const browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await context.newPage();
  const network = [];
  const pageErrors = [];
  const cspErrors = [];
  page.on("request", (request) => network.push({ url: request.url(), method: request.method() }));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /content security policy|violates the following/i.test(message.text())) cspErrors.push(message.text());
  });
  const policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'";
  await page.route(origin + "/tools/toml-formatter/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": policy } });
  });
  const result = await page.goto(origin + "/tools/toml-formatter/", { waitUntil: "domcontentloaded" });
  assert.equal(result?.status(), 200);
  await page.locator('form[aria-label] textarea').first().waitFor();
  const chunksBefore = network.filter((entry) => entry.url.includes("/_astro/") && entry.url.endsWith(".js")).length;
  const doc = [
    'title = "Caffè"',
    'created = 1979-05-27',
    '[[server]]',
    'host = "alpha"',
    '[[server]]',
    'host = "beta"',
  ].join("\n") + "\n";
  await page.locator('form[aria-label] textarea').first().fill(doc);
  await page.locator('form[aria-label] button[type="submit"]').first().click();
  const save = page.getByRole("button", { name: /Scarica/i }).first();
  await save.waitFor({ timeout: 30_000 });
  const downloadPromise = page.waitForEvent("download");
  await save.click();
  const download = await downloadPromise;
  const saved = await readFile(await download.path(), "utf8");
  assert.match(saved, /title = "Caffè"/u);
  assert.match(saved, /1979-05-27/u);
  assert.match(saved, /\[\[server\]\]/u);
  assert.equal((saved.match(/host = "/gu) ?? []).length, 2);
  assert.equal(download.suggestedFilename(), "toml-formatter-risultato.toml");
  const chunksAfter = network.filter((entry) => entry.url.includes("/_astro/") && entry.url.endsWith(".js")).length;
  assert.ok(chunksAfter > chunksBefore, "donor must be fetched lazily on TOML submit");
  assert.deepEqual(network.filter((entry) => !entry.url.startsWith(origin)), [], "no external requests");
  assert.deepEqual(network.filter((entry) => !["GET", "HEAD"].includes(entry.method)), [], "no POST or upload");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(cspErrors, []);
  console.log(JSON.stringify({ ok: true, viewport: "390x844", download: download.suggestedFilename(), outputBytes: Buffer.byteLength(saved), chunksBefore, chunksAfter, requests: network.length, externalRequests: 0, uploads: 0, cspErrors: 0, pageErrors: 0 }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  if (page && context) {
    await Promise.race([(async () => { await page.close(); await context.close(); })(), delay(5000)]);
  }
  process.exit(process.exitCode ?? 0);
}
