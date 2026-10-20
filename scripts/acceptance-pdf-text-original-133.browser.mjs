/** STR-373: compiled browser consumer + independently generated PDF + Poppler. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const port = 18433;
const base = "http://127.0.0.1:" + port;
const temp = mkdtempSync(join(tmpdir(), "pdf-text-133-"));
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
let browser;

function independentFixture() {
  const runs = ["ALFA", "RESTO"].map((s) => "BT /F1 18 Tf 72 696 Td (" + s + ") Tj ET");
  const refs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
    "<< /Length " + Buffer.byteLength(runs[0]) + " >>\nstream\n" + runs[0] + "\nendstream",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 7 0 R >>",
    "<< /Length " + Buffer.byteLength(runs[1]) + " >>\nstream\n" + runs[1] + "\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < refs.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += (i + 1) + " 0 obj\n" + refs[i] + "\nendobj\n";
  }
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += "xref\n0 8\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += String(offset).padStart(10, "0") + " 00000 n \n";
  pdf += "trailer\n<< /Root 1 0 R /Size 8 >>\nstartxref\n" + xref + "\n%%EOF\n";
  return Buffer.from(pdf, "latin1");
}

function independentPdf(file, expected) {
  const path = join(temp, file);
  const text = execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8" });
  assert.deepEqual(text.split("\f").filter((x) => x.trim()).map((x) => x.trim()), expected);
  const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
  assert.match(info, /^Pages:\s+2$/m);
  const fonts = execFileSync("pdffonts", [path], { encoding: "utf8" });
  assert.match(fonts, /Courier/);
  const bbox = execFileSync("pdftotext", ["-bbox-layout", path, "-"], { encoding: "utf8" });
  const words = [...bbox.matchAll(/<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)">([^<]+)<\/word>/g)];
  assert.equal(words.length, 2);
  return words.map((item) => item.slice(1, 5).map(Number));
}

async function compareRenderedPixels(originalBBox) {
  for (const [filename, stem] of [["input.pdf", "before"], ["output.pdf", "after"]]) {
    execFileSync("pdftoppm", ["-r", "72", "-f", "1", "-l", "2", "-png",
      join(temp, filename), join(temp, stem)], { timeout: 30000 });
  }
  let editedPixels = 0;
  for (let page = 1; page <= 2; page++) {
    const left = await sharp(join(temp, "before-" + page + ".png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const right = await sharp(join(temp, "after-" + page + ".png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([left.info.width, left.info.height, left.info.channels],
      [right.info.width, right.info.height, right.info.channels]);
    const [x0, y0, x1, y1] = originalBBox[page - 1];
    for (let y = 0; y < left.info.height; y++) {
      for (let x = 0; x < left.info.width; x++) {
        const pixelIndex = (y * left.info.width + x) * left.info.channels;
        let differs = false;
        for (let c = 0; c < left.info.channels; c++) {
          if (left.data[pixelIndex + c] !== right.data[pixelIndex + c]) differs = true;
        }
        if (!differs) continue;
        if (page !== 1 || x < x0 - 4 || x > x1 + 4 || y < y0 - 4 || y > y1 + 4) {
          throw new Error("Renderer diff outside edited text bounds: page " + page + ", x " + x + ", y " + y);
        }
        editedPixels++;
      }
    }
  }
  assert(editedPixels > 0, "Original and edited word rendered identically");
  return editedPixels;
}

async function serverReady() {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("Server statico non disponibile");
    try { if ((await fetch(base + "/tools/pdf-page-reorder/")).status === 200) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Consumer compilato non pronto");
}

try {
  const input = independentFixture();
  writeFileSync(join(temp, "input.pdf"), input);
  const before = independentPdf("input.pdf", ["ALFA", "RESTO"]);
  await serverReady();
  browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const offsite = [];
  const uploads = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    if (req.method() !== "GET") uploads.push(req.method() + " " + req.url());
    if (![base, "blob:", "data:"].some((prefix) => req.url().startsWith(prefix))) offsite.push(req.url());
  });
  await page.goto(base + "/tools/pdf-page-reorder/", { waitUntil: "networkidle" });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), "Overflow 390px");
  const form = page.locator("[data-pdf-original-text-133]");
  await form.locator('input[type="file"]').setInputFiles({ name: "input.pdf", mimeType: "application/pdf", buffer: input });
  await form.getByLabel("Testo originale esatto").fill("ALFA");
  await form.getByLabel("Testo sostitutivo").fill("BETA");
  await form.getByRole("button", { name: "Modifica e verifica PDF" }).click();
  await form.locator("[data-pdf-original-text-result]").waitFor({ timeout: 30000 });
  const onDownload = page.waitForEvent("download", { timeout: 20000 });
  await form.getByRole("link", { name: "Scarica PDF modificato" }).click();
  const download = await onDownload;
  const output = readFileSync(await download.path());
  writeFileSync(join(temp, "output.pdf"), output);
  const after = independentPdf("output.pdf", ["BETA", "RESTO"]);
  assert.deepEqual(before, after, "Layout changed outside the expected glyph pixels");
  const editedPixels = await compareRenderedPixels(before);
  assert.deepEqual(readFileSync(join(temp, "input.pdf")), input);
  // Hold the real browser File read long enough to exercise an actual user cancellation.
  // This changes only the test page; the product still reads the complete original File.
  await page.evaluate(() => {
    const originalRead = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function (...args) {
      if (this.name === "long.pdf") await new Promise((resolve) => setTimeout(resolve, 1200));
      return originalRead.apply(this, args);
    };
  });
  const slowInput = Buffer.concat([input, Buffer.alloc(20 * 1024 * 1024, 32)]);
  await form.locator('input[type="file"]').setInputFiles({ name: "long.pdf", mimeType: "application/pdf", buffer: slowInput });
  await form.getByRole("button", { name: "Modifica e verifica PDF" }).click();
  await form.getByRole("button", { name: "Annulla" }).click({ timeout: 8000 });
  assert.match(await form.getByRole("alert").innerText(), /annullata/i);
  await page.waitForTimeout(1500);
  assert.equal(await form.getByRole("link", { name: "Scarica PDF modificato" }).count(), 0);
  await form.locator('input[type="file"]').setInputFiles({ name: "invalid.pdf", mimeType: "application/pdf", buffer: Buffer.from("not pdf") });
  await form.getByRole("button", { name: "Modifica e verifica PDF" }).click();
  assert.match(await form.getByRole("alert").innerText(), /PDF|INVALID|MALFORMED/i);
  assert.equal(await form.getByRole("link", { name: "Scarica PDF modificato" }).count(), 0);
  await page.evaluate(() => {
    const file = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "too-large.pdf", { type: "application/pdf" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('[data-pdf-original-text-133] input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("Missing file input");
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await form.getByRole("button", { name: "Modifica e verifica PDF" }).click();
  assert.match(await form.getByRole("alert").innerText(), /25 MiB/);
  assert.equal(await form.getByRole("link", { name: "Scarica PDF modificato" }).count(), 0);
  assert.deepEqual(offsite, []);
  assert.deepEqual(uploads, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ verdict: "PDF133_COMPILED_BROWSER_PASS", inputBytes: input.length,
    outputBytes: output.length, pages: 2, sourceImmutable: true,
    independentOracle: "Poppler pdfinfo/pdftotext -bbox-layout/pdffonts",
    text: ["BETA", "RESTO"], layoutsEqual: true, changedPixelsInOriginalTextBounds: editedPixels, malformedRefused: true, oversizedRefused: true,
    viewport: "390x844", offsiteRequests: offsite.length, uploads: uploads.length, jsErrors: errors.length, mobilePhysical: "NOT_RUN" }));
  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill();
  rmSync(temp, { recursive: true, force: true });
}
