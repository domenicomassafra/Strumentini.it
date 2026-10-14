/**
 * #394 wave21: real Chromium output bytes. Different from the existing PNG
 * container inventory test: hide a private EXIF/IPTC/XMP payload *inside an
 * allowed IDAT chunk, after the terminal zlib Adler32*. Both Chromium and
 * Sharp decode the correct pixels, and the chunk CRC remains valid. Independent
 * node:zlib consumed-input accounting is the oracle for this unverified tail.
 * Run: node tests/image-strip-forensic-394-wave21.browser.mjs
 */
import assert from "node:assert/strict";
import sharp from "sharp";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const privatePayload = "PRIVATE_EXIF_IPTC_XMP_GPS_NESTED_THUMBNAIL_394_WAVE21";
const privateBytes = Buffer.from(privatePayload);
const image = Buffer.from([
  205, 10, 45, 255, 100, 200, 250, 255, 45, 180, 210, 255,
  17, 99, 155, 255, 200, 100, 14, 255, 52, 67, 80, 255,
]);

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const bytes = Buffer.alloc(12 + data.length);
  bytes.writeUInt32BE(data.length);
  bytes.write(type, 4, 4, "ascii");
  Buffer.from(data).copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, bytes.length - 4)), bytes.length - 4);
  return bytes;
}
function chunks(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(bytes.subarray(0, 8), signature);
  const result = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + length + 12;
    assert.ok(end <= bytes.length);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    assert.equal(bytes.readUInt32BE(end - 4), crc32(bytes.subarray(offset + 4, end - 4)), `CRC ${type}`);
    result.push({ type, data: bytes.subarray(offset + 8, end - 4) });
    offset = end;
    if (type === "IEND") {
      assert.equal(offset, bytes.length);
      return result;
    }
  }
  throw new Error("No IEND");
}
function poisonIdat(clean) {
  const original = chunks(clean);
  assert.deepEqual(original.map((item) => item.type).filter((type) => type === "IDAT"), ["IDAT"]);
  const payload = Buffer.concat([original.find((item) => item.type === "IDAT").data, privateBytes]);
  return Buffer.concat([
    clean.subarray(0, 8),
    ...original.map((item) => chunk(item.type, item.type === "IDAT" ? payload : item.data)),
  ]);
}
function jpegSegment(marker, payload) {
  const segment = Buffer.alloc(payload.length + 4);
  segment.writeUInt16BE(0xff00 | marker, 0);
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return segment;
}

// Sharp supplies an independently encoded and decoded real JPEG with Exif +
// XMP; we add source APP13 IPTC / COM and synthetic nested-thumbnail bytes.
const initial = await sharp(image, { raw: { width: 3, height: 2, channels: 4 } })
  .withExif({ IFD0: { Copyright: "PRIVATE_EXIF_IPTC_XMP_GPS_NESTED_THUMBNAIL_394_WAVE21" } })
  .withXmp(`<x:xmpmeta xmlns:x="adobe:ns:meta/">${privatePayload}</x:xmpmeta>`)
  .jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer();
const jpeg = Buffer.concat([
  initial.subarray(0, 2),
  jpegSegment(0xed, Buffer.from(`Photoshop 3.0\0IPTC\0${privatePayload}`)),
  jpegSegment(0xfe, Buffer.from(`COM\0${privatePayload}`)),
  initial.subarray(2),
]);
const originalDecode = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
assert.equal(originalDecode.info.width, 3);
assert.equal(originalDecode.info.height, 2);
assert.ok(jpeg.includes(privateBytes));

