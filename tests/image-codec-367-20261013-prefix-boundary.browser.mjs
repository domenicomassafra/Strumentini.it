/** #367: a 2 MiB header sample must not trust IHDR axes until it sees IDAT.
 * Genuine CRC-valid tEXt followed by partial eXIf can otherwise hide EXIF6.
 * Run: node tests/image-codec-367-20261013-prefix-boundary.browser.mjs
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import sharp from "sharp";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const SAMPLE_BYTES = 2 * 1024 * 1024;
const { outputFiles } = await build({
  stdin: {
    contents: 'import { inspectImageHeader } from "./src/engines/image/format.ts"; window.inspect367 = inspectImageHeader;',
    resolveDir: root, loader: "ts", sourcefile: "prefix-boundary-367.ts",
  },
  write: false, bundle: true, format: "iife", platform: "browser", target: "es2022",
});

function chunks(png) {
  let cursor = 8;
  const parsed = [];
  while (cursor + 12 <= png.length) {
    const size = png.readUInt32BE(cursor);
    assert(cursor + size + 12 <= png.length, "CRC-valid source chunk remains complete");
    parsed.push({ at: cursor, type: png.toString("ascii", cursor + 4, cursor + 8),
      bytes: png.subarray(cursor, cursor + size + 12) });
    cursor += size + 12;
  }
  assert.equal(cursor, png.length);
  return parsed;
}
function pngChunk(type, payload) {
  const result = Buffer.alloc(payload.length + 12);
  result.writeUInt32BE(payload.length, 0);
  result.write(type, 4, "ascii");
  payload.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, result.length - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
function moveNextChunkTo(png, targetType, absoluteOffset) {
  const existing = chunks(png);
  const next = existing.find(chunk => chunk.type === targetType);
  assert(next, `Sharp must emit a real ${targetType} chunk`);
  const bodyLength = absoluteOffset - next.at - 12;
  assert(bodyLength > 5, "Padding chunk requires a tEXt keyword and payload");
  const data = Buffer.alloc(bodyLength, 0x41);
  Buffer.from("note\0").copy(data);
  const comment = pngChunk("tEXt", data);
  const result = Buffer.concat([png.subarray(0, next.at), comment, png.subarray(next.at)]);
  assert.equal(chunks(result).find(chunk => chunk.type === targetType).at, absoluteOffset);
  return result;
}

const raw = Buffer.alloc(6 * 4 * 3, 120);
const plain = await sharp(raw, { raw: { width: 6, height: 4, channels: 3 } }).png().toBuffer();
const exif6 = await sharp(plain).withMetadata({ orientation: 6 }).png().toBuffer();
assert.equal((await sharp(exif6).metadata()).orientation, 6);
const cases = new Map([
  ["plain", plain],
  ["exif6", exif6],
  ["idat-header-at-cap", moveNextChunkTo(exif6, "IDAT", SAMPLE_BYTES - 8)],
]);
for (const remaining of [8, 7, 4, 1, 0]) {
  cases.set(`partial-exif-${remaining}`, moveNextChunkTo(exif6, "eXIf", SAMPLE_BYTES - remaining));
}
const oversizedMetadata = moveNextChunkTo(exif6, "eXIf", SAMPLE_BYTES + 64);
cases.set("truncated-text", oversizedMetadata);

for (const [label, bytes] of cases) {
  const reader = sharp(bytes);
  const metadata = await reader.metadata();
  assert.deepEqual([metadata.width, metadata.height], [6, 4], label);
  assert.equal(metadata.orientation, label === "plain" ? undefined : 6, label);
  if (label !== "plain") {
    const rotated = await sharp(bytes).rotate().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([rotated.info.width, rotated.info.height], [4, 6], label);
  }
}

// Exercise the REAL FilePrivacy analyzeFileSize caller, which reads exactly
// File.slice(0, 2 MiB). It must not claim incorrect image dimensions.
const privacyProbe = [
  'import { readFileSync } from "node:fs";',
  'import { analyzeFileSize } from "./src/engines/file-privacy/index.ts";',
  'const bytes = new Uint8Array(readFileSync(0));',
  'const file = new File([bytes], "orient6.png", { type: "image/png" });',
  'try { const result = await analyzeFileSize({ files: [file] });',
  '  console.log(JSON.stringify({ kind: result.kind, image: result.image })); }',
  'catch (error) { console.log(String(error)); }',
].join("\n");
const privacyOutput = execFileSync(process.execPath,
  ["--import", "tsx", "--input-type=module", "-e", privacyProbe], {
    cwd: root, input: cases.get("partial-exif-4"), encoding: "utf8", timeout: 15_000,
    maxBuffer: 50_000,
  }).trim();

const server = createServer((request, response) => {
  response.setHeader("Content-Security-Policy",
    "default-src 'none'; script-src 'self'; connect-src 'self'; img-src blob:; object-src 'none'");
  if (request.url === "/") {
    response.writeHead(200, { "content-type": "text/html" });
    return response.end('<!doctype html><meta charset="utf-8"><script src="/parser.js"></script>');
  }
  if (request.url === "/parser.js") {
    response.writeHead(200, { "content-type": "text/javascript" });
    return response.end(outputFiles[0].text);
  }
  const label = request.url?.startsWith("/sample/") ? request.url.slice("/sample/".length) : "";
  if (cases.has(label)) {
    response.writeHead(200, { "content-type": "image/png" });
    return response.end(cases.get(label));
  }
  response.writeHead(404).end();
});
await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", done);
});
const origin = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const offsite = [], errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => {
        if (route.request().method() === "GET" && route.request().url().startsWith(origin + "/")) {
          return route.continue();
        }
        offsite.push(route.request().url());
        return route.abort();
      });
      assert.equal((await page.goto(origin))?.status(), 200);
      for (const [label] of cases) {
        const observed = await page.evaluate(async key => {
          const response = await fetch(`/sample/${key}`);
          const full = new File([await response.arrayBuffer()], "from-browser.png", { type: "image/png" });
          const prefix = new Uint8Array(await full.slice(0, 2 * 1024 * 1024).arrayBuffer());
          let header;
          try { header = window.inspect367(prefix); }
          catch (error) { header = String(error); }
          const bitmap = await createImageBitmap(full, { imageOrientation: "from-image" });
          try { return { header, native: [bitmap.width, bitmap.height], prefixLength: prefix.length }; }
          finally { bitmap.close(); }
        }, label);
        const displayed = label === "plain" ? [6, 4] : [4, 6];
        assert.deepEqual(observed.native, displayed, `${name} ${label}: browser-native vs Sharp geometry`);
        if (label === "plain" || label === "exif6" || label === "idat-header-at-cap") {
          assert.deepEqual(observed.header,
            { mime: "image/png", width: displayed[0], height: displayed[1] },
            `${name} ${label}: complete pre-IDAT metadata and IDAT header admits`);
        } else {
          assert.equal(observed.prefixLength, SAMPLE_BYTES);
          assert.match(observed.header, /TRUNCATED_IMAGE/u,
            `${name} ${label}: incomplete PNG pre-IDAT chunk header/data refuses`);
        }
      }
      assert.deepEqual(offsite, [], `${name}: no offsite requests`);
      assert.deepEqual(errors, [], `${name}: no JS page errors`);
      console.log(`#367 ${name} PASS: ${cases.size} CRC-valid PNG cases, File.slice 2 MiB boundary, Sharp/libvips parity`);
      await page.close();
    } catch (error) {
      failures += 1;
      console.error(`#367 ${name} FAIL: ${error.stack}`);
    } finally { await browser.close(); }
  }
} finally {
  await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
}
assert.equal(failures, 0, "PNG eXIf sample-boundary browser differential");
assert.match(privacyOutput, /TRUNCATED_IMAGE/u,
  "analyzeFileSize must refuse a 2 MiB sample ending mid-eXIf header");
