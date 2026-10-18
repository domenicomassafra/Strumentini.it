/** STR-355: acceptance against built /strumenti/ DOM and its inline client. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const dist = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    const file = resolve(dist, '.' + decodeURIComponent(pathname), pathname.endsWith('/') ? 'index.html' : '');
    const rel = relative(dist, file);
    if (rel === '..' || rel.startsWith('..' + sep) || file === dist) return res.writeHead(403).end();
    const contents = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(contents);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const context = await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (!['GET', 'HEAD'].includes(route.request().method())) {
      writes.push(route.request().method() + ' ' + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const counter = page.locator('[data-directory-count]');
  const query = page.locator('[data-directory-query]');
  const pdf = page.locator('input[data-facet="group"][value="pdf"]');
  const initial = await page.goto(origin + '/strumenti/', { waitUntil: 'domcontentloaded' });
  assert.equal(initial?.status(), 200);
  const toolCards = await page.locator('[data-directory-grid] .tool-card').count();
  assert(toolCards >= 270, 'catalog has to expose all available manifest cards');

  // Accessible name should match with accent-insensitive search, as in /cerca/.
  await query.fill('eta');
  await page.waitForTimeout(260);
  assert(await page.locator('[data-directory-grid] .tool-card:not([hidden]) .tool-card-name').allTextContents()
    .then(names => names.some(name => name.includes('Calcola età'))), 'eta must find Calcola età (accent-insensitive)');
  assert.equal(new URL(page.url()).searchParams.get('q'), 'eta', 'query must survive URL roundtrip');
  await query.fill('');
  await page.waitForTimeout(260);
  assert.equal(new URL(page.url()).searchParams.get('q'), null, 'empty query must clear just q');

  await pdf.check();
  assert.equal(new URL(page.url()).searchParams.get('gruppo'), 'pdf');
  const pdfCount = Number(await counter.textContent());
  assert(pdfCount > 0 && pdfCount < toolCards, 'group facet must constrain catalog');
  await query.fill('pdf');
  await page.waitForTimeout(260);
  assert.equal(new URL(page.url()).searchParams.get('gruppo'), 'pdf', 'typing must preserve group');
  assert.equal(new URL(page.url()).searchParams.get('q'), 'pdf');
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 });
  await page.waitForTimeout(80);
  assert.equal(new URL(page.url()).searchParams.get('q'), null, 'Back should restore previous query');
  assert.equal(new URL(page.url()).searchParams.get('gruppo'), 'pdf', 'Back should preserve previous group');
  assert.equal(await pdf.isChecked(), true, 'popstate must rehydrate facet control');
  assert.equal(Number(await counter.textContent()), pdfCount, 'popstate must re-render results');
  await page.goForward({ waitUntil: 'domcontentloaded', timeout: 5000 });
  assert.equal(new URL(page.url()).searchParams.get('q'), 'pdf', 'Forward should restore query');
  assert.equal(await pdf.isChecked(), true);
  assert.equal(await query.inputValue(), 'pdf');

  // A user can select a filter before the 120ms search debounce settles.
  // The live query must survive the synchronous re-render that follows.
  for (const action of ['facet', 'sort', 'tab']) {
    await page.goto(origin + '/strumenti/', { waitUntil: 'domcontentloaded' });
    await query.fill('eta');
    if (action === 'facet') await pdf.check();
    else if (action === 'sort') await page.locator('[data-directory-sort]').selectOption('za');
    else await page.locator('[data-tab="verificati"]').click();
    await page.waitForTimeout(220);
    const state = new URL(page.url()).searchParams;
    assert.equal(state.get('q'), 'eta', `instant ${action} must preserve pending query in URL`);
    assert.equal(await query.inputValue(), 'eta', `instant ${action} must preserve visible query`);
    if (action === 'facet') assert.equal(state.get('gruppo'), 'pdf');
    if (action === 'sort') assert.equal(state.get('ordine'), 'za');
    if (action === 'tab') assert.equal(state.get('qualita'), 'verificato');
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 });
    await page.goForward({ waitUntil: 'domcontentloaded', timeout: 5000 });
    assert.equal(new URL(page.url()).searchParams.get('q'), 'eta',
      `Back/Forward must restore instant ${action} query`);
  }

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    const dims = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert(dims.scroll <= dims.viewport + 1, `${width}px horizontal overflow: ${JSON.stringify(dims)}`);
    const toggle = page.locator('[data-filters-toggle]');
    if (width < 900 && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await query.focus();
    assert.equal(await query.evaluate(node => document.activeElement === node), true, `${width}px search keyboard focus`);
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 850 } });
  try {
    const staticPage = await noJs.newPage();
    const response = await staticPage.goto(origin + '/strumenti/', { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    assert.equal(await staticPage.locator('[data-directory-grid] .tool-card').count(), toolCards, 'no-JS catalog cards must all remain in server HTML');
    assert.equal(await staticPage.locator('[data-directory-grid] .tool-card[hidden]').count(), 0, 'no-JS cards should not be hidden');
  } finally { await noJs.close(); }
  assert.deepEqual(writes, [], 'no state-changing network requests');
  assert.deepEqual(errors, [], 'no client runtime exceptions');
  console.log(`STR-355 browser acceptance PASS: ${toolCards} cards, 320/390/1440, accents, filter/query/history, no JS`);
} finally { await browser.close(); server.close(); }
