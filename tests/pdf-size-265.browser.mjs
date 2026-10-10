// Independent real downloaded public route acceptance of the #265 PDF source adapter.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = process.env.PDF265_DIST ?? resolve(root, 'dist');
const port = 18465;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { cwd: root, stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try { ready = (await fetch(`${origin}/tools/file-size-analyzer/`)).ok; } catch { /* local server boot */ }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(ready, 'compiled file-size-analyzer route missing');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const outside = [];
  const errors = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' || !request.url().startsWith(origin)) outside.push(`${request.method()} ${request.url()}`);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/tools/file-size-analyzer/`, { waitUntil: 'networkidle' });
  const input = page.locator('input[type=file]');
  const realPdf = readFileSync(resolve(root, 'quality/fixtures/pdf-gold/jpeg-1page.pdf'));
  await input.setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: realPdf });
  await page.getByRole('button', { name: 'Esegui in locale' }).click();
  await page.locator('[data-result-class]').waitFor();
  await page.getByText('Dati completi').click();
  const result = await page.locator('[data-result-secondary-raw]').innerText();
  for (const token of ['"kind": "pdf"', 'encodedStreamBytes', 'imageStreamBytes', 'structuralRemainderBytes', 'classification', 'pdf-compression-lite', 'estimatedSavingsBytes']) {
    assert(result.includes(token), `#265 compiled actual PDF report missing ${token}`);
  }
  assert(result.includes('null'), 'Savings must stay unknown until a real transform');
  assert(result.includes('image-only-page-candidate'), 'Real one-page JPEG source must be image-only under strict PDF paint evidence');
  const textPdf = readFileSync(resolve(root, 'quality/fixtures/pdf-gold/simple-3page.pdf'));
  await input.setInputFiles({ name: 'text-vector.pdf', mimeType: 'application/pdf', buffer: textPdf });
  await page.getByRole('button', { name: 'Esegui in locale' }).click();
  await page.locator('[data-result-class]').waitFor();
  await page.getByText('Dati completi').click();
  const textResult = await page.locator('[data-result-secondary-raw]').innerText();
  assert(textResult.includes('"classification": "text-vector-only-candidate"'), 'Real independent vector/text PDF must receive strict nonimage candidate classification');
  assert(textResult.includes('"imageStreamBytes": 0'), 'Text/vector fixture must have exactly zero Image XObject payload bytes');
  assert(textResult.includes('"estimatedSavingsBytes": null'), 'Do not invent savings for text/vector PDFs');
  assert.deepEqual(outside, [], 'Never upload file bytes or fetch offsite');
  assert.deepEqual(errors, [], 'No page JS errors');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), 'No 390px overflow');
  console.log('PDF_SIZE_265_CHROMIUM_PASS checks=15 source=image-PDF-and-text-vector-PDF no offsite');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
