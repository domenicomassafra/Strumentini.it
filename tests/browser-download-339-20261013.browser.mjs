/** Run: node tests/browser-download-339-20261013.browser.mjs
 * Actual runtime/descriptor, native species, real browser download readback.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium, firefox, webkit } from "@playwright/test";

const bundle = await build({
  stdin: {
    contents: `import {requestBrowserDownload339} from './src/runtime/browser-download-339';
import {createOutputArtifactDescriptor} from './src/runtime/output-artifact';
window.fixture339={requestBrowserDownload339,createOutputArtifactDescriptor};`,
    resolveDir: resolve(import.meta.dirname, ".."), loader: "ts",
  },
  bundle: true, write: false, platform: "browser", format: "iife", target: "es2022",
});
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/fixture.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/fixture.js" ? bundle.outputFiles[0].text
    : '<!doctype html><meta charset="utf-8"><button id="download">Download</button><script src="/fixture.js"></script>');
});
await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", done);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const expected = Buffer.from([0, 127, 128, 255, 42]);

try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({ acceptDownloads: true });
      const egress = [], errors = [];
      await context.route("**/*", route => {
        const request = route.request();
        if (request.method() === "GET" && request.url().startsWith(origin + "/")) return route.continue();
        egress.push(request.url());
        return route.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(origin);
      await page.evaluate(() => {
        class PaddedCopy extends Uint8Array {
          constructor(length) {
            super(new ArrayBuffer(length + 32), 16, length);
            new Uint8Array(this.buffer).fill(0xd7);
          }
        }
        class PaddedBytes extends Uint8Array {
          static get [Symbol.species]() { return PaddedCopy; }
        }
        class WideBytes extends Uint8Array {
          static get [Symbol.species]() { return Uint16Array; }
        }
        const payload = [0, 127, 128, 255, 42];
        window.bytes339 = {
          padded: new PaddedBytes(payload), wide: new WideBytes(payload),
          plain: new Uint8Array([215, ...payload, 215]).subarray(1, 6),
        };
        // Demonstrate native slice semantics, without overriding slice/Blob/URL.
        window.nativeSliceSizes339 = [window.bytes339.padded.slice().buffer.byteLength,
          window.bytes339.wide.slice().buffer.byteLength];
        document.querySelector("#download").onclick = () => {
          const { requestBrowserDownload339, createOutputArtifactDescriptor } = window.fixture339;
          const artifact = createOutputArtifactDescriptor({
            kind: "file", name: "verified.bin", mime: "application/octet-stream",
            bytes: window.bytes339[window.case339], fidelity: "lossless", fidelityNote: "Verified exact bytes",
            verification: { state: "verified", verifiedMime: "application/octet-stream", method: "byte-readback" },
          });
          window.requested339 = requestBrowserDownload339(artifact);
        };
      });
      assert.deepEqual(await page.evaluate(() => window.nativeSliceSizes339), [37, 10]);
      for (const scenario of ["padded", "wide", "plain"]) {
        await page.evaluate(value => { window.case339 = value; }, scenario);
        const event = page.waitForEvent("download");
        await page.locator("#download").click();
        const download = await event;
        const actual = await readFile(await download.path());
        assert.equal(download.suggestedFilename(), "verified.bin");
        assert.equal(actual.byteLength, expected.byteLength, `${name}/${scenario}: unverified backing bytes leaked`);
        assert.deepEqual(actual, expected, `${name}/${scenario}: verified byte sequence changed`);
        assert.equal(await page.evaluate(() => window.requested339), true);
      }
      assert.deepEqual(egress, []);
      assert.deepEqual(errors, []);
      console.log(`#339 ${name} ${browser.version()} PASS: native padded/wide species and offset view, actual exact 5-byte downloads, zero egress/errors`);
      await context.close();
    } finally { await browser.close(); }
  }
} finally {
  await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
}
