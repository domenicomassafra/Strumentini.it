/** STR-418: real compiled browser route/Worker/verified download; not Gold or physical-device certification. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STR418_PORT ?? 18418);
const origin = "http://127.0.0.1:" + port;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root, stdio: "ignore",
});
const scratch = mkdtempSync(join(tmpdir(), "str418-browser-"));
let browser;
async function ready() {
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error("Static server exited.");
    try { if ((await fetch(origin + "/tools/pdf-repair/")).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The built PDF repair route did not become available.");
}
try {
  const sourceDoc = await PDFDocument.create();
  const page = sourceDoc.addPage([540, 280]);
  page.drawText("STR418_BROWSER_PROOF", { x: 20, y: 120, font: await sourceDoc.embedFont(StandardFonts.Helvetica) });
  const source = await sourceDoc.save({ useObjectStreams: false });
  const footer = /startxref\s+\d+\s+%%EOF/.exec(Buffer.from(source).toString("latin1"));
  assert(footer);
  const pointer = Buffer.from("startxref\n99999999\n%%EOF", "ascii");
  const corrupt = Buffer.concat([
    source.subarray(0, footer.index), pointer, source.subarray(footer.index + footer[0].length),
  ]);
  await ready();
  // Reuse the dedicated MiniPC automation-browser instance: no new Chrome
  // process, user profile, or debugger port is created for acceptance.
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const pageUi = await context.newPage();
  const errors = [];
  const offsite = [];
  pageUi.on("pageerror", (err) => errors.push(err.message));
  // The static test server intentionally has no auth API; its 404 is expected.
  pageUi.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/auth/session")) {
      errors.push("HTTP " + response.status() + " " + response.url());
    }
  });
  pageUi.on("requestfailed", (request) => errors.push("REQUESTFAILED " + request.url()));
  pageUi.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) offsite.push(url);
  });
  const response = await pageUi.goto(origin + "/tools/pdf-repair/", { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  assert(await pageUi.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await pageUi.locator('form input[type="file"]').first().setInputFiles({
    name: "damaged.pdf", mimeType: "application/pdf", buffer: corrupt,
  });
  await pageUi.locator('form button[type="submit"]').first().click();
  const state = pageUi.locator('.result-panel[data-state="success"], .result-panel[data-state="error"]');
  await state.waitFor({ timeout: 40_000 });
  assert.equal(await state.getAttribute("data-state"), "success",
    "Browser Worker refused: " + (await pageUi.getByRole("alert").allInnerTexts()).join(" | ") + " " + errors.join(" | "));
  const download = pageUi.waitForEvent("download", { timeout: 15_000 });
  await pageUi.getByRole("link", { name: /Scarica.*\.pdf/u }).first().click();
  const downloaded = await download;
  const outputBytes = readFileSync(await downloaded.path());
  const saved = join(scratch, "repaired.pdf");
  writeFileSync(saved, outputBytes);
  const info = execFileSync("pdfinfo", [saved], { encoding: "utf8", timeout: 10_000 });
  const text = execFileSync("pdftotext", [saved, "-"], { encoding: "utf8", timeout: 10_000 });
  assert.match(info, /^Pages:\s+1$/mu);
  assert.match(text, /STR418_BROWSER_PROOF/u);
  assert.equal((await PDFDocument.load(outputBytes)).getPageCount(), 1);
  assert.deepEqual(offsite, []);
  assert.deepEqual(errors, []);
  await pageUi.locator('form input[type="file"]').first().setInputFiles({
    name: "unrecoverable.pdf", mimeType: "application/pdf", buffer: Buffer.from("NOT-A-PDF"),
  });
  await pageUi.locator('form button[type="submit"]').first().click();
  const alert = pageUi.getByRole("alert").first();
  await alert.waitFor({ timeout: 20_000 });
  assert(await alert.innerText());
  console.log(JSON.stringify({
    test: "STR-418 compiled route", result: "PASS", responsive390: true,
    localWorkerRepair: true, downloadable: true, independentlyReopenedPoppler: true,
    impossibleInputRefused: true, offsiteRequests: 0, jsErrors: 0, physicalMobile: "NOT_RUN",
  }));
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill();
  rmSync(scratch, { recursive: true, force: true });
}
