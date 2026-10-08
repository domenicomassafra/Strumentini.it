// STR-266 compiled public-route acceptance; no server-side file upload.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';

const root = resolve(import.meta.dirname, '..');
const port = 18466;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', 'dist'], { cwd: root, stdio: 'ignore' });
let browser;
const outside = [];
let checks = 0;
try {
  let available = false;
  for (let i = 0; i < 90; i++) {
    try { available = (await fetch(origin + '/tools/file-size-analyzer/')).ok; } catch { /* server not started */ }
    if (available) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(available, 'Built route missing');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) outside.push(request.url());
    if (request.method() !== 'GET') outside.push(request.method() + ' ' + request.url());
  });
  await page.goto(origin + '/tools/file-size-analyzer/', { waitUntil: 'networkidle' });
  const choose = page.locator('input[type=file]');
  assert.equal(await choose.count(), 1);
  assert.equal(await choose.getAttribute('multiple'), null);
  checks += 2;
  async function inspect(path, expected) {
    await choose.setInputFiles(resolve(root, path));
    await page.getByRole('button', { name: 'Esegui in locale' }).click();
    await page.locator('[data-result-class]').waitFor();
    await page.getByText('Dati completi').click();
    const result = await page.locator('[data-result-secondary-raw]').innerText();
    for (const fact of expected) assert(result.includes(fact), 'Missing expected displayed measured fact: ' + fact);
    assert(result.includes('null'), 'Unknown savings must stay null');
    checks += expected.length + 1;
    return result;
  }
  const office = await inspect('tests/ooxml-media-fixtures/embedded.docx', ['office', 'media', 'xml', 'font', 'ooxml-media-compression']);
  assert(office.includes('compressedMemberBytes') || office.includes('compressedMember'), 'ZIP byte measures rendered');
  checks++;
  const mp4 = await inspect('quality/fixtures/video-inspection/video-plus-audio.mp4', ['video', 'avc1', 'mp4a']);
  assert(mp4.includes('1.2'), 'MP4 declared movie duration rendered');
  checks++;
  const fragmented = await inspect('quality/fixtures/video-inspection/extension/video-fragmented.mp4', ['video', 'fragmented']);
  assert(fragmented.includes('null'), 'Fragment duration not fabricated');
  checks++;
  await choose.setInputFiles({ name: 'not-office.docx', mimeType: 'application/zip', buffer: Buffer.from([0x50,0x4b,3,4,0,0]) });
  await page.getByRole('button', { name: 'Esegui in locale' }).click();
  await page.locator('[data-result-class]').waitFor({ state: 'detached' });
  checks++;
  assert.deepEqual(outside, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  checks += 2;
  console.log(`STR-266 browser acceptance PASS (${checks} checks), Office/MP4/fragmented measured, no POST/offsite`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
