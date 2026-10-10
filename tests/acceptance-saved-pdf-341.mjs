/** #341 real browser: explicit save -> readback -> reload/reopen -> scoped delete. */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { createSimplePdf } from "../src/engines/pdf/writer.ts";

const port = 19441;
const origin = process.env.PDF341_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.PDF341_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* local server */ }
    if (server?.exitCode != null) throw new Error("Astro startup failed");
    if (i === 79) throw new Error("Astro server unavailable");
    await sleep(250);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errorEvents = [];
  const nonGetRequests = [];
  page.on("pageerror", (error) => errorEvents.push(error.message));
  page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) nonGetRequests.push(request.url()); });
  assert.equal((await page.goto(`${origin}/tools/pdf-merge/`, { waitUntil: "networkidle" }))?.status(), 200);
  const pdfA = Buffer.from(createSimplePdf(["LOCAL341_A"]));
  const pdfB = Buffer.from(createSimplePdf(["LOCAL341_B"]));
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: pdfA },
    { name: "b.pdf", mimeType: "application/pdf", buffer: pdfB },
  ]);
  await page.getByRole("button", { name: "Unisci PDF", exact: true }).click();
  const save = page.locator("[data-saved-pdf341-save] button");
  await save.waitFor({ state: "visible" });
  const preservedOutputDownload = await page.locator(".result-panel").innerText();
  assert(preservedOutputDownload.includes("Scarica"));
  const list = page.locator("[data-saved-pdf341-list] > li");
  assert.equal(await list.count(), 0);
  await save.click();
  await list.first().waitFor({ state: "visible" });
  assert.equal(await list.count(), 1);
  assert((await page.locator("[data-saved-pdf341-status]").innerText()).includes("conservato"));
  assert.equal(nonGetRequests.length, 0, "saving exact PDF bytes must not POST anywhere");

  // Bounded voluntary storage: a sixth save must refuse without deleting the
  // five records or the successfully generated downloadable PDF.
  for (let n = 2; n <= 5; n++) {
    await save.click();
    await page.waitForFunction((count) => document.querySelectorAll("[data-saved-pdf341-list] > li").length === count, n);
  }
  assert.equal(await list.count(), 5);
  await save.click();
  await page.getByText("Impossibile conservare il PDF", { exact: false }).waitFor();
  assert.equal(await list.count(), 5, "full quota cannot evict an unrelated saved file");
  assert((await page.locator(".result-panel").innerText()).includes("Scarica"));

  await page.reload({ waitUntil: "networkidle" });
  await list.first().waitFor({ state: "visible" });
  assert.equal(await list.count(), 5);
  assert.equal(await save.count(), 0, "reloading doesn't pretend a previous operation/result survived");
  await page.getByRole("button", { name: "Riapri come input" }).first().click();
  await page.getByText(/PDF conservato riaperto come input/u).waitFor();
  assert.equal(await page.locator('input[type="file"]').first().evaluate((input) => input.files?.length ?? -1), 0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica PDF conservato" }).first().click();
  const fileDownload = await downloadPromise;
  assert.equal(fileDownload.suggestedFilename(), "merged.pdf");

  page.on("dialog", (dialog) => { void dialog.accept(); });
  await page.getByRole("button", { name: "Elimina PDF conservato" }).first().click();
  await page.waitForFunction(() => document.querySelectorAll("[data-saved-pdf341-list] > li").length === 4);
  assert.equal(await list.count(), 4, "deleting one saved PDF must preserve four others");
  for (let remaining = 4; remaining > 0; remaining--) {
    await page.getByRole("button", { name: "Elimina PDF conservato" }).first().click();
    await page.waitForFunction((count) => document.querySelectorAll("[data-saved-pdf341-list] > li").length === count || count === 0 && !!document.querySelector("[data-saved-pdf341-empty]"), remaining - 1);
  }
  await page.locator("[data-saved-pdf341-empty]").waitFor({ state: "visible" });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-saved-pdf341-empty]").waitFor({ state: "visible" });
  assert.deepEqual(errorEvents, []);
  assert.equal(nonGetRequests.length, 0);

  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await deniedContext.addInitScript(() => {
    const originalOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, version) {
      if (name === "strumentini-optin-pdf-341") throw new DOMException("storage denied", "SecurityError");
      return version === undefined ? originalOpen.call(this, name) : originalOpen.call(this, name, version);
    };
  });
  const denied = await deniedContext.newPage();
  await denied.goto(`${origin}/tools/pdf-merge/`, { waitUntil: "networkidle" });
  await denied.locator('input[type="file"]').first().setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: pdfA },
    { name: "b.pdf", mimeType: "application/pdf", buffer: pdfB },
  ]);
  await denied.getByRole("button", { name: "Unisci PDF", exact: true }).click();
  const deniedSave = denied.locator("[data-saved-pdf341-save] button");
  await deniedSave.waitFor({ state: "visible" });
  await deniedSave.click();
  await denied.getByText("Impossibile conservare il PDF", { exact: false }).waitFor();
  assert((await denied.locator(".result-panel").innerText()).includes("Scarica"));
  await deniedContext.close();
  await browser.close();
  browser = undefined;
  console.log("#341 local Chromium PASS: explicit PDF save/readback/reload/reopen/download; five-record quota rejects sixth without eviction; scoped delete; storage denial leaves manual download; zero POST");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
