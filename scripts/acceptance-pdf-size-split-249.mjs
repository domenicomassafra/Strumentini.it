/** Compiled public PDF split actual-byte acceptance, desktop Chromium 390px. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { unzipSync } from 'fflate';
import { inspectPdfBytes } from '../src/engines/pdf/index.ts';

const root = resolve(import.meta.dirname, '..');
const port = 18470;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', 'dist'],
  { cwd: root, stdio: 'ignore' });
let browser;
try {
  let started = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try { started = (await fetch(`${origin}/tools/pdf-split/`)).ok; } catch { /* local boot */ }
    if (started) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(started, 'Compiled PDF Split route unavailable');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const badNetwork = [], pageErrors = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' || !r.url().startsWith(origin)) badNetwork.push(`${r.method()} ${r.url()}`);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${origin}/tools/pdf-split/`, { waitUntil: 'networkidle' });
  await page.getByLabel('Metodo divisione PDF').selectOption('size-limit');
  await page.getByLabel('Dimensione massima di ciascun PDF (KiB)').fill('1');
  assert.equal(await page.locator('[data-pdf-page-selection]').count(), 0, 'Legacy manual selection should not conflict');
  const original = readFileSync(resolve(root, 'quality/fixtures/pdf-gold/simple-3page.pdf'));
  await page.locator('form input[type=file]').first().setInputFiles({ name: 'threepages.pdf', mimeType: 'application/pdf', buffer: original });
  await page.locator('form button[type=submit]').first().click();
  await page.locator('.result-panel[data-state="success"]').waitFor({ timeout: 60_000 });
  const event = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByRole('link', { name: 'Scarica pdf-divisi.zip', exact: true }).click();
  const artifact = await event;
  const bytes = await readFile(await artifact.path());
  const parts = Object.values(unzipSync(new Uint8Array(bytes)));
  assert(parts.length >= 2, `Expected multiple parts under 1024B, got ${parts.length}`);
  let totalPages = 0;
  for (const part of parts) {
    assert(part.length <= 1024, `Part exceeds requested ceiling: ${part.length}`);
    totalPages += inspectPdfBytes(part).pageCount;
  }
  assert.equal(totalPages, 3, 'Every source page retained exactly once');

  const impossible = readFileSync(resolve(root, 'tests/fixtures/pdf-image-mixed-218/safe-mixed-218.pdf'));
  await page.locator('form input[type=file]').first().setInputFiles({ name: 'impossible.pdf', mimeType: 'application/pdf', buffer: impossible });
  await page.locator('form button[type=submit]').first().click();
  await page.locator('.result-panel[data-state="error"]').waitFor({ timeout: 60_000 });
  assert((await page.getByRole('alert').allInnerTexts()).join(' ').includes('1'), 'Single-page impossible threshold should identify page');
  assert.equal(await page.getByRole('link', { name: 'Scarica pdf-divisi.zip', exact: true }).count(), 0, 'Stale ZIP remained downloadable after refusal');
  assert.deepEqual(badNetwork, [], 'No external requests/POST');
  assert.deepEqual(pageErrors, [], 'No uncaught JS errors');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), '390px layout overflow');
  console.log(`PDF_SIZE_SPLIT_249_CHROMIUM_PASS ZIP_PARTS=${parts.length} RECONSTRUCTED_PAGES=${totalPages} LIMIT=1024 BYTE_EXACT no-offsite`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
