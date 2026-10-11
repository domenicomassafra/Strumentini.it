/** #339 WAV producer: actual PCM16 bytes and user-controlled browser downloads. */
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 19463;
const origin = process.env.DOWNLOAD339_WAV_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.DOWNLOAD339_WAV_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });
const frames = 800;
const source = Buffer.alloc(44 + frames * 2);
source.write("RIFF", 0); source.writeUInt32LE(source.length - 8, 4);
source.write("WAVEfmt ", 8); source.writeUInt32LE(16, 16);
source.writeUInt16LE(1, 20); source.writeUInt16LE(1, 22);
source.writeUInt32LE(8000, 24); source.writeUInt32LE(16000, 28);
source.writeUInt16LE(2, 32); source.writeUInt16LE(16, 34);
source.write("data", 36); source.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++) source.writeInt16LE([-16000, 0, 16000, 0][i % 4], 44 + i * 2);

let browser;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/tools/audio-generator/`)).ok) break; } catch { /* localhost only */ }
    if (server?.exitCode != null) throw new Error(`Local Astro failed: ${server.exitCode}`);
    if (i === 99) throw new Error("Local Astro route unavailable");
    await sleep(200);
  }
  browser = await chromium.launch({ headless: true });
  const requests = [];
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/*", (route) => {
    const request = route.request();
    if (request.method() === "GET" && (request.url().startsWith(origin + "/") || request.url().startsWith("blob:") || request.url().startsWith("data:"))) return route.continue();
    requests.push(`${request.method()} ${request.url()}`);
    return route.abort();
  });
  await page.goto(`${origin}/tools/audio-generator/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="AudioGeneratorTool"]');
    return island && !island.hasAttribute("ssr");
  });
  const panel = page.locator("[data-audio-timeline-231]");
  const render = panel.getByRole("button", { name: "Elabora e mostra waveform" });
  const input = panel.locator('input[type="file"]');
  const opt = panel.locator('[data-download-optin339] input[type="checkbox"]');
  const manual = panel.getByRole("button", { name: "Scarica WAV PCM16 verificato" });
  let downloads = 0;
  page.on("download", () => downloads++);
  assert.equal(await opt.isChecked(), false, "Auto download must default OFF");
  assert.equal(await page.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), null);
  await input.setInputFiles({ name: "input.wav", mimeType: "audio/wav", buffer: source });
  await render.click();
  await manual.waitFor({ state: "visible" });
  await sleep(250);
  assert.equal(downloads, 0, "No auto download without user opt-in");
  const manualEvent = page.waitForEvent("download");
  await manual.click();
  const manualFile = await manualEvent;
  assert.equal(manualFile.suggestedFilename(), "montaggio-pcm16.wav");
  assert.deepEqual(await readFile(await manualFile.path()), source, "Downloaded WAV bytes must match the known-good PCM16 fixture");

  await opt.check();
  assert.equal(await page.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), "enabled");
  await sleep(200);
  assert.equal(downloads, 1, "Enabling after completion must not retro-download");
  const autoEvent = page.waitForEvent("download");
  await render.click();
  const autoFile = await autoEvent;
  assert.deepEqual(await readFile(await autoFile.path()), source);
  await sleep(150);
  assert.equal(downloads, 2, "One completed WAV should request one automatic download");

  await page.evaluate(() => {
    window.__download339WavOriginal = URL.createObjectURL;
    URL.createObjectURL = () => { throw new Error("browser download denied"); };
  });
  await render.click();
  await panel.getByText("Download automatico non disponibile", { exact: false }).waitFor();
  assert.equal(await manual.count(), 1, "Manual fallback remains available after browser API denial");
  await manual.click();
  await panel.getByText("Download non disponibile", { exact: false }).waitFor();
  assert.equal(downloads, 2, "Denied download cannot report a new download");
  await page.evaluate(() => { URL.createObjectURL = window.__download339WavOriginal; });
  const recoveredManual = page.waitForEvent("download");
  await manual.click();
  assert.deepEqual(await readFile(await (await recoveredManual).path()), source, "Manual retry must use the previously verified WAV bytes");

  await page.evaluate(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === "strumentini:auto-download:v1") throw new DOMException("remove denied", "SecurityError");
      return remove.call(this, key);
    };
  });
  // A rejected change leaves the controlled checkbox checked. click() tests
  // that behavior; uncheck() would incorrectly demand a successful revocation.
  await opt.click();
  assert.equal(await opt.isChecked(), true, "Failed removeItem must not falsely show auto OFF");
  await panel.getByText("Impossibile revocare", { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), "enabled");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="AudioGeneratorTool"]');
    return island && !island.hasAttribute("ssr");
  });
  assert.equal(await page.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), "enabled", "Failed revocation must leave the real enabled key persisted across reload");
  await page.waitForFunction(() => document.querySelector('[data-audio-timeline-231] [data-download-optin339] input')?.checked === true);
  assert.equal(await opt.isChecked(), true, "Stored consent remains ON after failed revocation and reload");
  await opt.uncheck();
  assert.equal(await page.evaluate(() => localStorage.getItem("strumentini:auto-download:v1")), null);
  await input.setInputFiles({ name: "input.wav", mimeType: "audio/wav", buffer: source });
  await render.click();
  await manual.waitFor();
  await sleep(200);
  assert.equal(downloads, 3, "Revocation must prevent subsequent automatic downloads");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="AudioGeneratorTool"]');
    return island && !island.hasAttribute("ssr");
  });
  assert.equal(await opt.isChecked(), false, "Revocation survives reload");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
  await context.close();

  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await denied.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "strumentini:auto-download:v1") throw new DOMException("storage denied", "SecurityError");
      return original.call(this, key, value);
    };
  });
  const deniedPage = await denied.newPage();
  await deniedPage.goto(`${origin}/tools/audio-generator/`, { waitUntil: "networkidle" });
  await deniedPage.waitForFunction(() => {
    const island = document.querySelector('astro-island[component-url*="AudioGeneratorTool"]');
    return island && !island.hasAttribute("ssr");
  });
  const deniedPanel = deniedPage.locator("[data-audio-timeline-231]");
  const deniedOpt = deniedPanel.locator('[data-download-optin339] input[type="checkbox"]');
  await deniedOpt.click();
  assert.equal(await deniedOpt.isChecked(), false, "Denied persistence cannot silently enable auto");
  await deniedPanel.getByText("Impossibile salvare la preferenza", { exact: false }).waitFor();
  await deniedPanel.locator('input[type="file"]').setInputFiles({ name: "input.wav", mimeType: "audio/wav", buffer: source });
  await deniedPanel.getByRole("button", { name: "Elabora e mostra waveform" }).click();
  const deniedManual = deniedPage.waitForEvent("download");
  await deniedPanel.getByRole("button", { name: "Scarica WAV PCM16 verificato" }).click();
  assert.deepEqual(await readFile(await (await deniedManual).path()), source);
  await denied.close();
  assert.deepEqual(requests, [], "WAV must never be uploaded or sent off-origin");
  assert.deepEqual(errors, []);
  console.log("#339 WAV Chromium PASS: readback bytes, OFF default, manual, one future opt-in download, no retro, denied API, denied removeItem+reload, revoke/reload, denied storage, no uploads, 390px");
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
