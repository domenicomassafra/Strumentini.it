/** #394: test real decoded JPEG export bytes with unused Huffman symbols.
 * Run: node tests/metadata-394-20261014-unused-dht.browser.mjs
 * Three browser decoders, separate Sharp pixel oracle, no external requests.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const { outputFiles } = await build({
  stdin: {
    contents: 'import { scanImageMetadata, scanImageMetadataBlob } from "./src/engines/image/metadata.ts"; import { stripImageMetadataLocal } from "./src/engines/image/strip-metadata.ts"; window.metadata394 = { scanImageMetadata, scanImageMetadataBlob, stripImageMetadataLocal };',
    loader: "ts", resolveDir: root,
  },
  bundle: true, platform: "browser", format: "iife", target: "es2022", write: false,
});
const server = createServer((request, response) => {
  response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; img-src blob:; connect-src 'none'; object-src 'none'; base-uri 'none'");
  if (request.url === "/") return response.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><script src="/fixture.js"></script>');
  if (request.url === "/fixture.js") return response.writeHead(200, { "content-type": "text/javascript" }).end(outputFiles[0].text);
  response.writeHead(404).end();
});
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const origin = `http://127.0.0.1:${server.address().port}`;

const raw = Buffer.alloc(16 * 16 * 3);
for (let i = 0; i < raw.length; i++) raw[i] = (i * 43 + (i % 13) * 7) & 255;
const exportBytes = await sharp(raw, { raw: { width: 16, height: 16, channels: 3 } }).jpeg({ quality: 82 }).toBuffer();
const progressive = await sharp(raw, { raw: { width: 16, height: 16, channels: 3 } }).jpeg({ quality: 82, progressive: true }).toBuffer();
const symbolValues = [...Buffer.from("EXIF")];
for (let run = 0; run < 16 && symbolValues.length < 36; run++) {
  for (let size = 1; size <= 10 && symbolValues.length < 36; size++) {
    const symbol = (run << 4) | size;
    if (!symbolValues.includes(symbol)) symbolValues.push(symbol);
  }
}
const privateSymbolBytes = Buffer.from(symbolValues); // 36 distinct legal JPEG AC symbols; starts 'EXIF'
const counts = Buffer.alloc(16);
counts[7] = privateSymbolBytes.length;
const payload = Buffer.concat([Buffer.from([0x13]), counts, privateSymbolBytes]); // unused AC table 3
const table = Buffer.alloc(4 + payload.length);
table.set([255, 196]);
table.writeUInt16BE(2 + payload.length, 2);
payload.copy(table, 4);
const modified = Buffer.concat([exportBytes.subarray(0, 2), table, exportBytes.subarray(2)]);
assert.equal(modified.includes(privateSymbolBytes), true);
assert.deepEqual(await sharp(modified).raw().toBuffer(), await sharp(exportBytes).raw().toBuffer());
assert.equal((await sharp(progressive).raw().toBuffer()).length, 16 * 16 * 3);

try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const network = [], errors = [];
      page.on("pageerror", err => errors.push(err.message));
      await page.route("**/*", route => {
        if (route.request().method() === "GET" && route.request().url().startsWith(origin + "/")) return route.continue();
        network.push(`${route.request().method()} ${route.request().url()}`);
        return route.abort();
      });
      await page.goto(origin);
      const inspected = await page.evaluate(async ({ exported, forged, progressive }) => {
        const asBytes = value => Uint8Array.from(value);
        const bitmapPixels = async bytes => {
          let bitmap;
          try {
            bitmap = await createImageBitmap(new Blob([asBytes(bytes)], { type: "image/jpeg" }), { imageOrientation: "from-image" });
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(bitmap, 0, 0);
            return { width: bitmap.width, height: bitmap.height, pixels: [...context.getImageData(0, 0, bitmap.width, bitmap.height).data] };
          } catch (error) {
            return { error: String(error) };
          } finally { bitmap?.close(); }
        };
        const clean = asBytes(exported);
        const attacked = asBytes(forged);
        let stripped = null;
        let stripError = null;
        try {
          const result = await window.metadata394.stripImageMetadataLocal({
            file: new File([attacked], "secret-in-unused-huffman-table.jpg", { type: "image/jpeg" }),
          });
          stripped = {
            bytes: [...new Uint8Array(await result.blob.arrayBuffer())],
            metadataFree: result.metadataFree, inventory: result.outputInventory,
            sourcePrivacyCount: result.inputInventory.privacySegmentCount,
          };
        } catch (error) { stripError = String(error); }
        return {
          cleanInventory: window.metadata394.scanImageMetadata(clean),
          forgedInventory: window.metadata394.scanImageMetadata(attacked),
          blobInventory: await window.metadata394.scanImageMetadataBlob(new Blob([attacked], { type: "image/jpeg" })),
          progressiveInventory: window.metadata394.scanImageMetadata(asBytes(progressive)),
          original: await bitmapPixels(clean),
          modified: await bitmapPixels(attacked),
          stripped, stripError,
        };
      }, { exported: [...exportBytes], forged: [...modified], progressive: [...progressive] });
      assert.deepEqual([inspected.original.width, inspected.original.height], [16, 16]);
      assert.deepEqual(inspected.original, inspected.modified, `${name}: genuine JPEG with extra unused AC table decodes identically`);
      assert.deepEqual(inspected.cleanInventory.segments, [], `${name}: used JPEG DHTs remain neutral`);
      assert.equal(inspected.cleanInventory.complete, true);
      assert.equal(inspected.progressiveInventory.complete, true);
      assert.deepEqual(inspected.progressiveInventory.segments, [], `${name}: valid progressive JPEG remains neutral`);
      assert.equal(inspected.forgedInventory.complete, true);
      assert.equal(inspected.forgedInventory.privacySegmentCount, 1);
      assert.equal(inspected.forgedInventory.privacyBytes, table.length);
      assert.deepEqual(inspected.forgedInventory.segments, [
        { carrier: "ancillary", segment: "JPEG DHT unused", labelIt: inspected.forgedInventory.segments[0].labelIt, bytes: table.length },
      ]);
      assert.deepEqual(inspected.blobInventory, inspected.forgedInventory);
      assert.equal(inspected.stripError, null, `${name}: supported JPEG must strip cleanly`);
      assert.equal(inspected.stripped.metadataFree, true);
      assert.equal(inspected.stripped.sourcePrivacyCount, 1);
      assert.deepEqual(inspected.stripped.inventory.segments, []);
      assert.equal(inspected.stripped.inventory.complete, true);
      const output = Buffer.from(inspected.stripped.bytes);
      assert.deepEqual([...output.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(output.includes(privateSymbolBytes), false, `${name}: private Huffman symbol data must not be exported`);
      const rgba = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([rgba.info.width, rgba.info.height], [16, 16]);
      assert.deepEqual([...rgba.data], inspected.modified.pixels,
        `${name}: independently Sharp reopened stripped PNG equals browser decoded source RGBA`);
      assert.deepEqual(network, [], `${name}: no offsite/upload requests`);
      assert.deepEqual(errors, [], `${name}: no page JS exceptions`);
      console.log(`PASS #394 ${name}: decoder pixel parity and private JPEG DHT accounted for byte-exactly`);
    } finally { await browser.close(); }
  }
} finally { await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok())); }
