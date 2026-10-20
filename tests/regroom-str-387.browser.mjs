/** #146 STR-387: real compiled CSV consumer against the existing MiniPC automation-browser. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 18387;
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser, context, page;
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("Static preview exited unexpectedly");
    try { if ((await fetch(origin)).ok) break; } catch { /* starting */ }
    if (i === 99) throw Error("Static preview unavailable");
    await delay(200);
  }
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629", { timeout: 45000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on("request", request => requests.push({ url: request.url(), method: request.method() }));
  page.on("pageerror", error => errors.push(String(error)));
  assert.equal((await page.goto(origin + "/tools/csv-cleaner/", { waitUntil: "domcontentloaded" })).status(), 200);
  await page.getByLabel("File CSV").setInputFiles({
    name: "legacy.csv", mimeType: "text/csv",
    buffer: Buffer.from("6e616d653b69640a636166e93b310a616e6ee93b320a", "hex"),
  });
  await page.getByRole("button", { name: "Pulisci CSV" }).click();
  const alert = page.getByRole("alert");
  await alert.getByText(/byte non UTF-8/u).waitFor({ timeout: 15000 });
  assert.equal(await page.getByRole("button", { name: /Scarica/u }).count(), 0, "invalid CSV must never offer a degraded output");

  const valid = "name;id\ncafé;1\nanné;2\n";
  await page.getByLabel("File CSV").setInputFiles({
    name: "valid.csv", mimeType: "text/csv", buffer: Buffer.from(valid, "utf8"),
  });
  await page.getByRole("button", { name: "Pulisci CSV" }).click();
  await page.getByText("café", { exact: true }).waitFor({ timeout: 15000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Scarica/u }).first().click();
  const download = await downloadPromise;
  assert.equal(await readFile(await download.path(), "utf8"), valid, "download preserves source UTF-8 bytes");
  assert.equal(download.suggestedFilename(), "valid.clean.csv");
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter(item => !item.url.startsWith(origin)), [], "no external network");
  assert.deepEqual(requests.filter(item => !["GET", "HEAD"].includes(item.method)), [], "no uploads");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  console.log(JSON.stringify({ status:"PASS", source:"compiled Astro preview", viewport:"390x844", invalidEncoding:"REFUSED", validUtf8:"PRESERVED", output:"valid.clean.csv", egress:0, uploads:0, pageErrors:0 }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  if (page && context) {
    try { await Promise.race([(async () => { await page.close(); await context.close(); })(), delay(5000)]); } catch { /* browser shutdown */ }
  }
  if (browser) await browser.close().catch(() => undefined);
  process.exit(process.exitCode ?? 0);
}
