/** Compiled Astro 390px consumer, real Worker/download and Poppler readback. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

const port = Number(process.env.STR372_PORT ?? 18432);
const url = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
const temp = mkdtempSync(join(tmpdir(), "pdf-workspace372-"));
let browser;
async function ready() {
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error("Static server exited");
    try { if ((await fetch(url + "/tools/pdf-page-reorder/")).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Compiled route not available");
}
async function source(pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= pages; n++) {
    doc.addPage([300 + n, 420]).drawText(`PAGE_NUMBER_${n}`, { x: 30, y: 120, font });
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
function poppler(bytes, filename, expectedCount, firstText, lastText) {
  const path = join(temp, filename);
  writeFileSync(path, bytes);
  const info = execFileSync("pdfinfo", [path], { encoding: "utf8", timeout: 20_000 });
  const text = execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8", timeout: 20_000 });
  assert.match(info, new RegExp(`^Pages:\\s+${expectedCount}$`, "m"));
  assert(text.includes(firstText), "first page text missing");
  assert(text.includes(lastText), "last page text missing");
  assert(text.indexOf(firstText) <= text.indexOf(lastText), "pages not in required order");
}
try {
  await ready();
  // Reuse MiniPC's single permitted automation-browser CDP instance.
  browser = await chromium.connectOverCDP("http://127.0.0.1:17629");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const offsite = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`failed ${request.url()}`));
  page.on("request", (request) => {
    const target = request.url();
    if (!target.startsWith(url) && !target.startsWith("blob:") && !target.startsWith("data:")) offsite.push(target);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/auth/session")) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  const response = await page.goto(url + "/tools/pdf-page-reorder/", { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "390px horizontal overflow");
  const file = page.locator('[data-pdf-workspace-372] input[type="file"]');
  async function resultReady() {
    try {
      await page.locator('[data-pdf-workspace-372] [data-result-class="pdf"] [data-result-slot="file-workspace"]').waitFor({ timeout: 30_000 });
    } catch (error) {
      throw new Error("No independently verified PDF result: " +
        (await page.getByRole("alert").allInnerTexts()).join(" | ") + " / " + errors.join(" | "), { cause: error });
    }
  }

  async function run(pages, expectedCount, firstText, lastText, filename) {
    await file.setInputFiles({ name: filename, mimeType: "application/pdf", buffer: await source(pages) });
    await page.locator('[data-pdf-workspace-372] [data-workspace-page]').first().waitFor({ timeout: 25_000 });
    await page.getByRole("button", { name: "Inverti ordine" }).click();
    await page.getByRole("button", { name: "Crea PDF e verifica" }).click();
    await resultReady();
    const downloadEvent = page.waitForEvent("download", { timeout: 20_000 });
    await page.getByRole("link", { name: /Scarica.*\.pdf/u }).first().click();
    const download = await downloadEvent;
    const bytes = readFileSync(await download.path());
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), expectedCount);
    poppler(bytes, filename.replace(".pdf", "-result.pdf"), expectedCount, firstText, lastText);
    return bytes.byteLength;
  }

  const one = await run(1, 1, "PAGE_NUMBER_1", "PAGE_NUMBER_1", "one.pdf");
  const hundred = await run(100, 100, "PAGE_NUMBER_100", "PAGE_NUMBER_1", "hundred.pdf");

  // Select two visible original identities from the reversed workspace.
  await page.getByRole("button", { name: "Seleziona pagina originale 100" }).click();
  await page.getByRole("button", { name: "Seleziona pagina originale 99" }).click();
  await page.locator('input[name="workspace-mode-372"]').last().check();
  await page.getByRole("button", { name: "Crea PDF e verifica" }).click();
  await resultReady();
  const extractEvent = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("link", { name: /Scarica.*\.pdf/u }).first().click();
  const extracted = readFileSync(await (await extractEvent).path());
  poppler(extracted, "selected.pdf", 2, "PAGE_NUMBER_100", "PAGE_NUMBER_99");

  const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
  const encrypted = await encryptPDF(await source(1), "STR372-proof", { algorithm: "AES-256" });
  await file.setInputFiles({ name: "encrypted.pdf", mimeType: "application/pdf", buffer: Buffer.from(encrypted) });
  await page.getByRole("alert").first().waitFor({ timeout: 25_000 });
  assert.equal(await page.getByRole("button", { name: "Crea PDF e verifica" }).count(), 0);

  await file.setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") });
  await page.getByRole("alert").first().waitFor({ timeout: 25_000 });
  assert.equal(await page.getByRole("button", { name: "Crea PDF e verifica" }).count(), 0);
  await file.setInputFiles({ name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(25 * 1024 * 1024 + 1) });
  assert.match(await page.getByRole("alert").first().innerText(), /troppo grande/i);
  assert.equal(await page.getByRole("button", { name: "Crea PDF e verifica" }).count(), 0);
  assert.deepEqual(offsite, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ test: "STR-372 compiled 390px", result: "PASS", pages: [1, 100],
    independent: "pdf-lib + Poppler pdfinfo/pdftotext", oneBytes: one, hundredBytes: hundred,
    extractedPages: 2, encryptedRefused: true, malformedRefused: true, hugeRefused: true, horizontalOverflow: false,
    offsiteRequests: offsite.length, jsErrors: errors.length, physicalDevice: "NOT_RUN" }));
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill();
  rmSync(temp, { recursive: true, force: true });
}
