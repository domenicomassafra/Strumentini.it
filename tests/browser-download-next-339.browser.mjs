/** #339 browser boundary: real browser download, cancellation and Blob URL lifecycle.
 * Self-contained loopback fixture bundling the actual runtime source; no deploy/server reuse.
 * Run: node tests/browser-download-next-339.browser.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const payload = seed => Buffer.from(Array.from({ length: 8193 }, (_, i) => (i * 37 + seed * 41 + (i >>> 2)) & 255));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const bundle = await build({
  stdin: {
    contents: `import {requestBrowserDownload339} from './src/runtime/browser-download-339.ts';
import {readAutoDownload339, AUTO_DOWNLOAD_KEY_339} from './src/runtime/download-policy-339.ts';
window.download339 = {requestBrowserDownload339, readAutoDownload339, AUTO_DOWNLOAD_KEY_339};`,
    resolveDir: root,
    sourcefile: "browser-download-339-fixture.ts",
    loader: "ts",
  },
  bundle: true, write: false, platform: "browser", format: "iife", target: "es2022",
});
const fixtureScript = bundle.outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><title>#339 real browser fixture</title>
  <button id="manual">Manual download</button><button id="auto">Finish automatic job</button>
  <script src="/fixture.js"></script>`;
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") { res.writeHead(200, { "content-type": "text/javascript" }); res.end(fixtureScript); return; }
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); return; }
  res.writeHead(404); res.end();
});
await new Promise((done, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", done); });
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

async function verifyDownload(download, bytes) {
  assert.equal(download.suggestedFilename(), "verified-339.bin");
  const actual = await readFile(await download.path());
  assert.equal(actual.byteLength, bytes.byteLength);
  assert.equal(digest(actual), digest(bytes), "Downloaded SHA-256 does not match the verified output");
  assert.deepEqual(actual, bytes, "Downloaded binary bytes were corrupted");
}

async function exercise(name, engine) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const errors = [];
    const unexpectedNetwork = [];
    await context.route("**/*", route => {
      const request = route.request();
      if ((request.method() === "GET" || request.method() === "HEAD") && request.url().startsWith(origin + "/")) return route.continue();
      unexpectedNetwork.push(`${request.method()} ${request.url()}`);
      return route.abort();
    });
    const first = await context.newPage();
    first.on("pageerror", error => errors.push(error.message));
    await first.goto(origin);
    await first.clock.install();
    await first.evaluate(() => {
      const { requestBrowserDownload339, readAutoDownload339 } = window.download339;
      const nativeCreate = URL.createObjectURL.bind(URL);
      const nativeRevoke = URL.revokeObjectURL.bind(URL);
      window.createdUrls339 = [];
      window.revokedUrls339 = [];
      window.blobs339 = [];
      URL.createObjectURL = blob => { const url = nativeCreate(blob); window.createdUrls339.push(url); window.blobs339.push(blob); return url; };
      URL.revokeObjectURL = url => { window.revokedUrls339.push(url); nativeRevoke(url); };
      window.open = () => null; // Popup policy denial must not break anchor download.
      window.seed339 = 3;
      window.armed339 = false;
      window.outcomes339 = [];
      window.artifact339 = () => {
        // Nonzero byteOffset catches accidentally downloading backing-buffer padding.
        const backing = new Uint8Array(8193 + 25);
        const seed = window.seed339;
        for (let i = 0; i < 8193; i++) backing[i + 11] = (i * 37 + seed * 41 + (i >>> 2)) & 255;
        const bytes = backing.subarray(11, 11 + 8193);
        return { kind: "file", name: "verified-339.bin", mime: "application/octet-stream",
          bytes, byteLength: bytes.byteLength, download: { ready: true, filename: "verified-339.bin", mime: "application/octet-stream" },
          verification: { state: "verified", verifiedMime: "application/octet-stream", method: "test-byte-verification" } };
      };
      document.querySelector("#manual").addEventListener("click", () => {
        window.outcomes339.push(requestBrowserDownload339(window.artifact339()));
      });
      document.querySelector("#auto").addEventListener("click", () => {
        const consent = readAutoDownload339(localStorage);
        window.outcomes339.push(window.armed339 && consent ? requestBrowserDownload339(window.artifact339()) : false);
        window.armed339 = false;
      });
    });

    // A real cancellation can silently suppress the browser's default action.
    // Returning true here misleads callers, and leaves private bytes under a live Blob URL.
    await first.evaluate(() => {
      window.denyHiddenClick339 = event => {
        if (event.target instanceof HTMLAnchorElement && event.target.hidden) event.preventDefault();
      };
      document.addEventListener("click", window.denyHiddenClick339, true);
    });
    let downloadCount = 0;
    first.on("download", () => downloadCount++);
    await first.locator("#manual").click();
    assert.deepEqual(await first.evaluate(() => window.outcomes339), [false], `${name}: canceled anchor click was reported as accepted`);
    assert.equal(downloadCount, 0, `${name}: canceled click cannot produce a download`);
    assert.deepEqual(await first.evaluate(() => window.revokedUrls339), await first.evaluate(() => window.createdUrls339), `${name}: denied click leaked a Blob URL`);
    await first.evaluate(() => document.removeEventListener("click", window.denyHiddenClick339, true));

    // Some browser integrations suppress anchor.click without throwing or
    // dispatching a click event at all: still refuse and release the URL.
    await first.evaluate(() => {
      window.nativeAnchorClick339 = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.hidden && this.download === "verified-339.bin") return;
        return window.nativeAnchorClick339.call(this);
      };
    });
    await first.locator("#manual").click();
    assert.equal((await first.evaluate(() => window.outcomes339)).at(-1), false, `${name}: suppressed click without event was accepted`);
    assert.equal(downloadCount, 0);
    assert.deepEqual(await first.evaluate(() => window.revokedUrls339), await first.evaluate(() => window.createdUrls339), `${name}: silent denial leaked a URL`);
    await first.evaluate(() => { HTMLAnchorElement.prototype.click = window.nativeAnchorClick339; });

    // Manual download works with opt-in OFF, popup denied, and a sliced Uint8Array.
    assert.equal(await first.evaluate(() => localStorage.getItem(window.download339.AUTO_DOWNLOAD_KEY_339)), null);
    const manualEvent = first.waitForEvent("download");
    await first.locator("#manual").click();
    await verifyDownload(await manualEvent, payload(3));
    assert.equal(downloadCount, 1);
    assert.equal((await first.evaluate(() => window.outcomes339)).at(-1), true);
    // WebKit may not expose a consumed download Blob URL to fetch() after the
    // download starts; inspect the exact captured Blob supplied to that URL.
    const actualBlobHash = await first.evaluate(async () => {
      const bytes = new Uint8Array(await window.blobs339.at(-1).arrayBuffer());
      return [...bytes];
    });
    assert.equal(digest(Buffer.from(actualBlobHash)), digest(payload(3)));

    // A second tab revokes an already-armed automatic operation before finish.
    const second = await context.newPage();
    await second.goto(origin);
    await second.evaluate(() => localStorage.setItem(window.download339.AUTO_DOWNLOAD_KEY_339, "enabled"));
    assert.equal(await first.evaluate(() => window.download339.readAutoDownload339(localStorage)), true);
    await first.evaluate(() => { window.armed339 = window.download339.readAutoDownload339(localStorage); });
    await second.evaluate(() => localStorage.removeItem(window.download339.AUTO_DOWNLOAD_KEY_339));
    await first.waitForFunction(() => !window.download339.readAutoDownload339(localStorage));
    await first.evaluate(() => { window.seed339 = 4; });
    await first.locator("#auto").click();
    assert.equal((await first.evaluate(() => window.outcomes339)).at(-1), false, `${name}: revoked opt-in must fail closed`);
    assert.equal(downloadCount, 1, `${name}: revoked auto cannot download`);

    // New opt-in plus a *new* result may download exactly once; byte hashes differ by job.
    await second.evaluate(() => localStorage.setItem(window.download339.AUTO_DOWNLOAD_KEY_339, "enabled"));
    await first.evaluate(() => { window.armed339 = window.download339.readAutoDownload339(localStorage); window.seed339 = 5; });
    const automaticEvent = first.waitForEvent("download");
    await first.locator("#auto").click();
    await verifyDownload(await automaticEvent, payload(5));
    assert.equal(downloadCount, 2);
    await first.locator("#auto").click();
    assert.equal(downloadCount, 2, `${name}: completed job must not auto-download a second time`);

    // WebKit needs the URL kept alive for the browser to consume it, then timer releases it.
    await first.clock.fastForward(16_000);
    assert.deepEqual(await first.evaluate(() => window.revokedUrls339.sort()), await first.evaluate(() => window.createdUrls339.sort()), `${name}: Blob URLs did not expire`);
    assert.deepEqual(unexpectedNetwork, [], `${name}: unexpected network / file upload`);
    assert.deepEqual(errors, [], `${name}: browser script errors`);
    await context.close();
    console.log(`#339 ${name} PASS: cancellation refusal+revoke, real SHA-256 bytes, cross-tab revoke, no hidden auto, second job, URL lifecycle, zero upload`);
  } finally { await browser.close(); }
}

try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) await exercise(name, engine);
} finally {
  await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
}
