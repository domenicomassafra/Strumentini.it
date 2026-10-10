/** Actual compiled site, Chromium-local PDF target/batch and independent ZIP/PDF verification. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { inspectPdfBytes } from '../src/engines/pdf/index.ts';

const root = resolve(import.meta.dirname, '..');
const port = 18469;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', 'dist'],
  { cwd: root, stdio: 'ignore' });
let browser;
try {
  let started = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { started = (await fetch(`${origin}/tools/pdf-compression-lite/`)).ok; } catch { /* start */ }
    if (started) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(started, 'Compiled PDF compression route missing');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const outside = []; const errors = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' || !request.url().startsWith(origin)) outside.push(request.method() + ' ' + request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/tools/pdf-compression-lite/`, { waitUntil: 'networkidle' });
  await page.locator('select:has(option[value="target-best-effort"])').selectOption('target-best-effort');
  const input = page.locator('form input[type=file]');
  assert((await input.getAttribute('multiple')) !== null, 'Mode must accept multiple PDFs');
  await page.getByLabel(/Dimensione massima PDF in KiB/u).fill('400');
  await page.getByLabel('Unità del limite PDF').selectOption('MiB');
  assert(Number(await page.getByLabel(/Dimensione massima PDF in MiB/u).inputValue()) === 400 / 1024,
    'KiB->MiB conversion must preserve the byte-exact target without rounding');
  await page.getByLabel('Unità del limite PDF').selectOption('KiB');
  assert(Number(await page.getByLabel(/Dimensione massima PDF in KiB/u).inputValue()) === 400,
    'MiB->KiB conversion must roundtrip without precision loss');
  await page.getByLabel('Unità del limite PDF').selectOption('MiB');
  const scan = readFileSync(resolve(root, 'tests/fixtures/pdf-image-mixed-218/safe-mixed-218.pdf'));
  const small = readFileSync(resolve(root, 'quality/fixtures/pdf-gold/simple-3page.pdf'));
  await input.setInputFiles([
    { name: 'scan.pdf', mimeType: 'application/pdf', buffer: scan },
    { name: 'not-a-pdf.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not-an-actual-pdf-fixture') },
    { name: 'vector.pdf', mimeType: 'application/pdf', buffer: small },
  ]);
  await page.locator('form button[type=submit]').first().click();
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 90_000 });
  const summary = await page.locator('[data-result-slot=operation-summary]').innerText();
  assert(/Soglia per PDF\s*409600 byte/u.test(summary), 'Requested exact target not displayed');
  assert(/PDF sotto limite\s*2/u.test(summary), 'Both genuinely-under PDFs not counted');
  assert(/File non elaborabili\s*1/u.test(summary), 'Corrupt file error was not isolated');
  assert(/ZIP include\s*2 file verificati/u.test(summary), 'ZIP should include only passing PDFs');
  const zipDownload = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('link', { name: 'Scarica pdf-entro-limite-verificati.zip', exact: true }).click();
  const zipped = await zipDownload;
  const zipBytes = await readFile(await zipped.path());
  const reopened = unzipSync(new Uint8Array(zipBytes));
  assert(Object.keys(reopened).length === 2, `Expected 2 verified PDFs in ZIP, got ${Object.keys(reopened)}`);
  for (const bytes of Object.values(reopened)) {
    assert(bytes.byteLength <= 400 * 1024, 'ZIP entry did not meet ceiling');
    assert(inspectPdfBytes(bytes).pageCount > 0, 'ZIP PDF unreadable by independent parser');
  }
  assert.deepEqual(errors, [], 'No browser runtime exceptions');
  assert.deepEqual(outside, [], 'No file bytes uploaded or offsite fetch');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), '390px layout overflow');
  console.log(`PDF_TARGET_219_CHROMIUM_PASS source=${scan.byteLength} target=409600 passed=${Object.keys(reopened).length} refused=1 ZIP=${zipBytes.length} no-offsite`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
