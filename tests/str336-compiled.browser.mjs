// Compiled consumer check using desktop browser engines with mobile emulation.
// This never claims native iOS Simulator / Android Emulator acceptance.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, webkit, devices } from '@playwright/test';
import sharp from 'sharp';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const origin = process.argv[2];
if (!origin) throw Error('Usage: node tests/str336-compiled.browser.mjs http://127.0.0.1:PORT');
const png = await readFile('quality/fixtures/image-metadata/synthetic-1x1-rgb.png');
const pdf = await readFile('quality/fixtures/pdf-gold/simple-2page.pdf');
const photo = { name: 'photo-local.png', mimeType: 'image/png', buffer: png };
const file = { name: 'documento-local.pdf', mimeType: 'application/pdf', buffer: pdf };

async function chooseNative(page, selector, fixture) {
  const event = page.waitForEvent('filechooser');
  await page.locator(selector).click();
  const chooser = await event;
  assert.equal(chooser.isMultiple(), false);
  await chooser.setFiles(fixture);
}

async function output(page, label) {
  const btn = page.locator('[data-result-action="download"]').first();
  await btn.waitFor({ state: 'visible', timeout: 45000 });
  const event = page.waitForEvent('download', { timeout: 20000 });
  await btn.click();
  const download = await event;
  const bytes = await readFile(await download.path());
  assert(bytes.length > 0, label + ': empty output');
  return { filename: download.suggestedFilename(), bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

for (const [engineName, engine, deviceName] of [
  ['Chromium', chromium, 'Pixel 7'],
  ['WebKit', webkit, 'iPhone 13'],
]) {
  const browser = await engine.launch({ headless: true });
  const ctx = await browser.newContext({ ...devices[deviceName], viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: ({ files }) => Array.isArray(files) && files.length === 1 });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => {
      window.__str336ShareFilename = files?.[0]?.name ?? '';
      throw new DOMException('User dismissed native share', 'AbortError');
    }});
  });
  const page = await ctx.newPage();
  const errors = [], uploads = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (req) => {
    if (!['GET', 'HEAD'].includes(req.method())) uploads.push(req.method() + ' ' + req.url());
  });
  try {
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await chooseNative(page, '[data-home-photos-picker]', photo);
    await page.getByText(/PNG riconosciuto localmente/u).waitFor({ timeout: 30000 });
    const previous = await page.locator('[data-home-file-action-format]:visible a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
    assert(previous.includes('/tools/image-resize/'));

    await page.locator('[data-home-file-picker]').dispatchEvent('error');
    await page.getByText(/Impossibile completare la selezione/u).waitFor();
    assert.deepEqual(await page.locator('[data-home-file-action-format]:visible a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))), previous);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    assert.deepEqual(await page.locator('[data-home-file-action-format]:visible a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))), previous);

    await page.evaluate(() => {
      const orig = File.prototype.slice;
      File.prototype.slice = function (...args) {
        if (this.name === 'negata.png') throw new DOMException('Read denied', 'NotAllowedError');
        return orig.apply(this, args);
      };
    });
    await page.locator('[data-home-photos-picker]').setInputFiles({ ...photo, name: 'negata.png' });
    await page.getByText(/Impossibile leggere il file/u).waitFor({ timeout: 20000 });
    assert.deepEqual(await page.locator('[data-home-file-action-format]:visible a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href'))), previous);
    await chooseNative(page, '[data-home-photos-picker]', photo);
    await page.getByText(/PNG riconosciuto localmente/u).waitFor();

    await page.locator('a[href="/tools/image-resize/"]:visible').first().click();
    await page.waitForURL(/\/tools\/image-resize\//u);
    await page.locator('form input[type="file"]').first().setInputFiles(photo);
    await page.locator('form button[type="submit"]').first().click();
    const photoOutput = await output(page, 'Photos');
    const meta = await sharp(photoOutput.bytes).metadata();
    assert(meta.width > 0 && meta.height > 0 && ['png','jpeg','webp'].includes(meta.format), 'image output independently decodable');
    const share = page.locator('[data-result-action="share"]');
    await share.waitFor({ state: 'visible', timeout: 15000 });
    await share.click();
    await page.getByText(/Condivisione annullata/u).waitFor();
    const sharedFile = await page.evaluate(() => window.__str336ShareFilename);
    assert.equal(sharedFile, photoOutput.filename, 'share action should carry verified output file');
    assert(await page.locator('[data-result-action="download"]').count(), 'download retained after share cancelled');

    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await chooseNative(page, '[data-home-file-picker]', file);
    await page.getByText(/PDF riconosciuto localmente/u).waitFor({ timeout: 30000 });
    await page.locator('a[href="/tools/pdf-compression-lite/"]:visible').first().click();
    await page.waitForURL(/\/tools\/pdf-compression-lite\//u);
    await page.locator('form input[type="file"]').first().setInputFiles(file);
    await page.locator('form button[type="submit"]').first().click();
    const pdfOutput = await output(page, 'Files');
    const parsed = await getDocument({ data: new Uint8Array(pdfOutput.bytes), disableWorker: true }).promise;
    assert.equal(parsed.numPages, 2, 'PDF output independently parseable with expected pages');
    await parsed.destroy();
    assert.deepEqual(errors, [], 'No browser page errors');
    assert.deepEqual(uploads, [], 'No file upload or mutation request');
    console.log(JSON.stringify({ result: 'PASS_DESKTOP_BROWSER_MOBILE_EMULATION', engine: engineName,
      deviceProfile: deviceName, compiledOrigin: origin,
      photo: { filename: photoOutput.filename, sha256: photoOutput.sha256, bytes: photoOutput.bytes.length, width: meta.width, height: meta.height },
      pdf: { filename: pdfOutput.filename, sha256: pdfOutput.sha256, bytes: pdfOutput.bytes.length, pages: 2 },
      permission: 'SIMULATED_READ_DENIAL_PREVIOUS_RESULT_RETAINED', return: 'SCRIPTED_BACKGROUND_RETURN_RETAINED',
      share: 'SCRIPTED_ABORTERROR_OUTPUT_RETAINED', nativeSimulators: 'NOT_RUN' }));
  } finally {
    await ctx.close();
    await browser.close();
  }
}