const bundle = await build({
  entryPoints: [new URL("../src/engines/image/strip-metadata.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "browser", format: "iife", globalName: "Metadata394Wave21",
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("about:blank");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const baseline = await page.evaluate(async (source) => {
    const file = new File([new Uint8Array(source)], "photo-with-exif-iptc-xmp.jpg", { type: "image/jpeg" });
    const before = await createImageBitmap(file, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = before.width;
    canvas.height = before.height;
    canvas.getContext("2d").drawImage(before, 0, 0);
    const originalRgba = [...canvas.getContext("2d").getImageData(0, 0, before.width, before.height).data];
    before.close();
    const clean = await window.Metadata394Wave21.stripImageMetadataLocal({ file });
    const result = new Uint8Array(await clean.blob.arrayBuffer());
    const reopened = await createImageBitmap(clean.blob);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    canvas.getContext("2d").drawImage(reopened, 0, 0);
    const outputRgba = [...canvas.getContext("2d").getImageData(0, 0, reopened.width, reopened.height).data];
    reopened.close();
    return {
      bytes: [...result], originalRgba, outputRgba, inventory: clean.outputInventory,
      before: clean.inputInventory, metadataFree: clean.metadataFree,
      filename: clean.filename,
    };
  }, [...jpeg]);
  assert.equal(baseline.metadataFree, true);
  assert.equal(baseline.before.format, "jpeg");
  assert.ok(baseline.before.privacySegmentCount >= 3, "Source must contain Exif, IPTC, XMP or COM");
  assert.deepEqual(baseline.originalRgba, baseline.outputRgba, "No pixel drift on actual exported PNG");
  assert.deepEqual(baseline.inventory.segments, []);
  assert.equal(Buffer.from(baseline.bytes).includes(privateBytes), false, "Real clean output excludes EXIF/IPTC/XMP");
  const baselineChunks = chunks(Buffer.from(baseline.bytes)).map((item) => item.type);
  assert.equal(baselineChunks[0], "IHDR");
  assert.equal(baselineChunks.at(-1), "IEND");
  assert.ok(baselineChunks.filter((type) => type === "IDAT").length >= 1);
  assert.ok(baselineChunks.every((type) => ["IHDR", "IDAT", "IEND"].includes(type)));

  // A legitimate encoder may split the final Adler32 across multiple IDAT
  // chunks. Accept the same *exact* compressed stream and pixel data even
  // when the final chunk consists of only two checksum bytes.
  const cleanParts = chunks(Buffer.from(baseline.bytes));
  const lastIdatIndex = cleanParts.findLastIndex((item) => item.type === "IDAT");
  assert.ok(lastIdatIndex >= 0);
  const finalIdat = cleanParts[lastIdatIndex].data;
  assert.ok(finalIdat.length > 4);
  const split = Buffer.concat([
    Buffer.from(baseline.bytes).subarray(0, 8),
    ...cleanParts.flatMap((item, index) => index === lastIdatIndex
      ? [chunk("IDAT", item.data.subarray(0, -2)), chunk("IDAT", item.data.subarray(-2))]
      : [chunk(item.type, item.data)]),
  ]);
  const splitDecoded = await sharp(split).raw().toBuffer({ resolveWithObject: true });
  assert.equal(splitDecoded.info.width, 3);
  const benignSplit = await page.evaluate(async ({ source, exported }) => {
    const native = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      native.call(this, () => callback(new Blob([new Uint8Array(exported)], { type: "image/png" })), type, quality);
    };
    try {
      const file = new File([new Uint8Array(source)], "photo.jpg", { type: "image/jpeg" });
      const converted = await window.Metadata394Wave21.stripImageMetadataLocal({ file });
      return { accepted: true, bytes: [...new Uint8Array(await converted.blob.arrayBuffer())], metadataFree: converted.metadataFree };
    } catch (error) {
      return { accepted: false, error: String(error) };
    } finally {
      HTMLCanvasElement.prototype.toBlob = native;
    }
  }, { source: [...jpeg], exported: [...split] });
  assert.equal(benignSplit.accepted, true, JSON.stringify(benignSplit).slice(0, 200));
  assert.equal(benignSplit.metadataFree, true);
  // The new forensic delivery boundary is a deterministic function of RGBA,
  // not a copy of otherwise valid encoder bytes. A split Adler32 must still
  // be accepted, but its output is canonicalized to the baseline PNG.
  assert.notDeepEqual(Buffer.from(benignSplit.bytes), split);
  assert.deepEqual(Buffer.from(benignSplit.bytes), Buffer.from(baseline.bytes));

  // A moderate but incompressible real PNG crosses the verifier's 64 KiB
  // CRC read boundaries without allocating a full inflated PNG in its code.
  // Independent Sharp checks every resulting RGB pixel (no alpha blending).
  const noisy = Buffer.alloc(512 * 512 * 3);
  let random = 0x39400021;
  for (let i = 0; i < noisy.length; i++) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    noisy[i] = random & 255;
  }
  const largeInput = await sharp(noisy, { raw: { width: 512, height: 512, channels: 3 } }).png().toBuffer();
  const measured = await page.evaluate(async (source) => {
    const began = performance.now();
    const file = new File([new Uint8Array(source)], "private-camera.png", { type: "image/png" });
    const result = await window.Metadata394Wave21.stripImageMetadataLocal({ file });
    return {
      bytes: [...new Uint8Array(await result.blob.arrayBuffer())],
      elapsedMs: Math.round(performance.now() - began),
      metadataFree: result.metadataFree,
    };
  }, [...largeInput]);
  const largeExport = Buffer.from(measured.bytes);
  assert.ok(largeExport.length > 64 * 1024, "The test must cross the streamed CRC boundary");
  assert.equal(measured.metadataFree, true);
  assert.deepEqual((await sharp(largeExport).removeAlpha().raw().toBuffer()), noisy);
  assert.ok(chunks(largeExport).every((item) => ["IHDR", "PLTE", "IDAT", "IEND"].includes(item.type)));
  console.log(`#394 wave21 bounded 512x512 RGB real output: ${largeInput.length}→${largeExport.length} bytes, ${measured.elapsedMs}ms desktop Chromium; exact Sharp pixels`);

  // Historical attack forged canvas.toBlob IDAT bytes after the zlib Adler32.
  // In v6 the native encoder is never used: this verifies the callback is
  // not invoked and the returned artifact equals clean canonical output.
  const attack = await page.evaluate(async ({ source, sentinel }) => {
    const original = HTMLCanvasElement.prototype.toBlob;
    const crc = (bytes) => {
      let c = 0xffffffff;
      for (const value of bytes) {
        c ^= value;
        for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
      }
      return (c ^ 0xffffffff) >>> 0;
    };
    let poisoned = [];
    let browserPixelMatch = false;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      original.call(this, async (blob) => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let lastIdatOffset = -1;
        let cursor = 8;
        while (cursor + 12 <= bytes.length) {
          const length = new DataView(bytes.buffer).getUint32(cursor);
          const label = new TextDecoder().decode(bytes.subarray(cursor + 4, cursor + 8));
          if (label === "IDAT") lastIdatOffset = cursor;
          cursor += length + 12;
        }
        let position = 8;
        const parts = [bytes.subarray(0, 8)];
        while (position + 12 <= bytes.length) {
          const view = new DataView(bytes.buffer);
          const length = view.getUint32(position);
          const label = new TextDecoder().decode(bytes.subarray(position + 4, position + 8));
          if (label === "IDAT" && position === lastIdatOffset) {
            const data = new Uint8Array(length + sentinel.length);
            data.set(bytes.subarray(position + 8, position + 8 + length));
            data.set(new TextEncoder().encode(sentinel), length);
            const changed = new Uint8Array(data.length + 12);
            new DataView(changed.buffer).setUint32(0, data.length);
            changed.set(new TextEncoder().encode(label), 4);
            changed.set(data, 8);
            new DataView(changed.buffer).setUint32(changed.length - 4, crc(changed.subarray(4, -4)));
            parts.push(changed);
          } else {
            parts.push(bytes.subarray(position, position + 12 + length));
          }
          position += 12 + length;
        }
        const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
        let index = 0;
        for (const part of parts) { result.set(part, index); index += part.length; }
        poisoned = [...result];
        const originalBitmap = await createImageBitmap(blob);
        const poisonedBitmap = await createImageBitmap(new Blob([result], { type: "image/png" }));
        const canvas = document.createElement("canvas");
        canvas.width = originalBitmap.width;
        canvas.height = originalBitmap.height;
        const context = canvas.getContext("2d");
        context.drawImage(originalBitmap, 0, 0);
        const a = [...context.getImageData(0, 0, canvas.width, canvas.height).data];
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(poisonedBitmap, 0, 0);
        const b = [...context.getImageData(0, 0, canvas.width, canvas.height).data];
        browserPixelMatch = JSON.stringify(a) === JSON.stringify(b);
        originalBitmap.close();
        poisonedBitmap.close();
        callback(new Blob([result], { type: "image/png" }));
      }, type, quality);
    };
    try {
      const file = new File([new Uint8Array(source)], "photo.jpg", { type: "image/jpeg" });
      const result = await window.Metadata394Wave21.stripImageMetadataLocal({ file });
      return { refused: false, metadataFree: result.metadataFree, bytes: poisoned, browserPixelMatch, delivered: [...new Uint8Array(await result.blob.arrayBuffer())] };
    } catch (error) {
      return { refused: true, code: error.code ?? error.name, bytes: poisoned, browserPixelMatch };
    } finally {
      HTMLCanvasElement.prototype.toBlob = original;
    }
  }, { source: [...jpeg], sentinel: privatePayload });
  const poisoned = Buffer.from(attack.bytes);
  assert.equal(poisoned.length, 0, "No native PNG encode callback should run on canonical-only path");
  assert.equal(attack.browserPixelMatch, false);
  assert.equal(attack.refused, false);
  assert.equal(attack.metadataFree, true);
  assert.deepEqual(Buffer.from(attack.delivered), Buffer.from(baseline.bytes));
  assert.equal(Buffer.from(attack.delivered).includes(privateBytes), false);
  // Adversarial IDAT readback remains covered by the independent v5→v6
  // DEFLATE padding script; here the engine's native encoder is unused.
  console.log("PASS #394 wave21: real JPEG EXIF/IPTC/XMP→canonical PNG exact RGBA; native encoder override unused and no secret delivered");
} finally {
  await browser.close();
}
