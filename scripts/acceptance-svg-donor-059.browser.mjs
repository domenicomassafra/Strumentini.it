/**
 * Actual compiled XML utility accepts independently verified donor SVGO mode.
 * STRUMENTINI_SVG_DIST=... optionally uses a clean detached checkout build.
 * No production deploy and no physical-device certification.
 */
import { chromium, firefox, webkit } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const dist = process.env.STRUMENTINI_SVG_DIST ?? resolve(root, 'dist');
const port = 18566;
const base = `http://127.0.0.1:${port}`;
const source = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24"><!-- removable note --><rect width="48" height="24" fill="#1144ee"/></svg>';
const binary = new TextEncoder().encode(source);
const browsers = { chromium, firefox, webkit };
let server;
try {
  assert((await stat(resolve(dist, 'tools/xml-formatter-validator/index.html'))).size > 0, 'XML public route not built');
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/tools/xml-formatter-validator/`)).ok) break; } catch { /* boot */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const [name, launcher] of Object.entries(browsers)) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      const offsite = [], errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(base + '/') || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
        offsite.push(url);
        return route.abort();
      });
      await page.goto(`${base}/tools/xml-formatter-validator/`, { waitUntil: 'networkidle' });
      await page.locator('form textarea').fill(source);
      await page.locator('form select').first().selectOption('svg-minify');
      await page.locator('form button[type=submit]').click();
      const downloadAction = page.locator('[data-result-action=download]');
      await downloadAction.waitFor({ timeout: 25000 });
      const pending = page.waitForEvent('download');
      await downloadAction.click();
      const download = await pending;
      assert(download.suggestedFilename().endsWith('.svg'), `Must download SVG, not XML/JSON: ${download.suggestedFilename()}`);
      const output = await readFile(await download.path());
      assert(output.length < binary.length && !output.toString('utf8').includes('removable note'), 'SVG optimization did not reduce actual bytes');
      const expected = await sharp(binary).ensureAlpha().raw().toBuffer();
      const observed = await sharp(output).ensureAlpha().raw().toBuffer();
      assert.deepEqual(observed, expected, 'Actual donor-optimized vector changed independently decoded pixels');
      await page.locator('form textarea').fill('<svg><script>alert(1)</script></svg>');
      await page.locator('form button[type=submit]').click();
      await page.getByRole('alert').first().waitFor({ timeout: 25000 });
      assert.equal(await page.locator('[data-result-action=download]').count(), 0, 'Unsafe SVG left a stale downloadable artifact');
      assert.deepEqual(offsite, [], 'Browser made an unauthorized offsite request');
      assert.deepEqual(errors, [], 'Browser unhandled exception');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), '390px horizontal overflow');
      console.log(`SVG_059_${name.toUpperCase()}_PASS bytes=${binary.length}->${output.length} pixel_equal=true unsafe_rejected=true local_only=true`);
    } finally { await browser.close(); }
  }
} finally { server?.kill('SIGTERM'); }
