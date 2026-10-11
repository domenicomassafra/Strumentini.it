/** Browser #339: actual JSON bytes, default manual, opted-in future downloads. */
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19449;
const origin = process.env.DOWNLOAD339_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.DOWNLOAD339_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* local only */ }
    if (server?.exitCode != null) throw new Error(`Dev server failed: ${server.exitCode}`);
    if (i === 79) throw new Error("Local Astro server unavailable");
    await sleep(250);
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  assert.equal((await page.goto(`${origin}/tools/bulk-domain-extractor/`))?.status(), 200);
  // Do not submit against SSR-only markup before the Preact island has
  // installed onInput handlers; otherwise an empty value can be "completed".
  const waitHydration=async(target)=>target.waitForFunction(()=>{
    const island=document.querySelector('astro-island[component-url*="BulkDomainExtractorTool"]');
    return island && !island.hasAttribute("ssr");
  },null,{timeout:25_000});
  await waitHydration(page);
  const input = page.getByRole("textbox", { name: "URL o domini" });
  const run = page.getByRole("button", { name: /Estrai domini/u });
  await input.fill("https://Example.COM/first");
  await run.click();
  const opt = page.locator("[data-download-optin339] input[type=checkbox]");
  await opt.waitFor({ state: "visible" });
  assert.equal(await opt.isChecked(), false, "auto must default OFF");
  assert.equal(await page.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), null);

  const manual = page.getByRole("button", { name: "Scarica risultato" });
  const [downloadManual] = await Promise.all([page.waitForEvent("download"), manual.click()]);
  assert.equal(downloadManual.suggestedFilename(), "bulk-domain-extractor.json");
  const manualJson = JSON.parse(await readFile(await downloadManual.path(), "utf8"));
  assert(JSON.stringify(manualJson).toLowerCase().includes("example.com"));

  let downloads = 0;
  page.on("download", () => downloads++);
  await opt.check();
  assert.equal(await page.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), "enabled");
  await sleep(150);
  assert.equal(downloads, 0, "toggling ON must not re-download an already displayed result");
  await input.fill("https://second.example.org/new");
  const futureDownload = page.waitForEvent("download", { timeout: 10_000 });
  await run.click();
  const autoFile = await futureDownload;
  const autoJson = JSON.parse(await readFile(await autoFile.path(), "utf8"));
  assert(JSON.stringify(autoJson).includes("second.example.org"));
  assert.equal(downloads, 1, "one opted-in completion must emit exactly one download");

  // Simulated browser download API denial: no fake success and same result
  // remains available. Real popup/OS policies vary by browser and device.
  await page.evaluate(() => {
    window.__download339Original = URL.createObjectURL;
    URL.createObjectURL = () => { throw new Error("browser-denied-mock"); };
  });
  await input.fill("https://blocked.example.org/");
  await run.click();
  await page.getByText("Download automatico non disponibile", { exact: false }).waitFor();
  assert.equal(downloads, 1);
  await page.evaluate(() => { URL.createObjectURL = window.__download339Original; });

  await opt.uncheck();
  assert.equal(await page.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), null);
  await input.fill("https://third.example.net/");
  await run.click();
  await page.getByText("Download automatico disattivato", { exact: false }).count();
  await sleep(200);
  assert.equal(downloads, 1, "revoking opt-in must prevent later auto-downloads");
  await page.reload({ waitUntil: "networkidle" });
  // The interactive Preact island hydrates after Astro HTML; a click before
  // hydration is native form submission, not a completed local operation.
  await page.waitForTimeout(250);
  await input.fill("https://final.example.info/");
  await run.click();
  await opt.waitFor({ state: "visible" });
  assert.equal(await opt.isChecked(), false, "revocation persists across reload");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  assert.deepEqual(errors, []);
  await context.close();

  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await deniedContext.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "strumentini:auto-download:v1") throw new DOMException("blocked", "SecurityError");
      return original.call(this, key, value);
    };
  });
  const deniedPage = await deniedContext.newPage();
  await deniedPage.goto(`${origin}/tools/bulk-domain-extractor/`, { waitUntil: "networkidle" });
  await waitHydration(deniedPage);
  await deniedPage.getByRole("textbox", { name: "URL o domini" }).fill("https://denied.example.com/");
  await deniedPage.getByRole("button", { name: /Estrai domini/u }).click();
  const deniedToggle = deniedPage.locator("[data-download-optin339] input[type=checkbox]");
  await deniedToggle.waitFor();
  // Click rather than Playwright's check(): a correct denied-storage handler
  // immediately reverts the controlled checkbox to OFF.
  await deniedToggle.click();
  assert.equal(await deniedToggle.isChecked(), false, "storage denial must fail closed to OFF");
  await deniedPage.getByText("Impossibile salvare la preferenza", { exact: false }).waitFor();
  await deniedContext.close();
  console.log("#339 local Chromium PASS: exact manual JSON bytes, auto OFF default, one file after opt-in, API denial fallback, storage denial OFF, revoke and reload, 390px");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
