/** #036 public static audio workspace acceptance. Physical devices are a separate QA gate. */
import { chromium, firefox, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(process.env.AUDIO036_DIST ?? join(root, 'dist'));
const port = Number(process.env.AUDIO036_PORT ?? 18636);
const origin = `http://127.0.0.1:${port}`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dist], { cwd: root, stdio: 'ignore' });
const temp = mkdtempSync(join(tmpdir(), 'strumentini-audio-036-'));
let checks = 0;

/** Real 1-second IEEE float32 mono WAVE with a 0.2s digital silence run. */
function fixture() {
  const frames = 8000;
  const result = Buffer.alloc(44 + frames * 4);
  result.write('RIFF', 0); result.writeUInt32LE(result.length - 8, 4);
  result.write('WAVE', 8); result.write('fmt ', 12); result.writeUInt32LE(16, 16);
  result.writeUInt16LE(3, 20); result.writeUInt16LE(1, 22);
  result.writeUInt32LE(8000, 24); result.writeUInt32LE(32000, 28);
  result.writeUInt16LE(4, 32); result.writeUInt16LE(32, 34);
  result.write('data', 36); result.writeUInt32LE(frames * 4, 40);
  for (let frame = 0; frame < frames; frame++) {
    const sample = frame >= 1600 && frame < 3200 ? 0 : 0.3 * Math.sin(2 * Math.PI * 440 * frame / 8000);
    result.writeFloatLE(sample, 44 + frame * 4);
  }
  return result;
}

