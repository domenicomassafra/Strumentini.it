// #069 real public-route acceptance: actual selections, actionable local links and no upload.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { zipSync, strToU8 } from 'fflate';

const root = resolve(import.meta.dirname, '..');
const existingPort = process.env.STR069_EXISTING_DEV_PORT;
const port = existingPort === undefined ? 18469 : Number(existingPort);
const origin = `http://127.0.0.1:${port}`;
const server = existingPort === undefined
  ? spawn('./node_modules/.bin/astro', ['dev', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'ignore' })
  : null;
const outside = [];
let browser;
let checks = 0;

try {
  let ready = false;
  for (let i = 0; i < 220; i++) {
    try { ready = (await fetch(`${origin}/tools/file-size-analyzer/`)).ok; } catch { /* retry startup */ }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(ready, 'Public route is missing');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) outside.push(request.url());
    if (request.method() !== 'GET') outside.push(`${request.method()} ${request.url()}`);
  });
  await page.goto(`${origin}/tools/file-size-analyzer/`, { waitUntil: 'networkidle' });
  const picker = page.locator('input[type=file]');
  assert.equal(await picker.count(), 1);
  assert.equal(await picker.getAttribute('multiple'), null);
  checks += 2;

  async function inspect(file, expected) {
    await picker.setInputFiles(file);
    await page.getByRole('button', { name: 'Esegui in locale' }).click();
    await page.locator('[data-file-size-analysis]').waitFor();
    const report = await page.locator('[data-file-size-analysis]').innerText();
    for (const fact of expected) assert(report.includes(fact), `Missing visible fact ${fact}`);
    checks += expected.length;
    return report;
  }

  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  Buffer.from([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(png, 8);
  png.writeUInt32BE(5000, 16);
  png.writeUInt32BE(4000, 20);
  await inspect({ name: 'big.png', mimeType: 'image/png', buffer: png }, ['20.000.000', 'sovradimensionata', 'Comprimi l’immagine'.replace('’', "'")]);
  const imageLink = page.locator('[data-size-next-actions] a[href="/tools/image-compression/"]');
  assert(await imageLink.isVisible(), 'Real compressor deep link missing');
  checks++;

  await inspect(resolve(root, 'tests/ooxml-media-fixtures/embedded.pptx'), ['Byte compressi media', 'Elementi che occupano più spazio', 'Ottimizza le immagini Office']);
  assert(await page.locator('[data-size-largest-entries] li').count() > 0);
  checks++;
  const archive = zipSync({ 'large.txt': strToU8('a'.repeat(10000)), 'tiny.csv': strToU8('csv') });
  await inspect({ name: 'measure.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) }, ['Totali dichiarati per estensione', 'Elementi che occupano più spazio', '.txt']);
  await inspect(resolve(root, 'quality/fixtures/video-inspection/video-plus-audio.mp4'), ['Traccia 1', 'avc1', 'FPS e bitrate della singola traccia non determinati']);
  await inspect(resolve(root, 'tests/fixtures/pdf-image-mixed-218/safe-mixed-218.pdf'), ['Pagine', 'Stream immagine incorporati', 'compressione PDF leggera']);

  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'Analyzer must fit mobile viewport');
  checks++;

  const next = page.locator('[data-size-next-actions] a[href="/tools/pdf-compression-lite/"]');
  assert(await next.isVisible());
  await next.click();
  await page.waitForURL('**/tools/pdf-compression-lite/');
  assert.equal(new URL(page.url()).pathname, '/tools/pdf-compression-lite/');
  checks += 2;
  assert.equal(outside.length, 0, `Network boundary breached: ${outside.join(', ')}`);
  checks++;
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  checks++;
  console.log(`#069 browser acceptance PASS (${checks} checks): real route, images, OOXML, ZIP, MP4, PDF, working local deep links, zero POST/offsite`);
} finally {
  if (browser) await browser.close();
  server?.kill('SIGTERM');
}
