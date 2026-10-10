/** #237 DEV-only product seam; browser download is NOT production release approval. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(import.meta.dirname, "..");
const port = 18537;
const origin = `http://127.0.0.1:${port}`;
const source = await readFile(resolve(root, "quality/fixtures/pdf-gold/simple-2page.pdf"));
const forensicDir = await mkdtemp(resolve(tmpdir(), "stru237-dev-independent-"));
const server = spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], { cwd: root, stdio: "ignore" });
let browser;
async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/tools/pdf-true-redaction-237/`)).ok) return; }
    catch { /* server starting */ }
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error("DEV-only PDF redaction route unavailable");
}

try {
  await waitServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors = [];
  const offsite = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) offsite.push(request.url());
  });
  const response = await page.goto(`${origin}/tools/pdf-true-redaction-237/`, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  assert.equal(await page.locator('[data-redaction237-preview="experimental-local-only"]').count(), 1);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  await page.locator('[data-redaction237] input[type=file]').setInputFiles({ name: "source.pdf", mimeType: "application/pdf", buffer: source });
  await page.getByText("2 pagine verificate in anteprima.", { exact: false }).waitFor({ timeout: 40_000 });
  assert.equal(await page.locator('.redaction237-preview img').count(), 2);
  await page.getByLabel('X sinistra (%)').fill('0');
  await page.getByLabel('Y alto (%)').fill('0');
  await page.getByLabel('Larghezza (%)').fill('100');
  await page.getByLabel('Altezza (%)').fill('50');
  await page.getByRole("button", { name: "Aggiungi area nera" }).click();
  assert.equal(await page.locator('.redaction237-box').count(), 1);
  await page.locator('[data-redaction237-run]').click();
  await page.locator('[data-redaction237-proof]').waitFor({ timeout: 50_000 });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Scarica PDF raster con aree rimosse" }).click();
  const actual = await readFile(await (await downloadEvent).path());
  assert.equal(actual.subarray(0, 5).toString(), "%PDF-");
  // The standard `%PDF-` header is expected in BOTH files; the source's
  // original selectable words must not survive the newly built image-only PDF.
  for (const sourceWord of ["alpha", "beta"]) {
    assert.equal(source.includes(sourceWord), true, `fixture lacks ${sourceWord}`);
    assert.equal(actual.includes(sourceWord), false, `source word ${sourceWord} survived export`);
  }
  const loading = getDocument({ data: new Uint8Array(actual), disableFontFace: true, useSystemFonts: true });
  try {
    const doc = await loading.promise;
    assert.equal(doc.numPages, 2);
    for (let i = 1; i <= doc.numPages; i++) {
      const pdfPage = await doc.getPage(i);
      const text = await pdfPage.getTextContent();
      assert.equal(text.items.length, 0, "redacted output must not retain source text objects");
      pdfPage.cleanup();
    }
  } finally { await loading.destroy(); }
  // Two truly independent consumers now interrogate the REAL file downloaded
  // from the application's UI, not a fabricated serialization or unit mock.
  const inputPath = resolve(forensicDir, 'simple-2page.pdf');
  const exportPath = resolve(forensicDir, 'exported-redacted.pdf');
  const planPath = resolve(forensicDir, 'plan.json');
  await writeFile(inputPath, source);
  await writeFile(exportPath, actual);
  const generatePlan = String.raw`
import json,sys
from pypdf import PdfReader
pdf = PdfReader(sys.argv[1],strict=True)
pages=[]
for n,p in enumerate(pdf.pages,1):
 im=p['/Resources']['/XObject']['/Im0'].get_object()
 pages.append({'page':n,'pixelWidth':int(im['/Width']),'pixelHeight':int(im['/Height']),
    'regions':[{'page':1,'left':0,'top':0,'width':1,'height':0.5}] if n==1 else []})
print(json.dumps({'pageCount':len(pages),'pages':pages}))`;
  const plan = execFileSync('python3', ['-c', generatePlan, exportPath], { encoding: 'utf8', timeout: 15000 });
  await writeFile(planPath, plan);
  const independent = JSON.parse(execFileSync('python3', [resolve(root, 'tests/fixtures/pdf-redaction-forensics-237.py'), inputPath, exportPath, planPath], { encoding: 'utf8', timeout: 20000 }));
  assert.equal(independent.pypdf, 'PASS');
  assert.equal(independent.pdfminer, 'PASS');
  assert.ok(independent.blackPixels > 0 && independent.outsideColoredPixels > 0);
  const macPdfKit = execFileSync('swift', [resolve(root, 'tests/fixtures/pdf-redaction-macos-pdfkit-237.swift'), exportPath], { encoding: 'utf8', timeout: 120000 });
  assert.match(macPdfKit, /PASS #237 PDFKit\/CoreGraphics independent reopen\/copy\/print/);
  await page.getByRole("button", { name: "Rimuovi area 1" }).click();
  assert.equal(await page.locator('[data-redaction237-proof]').count(), 0, "changing region must revoke verified download");
  // A real recoverability challenge: the source has PRIVATE text hidden by
  // an opaque rectangle plus a genuinely orphaned recoverable object.
  const secretPath = resolve(root, 'tests/fixtures/pdf-redaction-malicious-237/covered-orphan-237.pdf');
  const secretSource = await readFile(secretPath);
  const secretMarker = 'PRIVATE_237_SOURCE_ONLY_NEVER_OUTPUT_4D792A';
  assert.ok(secretSource.includes(secretMarker));
  await page.locator('[data-redaction237] input[type=file]').setInputFiles({ name: 'covered-orphan-237.pdf', mimeType: 'application/pdf', buffer: secretSource });
  await page.getByText('1 pagine verificate in anteprima.', { exact: false }).waitFor({ timeout: 40_000 });
  await page.getByRole('button', { name: 'Aggiungi area nera' }).click();
  await page.locator('[data-redaction237-run]').click();
  await page.locator('[data-redaction237-proof]').waitFor({ timeout: 50_000 });
  const secretDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Scarica PDF raster con aree rimosse' }).click();
  const secretExport = await readFile(await (await secretDownload).path());
  assert.equal(secretExport.includes(secretMarker), false);
  assert.equal(secretExport.includes('ORPHAN_237_RECOVERABLE_PRIVATE_7F9D13'), false);
  const secretExportPath = resolve(forensicDir, 'exported-covered-orphan-237.pdf');
  const secretPlanPath = resolve(forensicDir, 'malicious-plan.json');
  await writeFile(secretExportPath, secretExport);
  await writeFile(secretPlanPath, execFileSync('python3', ['-c', generatePlan, secretExportPath], { encoding: 'utf8', timeout: 15000 }));
  const hostileForensic = JSON.parse(execFileSync('python3', [resolve(root, 'tests/fixtures/pdf-redaction-forensics-237.py'), secretPath, secretExportPath, secretPlanPath], { encoding: 'utf8', timeout: 20000 }));
  assert.equal(hostileForensic.pypdf, 'PASS');
  assert.equal(hostileForensic.pdfminer, 'PASS');
  assert.ok(hostileForensic.blackPixels > 0 && hostileForensic.outsideColoredPixels > 0);
  const hostileMacPdfKit = execFileSync('swift', [resolve(root, 'tests/fixtures/pdf-redaction-macos-pdfkit-237.swift'), secretExportPath], { encoding: 'utf8', timeout: 120000 });
  assert.match(hostileMacPdfKit, /PASS #237 PDFKit\/CoreGraphics independent reopen\/copy\/print/);
  await page.getByRole('button', { name: 'Rimuovi area 1' }).click();
  await page.locator('[data-redaction237] input[type=file]').setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") });
  await page.getByText("Anteprima rifiutata:", { exact: false }).waitFor();
  assert.equal(await page.locator('[data-redaction237-proof]').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
  assert.deepEqual(offsite, []);
  assert.deepEqual(errors, []);
  console.log("#237 DEV-only product forensic PASS: 2 actual downloaded PDFs including covered hidden text + orphan source, independently reopened/inspected by PDF.js, pypdf, pdfminer and macOS PDFKit/CoreGraphics print/copy; malformed refusal/no network/390px");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  if (process.env.STRUMENTINI_KEEP_FORENSICS === "1") console.log(`#237 forensic artifacts retained for independent diagnosis: ${forensicDir}`);
  else await rm(forensicDir, { recursive: true, force: true });
}