const source = join(temp, 'source-float32.wav');
writeFileSync(source, fixture());
const names = (process.env.AUDIO036_BROWSERS ?? 'chromium,firefox,webkit').split(',').map((name) => name.trim());
const kinds = { chromium, firefox, webkit };

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(origin + '/tools/audio-generator/')).status === 200; } catch { /* server starting */ }
    if (ready) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(ready, 'Compiled audio route missing');
  for (const name of names) {
    assert(Object.hasOwn(kinds, name));
    const browser = await kinds[name].launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const outside = [];
    const errors = [];
    try {
      await context.addInitScript(() => {
        const Native = window.Worker;
        const receipt = { created: 0, terminated: 0, held: 0, holdPreview: false };
        window.__audio036 = receipt;
        window.Worker = class extends Native {
          constructor(url, options) { super(url, options); this.audio = String(url).includes('231'); if (this.audio) receipt.created++; }
          postMessage(message, ...rest) {
            if (this.audio && message?.kind === 'preview' && receipt.holdPreview) {
              receipt.holdPreview = false; receipt.held++; return;
            }
            return super.postMessage(message, ...rest);
          }
          terminate() { if (this.audio) receipt.terminated++; return super.terminate(); }
        };
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.route('**/*', (route) => {
        const url = route.request().url();
        if ((url.startsWith(origin + '/') || url.startsWith('blob:') || url.startsWith('data:')) && route.request().method() === 'GET') return route.continue();
        outside.push(`${route.request().method()} ${url}`);
        return route.abort();
      });
      await page.goto(origin + '/tools/audio-generator/', { waitUntil: 'networkidle' });
      const panel = page.locator('[data-audio-timeline-231]');
      await panel.waitFor();
      assert((await panel.innerText()).includes('PCM 8/16/24/32'));
      checks++;
      const input = panel.locator('input[type=file]');
      await input.setInputFiles(source);
      await panel.locator('input[type=checkbox]').nth(2).check(); // Silence removal

      let t = Date.now();
      await panel.getByRole('button', { name: 'Anteprima taglio e silenzi' }).click();
      await panel.locator('[data-audio-036-preview]').waitFor({ timeout: 20000 });
      const previewMs = Date.now() - t;
      const preview = await panel.locator('[data-audio-036-preview]').innerText();
      const removedMatch = /Frame silenzio da rimuovere\s+(\d+)/u.exec(preview);
      const removed = removedMatch === null ? Number.NaN : Number(removedMatch[1]);
      assert(removed >= 1600 && removed < 1610, `Actual silence region not previewed: ${preview}`);
      const expectedBytes = 44 + (8000 - removed) * 2;
      assert(preview.includes(expectedBytes.toLocaleString('it-IT')), 'Exact frame-derived WAV size missing');
      assert.equal(await panel.locator('[data-audio-timeline-result]').count(), 0);
      checks += 3;

      await panel.locator('input[type=number]').nth(4).fill('11');
      assert.equal(await panel.locator('[data-audio-036-preview]').count(), 0, 'Parameter change must invalidate old preview');
      await page.evaluate(() => { window.__audio036.holdPreview = true; });
      await panel.getByRole('button', { name: 'Anteprima taglio e silenzi' }).click();
      await page.waitForFunction(() => window.__audio036.held > 0);
      await panel.getByRole('button', { name: 'Annulla montaggio' }).click();
      assert((await panel.locator('[data-audio-timeline-status]').innerText()).includes('AUDIO_231_CANCELLED'));
      assert.equal(await panel.locator('[data-audio-timeline-result]').count(), 0);
      checks += 4;

      await panel.locator('input[type=number]').nth(4).fill('10');

      t = Date.now();
      await panel.getByRole('button', { name: 'Elabora e mostra waveform' }).click();
      await panel.locator('[data-audio-timeline-result]').waitFor({ timeout: 20000 });
      const renderMs = Date.now() - t;
      const receipt = await panel.locator('[data-audio-036-receipt]').innerText();
      assert(receipt.includes('IEEE float32 WAV'));
      assert(receipt.includes('PCM signed 16-bit LE'));
      assert(receipt.includes('128000 bit/s'));
      assert(receipt.includes('32044') || receipt.includes('32.044'));
      assert(receipt.includes(expectedBytes.toLocaleString('it-IT')));
      assert.equal(await panel.locator('[data-audio-timeline-waveform] rect').count(), 192);
      checks += 6;
      const downloadWait = page.waitForEvent('download');
      await panel.getByRole('link', { name: 'Scarica WAV PCM16 verificato' }).click();
      const download = await downloadWait;
      const content = readFileSync(await download.path());
      assert.equal(content.length, expectedBytes);
      assert.equal(content.readUInt32LE(24), 8000);
      assert.equal(content.readUInt16LE(34), 16);
      const resultPath = join(temp, `${name}-output.wav`);
      writeFileSync(resultPath, content);
      const ffprobe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', resultPath], { encoding: 'utf8' }));
      assert.equal(ffprobe.streams[0].codec_name, 'pcm_s16le');
      assert.equal(ffprobe.streams[0].sample_rate, '8000');
      assert.equal(ffprobe.streams[0].channels, 1);
      assert(Math.abs(Number(ffprobe.format.duration) - (8000 - removed) / 8000) < 1 / 8000);
      checks += 7;
      const lifecycle = await page.evaluate(() => ({ ...window.__audio036 }));
      assert.equal(lifecycle.created, lifecycle.terminated, 'Worker leak after preview/cancel/render');
      assert.equal(lifecycle.held, 1, 'Cancellation did not interrupt actual Worker');
      assert.deepEqual(errors, []);
      assert.deepEqual(outside, []);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Mobile viewport overflow');
      checks += 5;
      const memory = await page.evaluate(() => typeof performance.memory?.usedJSHeapSize === 'number' ? performance.memory.usedJSHeapSize : null);
      console.log(`${name} AUDIO036 PASS checks=26 ${JSON.stringify({ previewMs, renderMs, outputBytes: content.length, sourceBytes: readFileSync(source).length, memoryObservedBrowserBytes: memory, workerLifecycle: lifecycle, offsite: 0 })}`);
      await page.close();
    } finally { await context.close(); await browser.close(); }
  }
  console.log(`AUDIO036_BROWSER_PASS checks=${checks} browsers=${names.join(',')} real_audio=true preview_cancel=true no_upload=true physical_mobile=NOT_RUN`);
} finally {
  if (server.exitCode === null) server.kill('SIGTERM');
  rmSync(temp, { recursive: true, force: true });
}
