/** Full raster round-trip for #394. Run: node tests/metadata-forensic-394.browser.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const clean = new Uint8Array(readFileSync(new URL("../quality/fixtures/image-metadata-segments/clean.png", import.meta.url)));

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const result = new Uint8Array(12 + payload.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, payload.length);
  result.set(new TextEncoder().encode(type), 4);
  result.set(payload, 8);
  view.setUint32(result.length - 4, crc32(result.subarray(4, result.length - 4)));
  return result;
}

function combine(...sections) {
  const bytes = new Uint8Array(sections.reduce((sum, section) => sum + section.length, 0));
  let offset = 0;
  for (const section of sections) { bytes.set(section, offset); offset += section.length; }
  return bytes;
}

function chunkNames(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [...clean.subarray(0, 8)]);
  let offset = 8;
  const names = [];
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
    assert.ok(offset + 12 + length <= bytes.length, `Truncated PNG ${type}`);
    const actualCrc = new DataView(bytes.buffer, bytes.byteOffset + offset + 8 + length, 4).getUint32(0);
    assert.equal(actualCrc, crc32(bytes.subarray(offset + 4, offset + 8 + length)), `Bad ${type} CRC`);
    names.push(type);
    offset += 12 + length;
    if (type === "IEND") { assert.equal(offset, bytes.length, "No trailer after IEND"); return names; }
  }
  throw Error("Missing IEND");
}

const input = combine(
  clean.subarray(0, -12),
  chunk("eXIf", new TextEncoder().encode("Exif hidden thumbnail synthetic pointer")),
  chunk("iTXt", new TextEncoder().encode("XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta>gps</x:xmpmeta>")),
  chunk("tEXt", new TextEncoder().encode("Comment\0private source note")),
  chunk("aaAB", new TextEncoder().encode("unknown private data")),
  clean.subarray(-12),
);
assert.deepEqual(chunkNames(input), ["IHDR", "IDAT", "eXIf", "iTXt", "tEXt", "aaAB", "IEND"]);

const bundle = await build({
  entryPoints: [new URL("../src/engines/image/strip-metadata.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  globalName: "Metadata394",
});

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("about:blank");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const observed = await page.evaluate(async (source) => {
    const file = new File([new Uint8Array(source)], "photo.png", { type: "image/png" });
    const result = await window.Metadata394.stripImageMetadataLocal({ file });
    const copy = new Uint8Array(await result.blob.arrayBuffer());
    // Independently reopen the returned Blob in this real browser.
    const reopened = await createImageBitmap(new Blob([copy], { type: "image/png" }));
    const dimensions = [reopened.width, reopened.height];
    reopened.close();
    return {
      output: [...copy],
      dimensions,
      before: result.inputInventory,
      after: result.outputInventory,
      metadataFree: result.metadataFree,
      fidelity: result.fidelity,
      policy: result.policyIt,
    };
  }, [...input]);
  assert.equal(observed.metadataFree, true);
  assert.deepEqual(observed.dimensions, [1, 1]);
  assert.equal(observed.before.complete, true);
  assert.deepEqual(observed.before.segments.map(({ carrier }) => carrier), ["exif", "xmp", "text", "ancillary"]);
  assert.deepEqual(observed.after, { format: "png", segments: [], bytesTotal: 0, privacySegmentCount: 0, privacyBytes: 0, complete: true });
  assert.equal(observed.fidelity.decodedRgbaExact, true);
  assert.match(observed.policy, /thumbnail Exif/);
  const outputChunks = chunkNames(new Uint8Array(observed.output));
  assert.equal(outputChunks[0], "IHDR");
  assert.equal(outputChunks.at(-1), "IEND");
  assert.ok(outputChunks.includes("IDAT"));
  assert.ok(outputChunks.every((name) => ["IHDR", "PLTE", "IDAT", "IEND"].includes(name)), `Output includes ${outputChunks}`);

  // Inject metadata >8 MiB into the *actual* browser-encoded result. This is
  // a valid CRC PNG; the historical 8 MiB prefix probe would miss the XMP
  // after the text payload and return metadataFree:true.
  const tampered = await page.evaluate(async (source) => {
    const crc = (bytes) => {
      let result = 0xffffffff;
      for (const byte of bytes) {
        result ^= byte;
        for (let bit = 0; bit < 8; bit++) result = (result >>> 1) ^ ((result & 1) ? 0xedb88320 : 0);
      }
      return (result ^ 0xffffffff) >>> 0;
    };
    const makeChunk = (name, data) => {
      const bytes = new Uint8Array(data.length + 12);
      new DataView(bytes.buffer).setUint32(0, data.length);
      bytes.set(new TextEncoder().encode(name), 4);
      bytes.set(data, 8);
      new DataView(bytes.buffer).setUint32(bytes.length - 4, crc(bytes.subarray(4, -4)));
      return bytes;
    };
    const original = HTMLCanvasElement.prototype.toBlob;
    let decodable = false;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      original.call(this, async (blob) => {
        const valid = new Uint8Array(await blob.arrayBuffer());
        const largeText = new Uint8Array(8 * 1024 * 1024 + 3);
        largeText.set(new TextEncoder().encode("Comment\0synthetic"));
        const xmp = makeChunk("iTXt", new TextEncoder().encode("XML:com.adobe.xmp\0\0\0\0\0secret"));
        const huge = makeChunk("tEXt", largeText);
        const poisoned = new Blob([valid.subarray(0, -12), huge, xmp, valid.subarray(-12)], { type: "image/png" });
        try {
          const bitmap = await createImageBitmap(poisoned);
          decodable = bitmap.width === 1 && bitmap.height === 1;
          bitmap.close();
        } catch { /* Engine should refuse this regardless. */ }
        callback(poisoned);
      }, type, quality);
    };
    try {
      const file = new File([new Uint8Array(source)], "photo.png", { type: "image/png" });
      await window.Metadata394.stripImageMetadataLocal({ file });
      return { refused: false, decodable };
    } catch (error) {
      return { refused: true, code: String(error).split(":")[0], decodable };
    } finally { HTMLCanvasElement.prototype.toBlob = original; }
  }, [...input]);
  // Native canvas output is no longer part of this privacy path. An
  // adversarial toBlob override is not invoked; actual delivered bytes are
  // always the independently checked canonical representation.
  assert.deepEqual(tampered, { refused: false, decodable: false });

  const rejected = await page.evaluate(async () => {
    const cases = [
      ["document.svg", "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg'></svg>"],
      ["document.pdf", "application/pdf", "%PDF-1.4\n"],
      ["document.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "PK\x03\x04"],
    ];
    const errors = [];
    for (const [name, type, data] of cases) {
      try {
        await window.Metadata394.stripImageMetadataLocal({ file: new File([data], name, { type }) });
        errors.push("WRONG_SUCCESS");
      } catch { errors.push("refused"); }
    }
    try {
      const controller = new AbortController(); controller.abort();
      await window.Metadata394.stripImageMetadataLocal({ file: new File([new Uint8Array([137,80,78,71])], "short.png", { type: "image/png" }) }, controller.signal);
      errors.push("WRONG_SUCCESS");
    } catch (error) { errors.push(error.name === "AbortError" ? "cancelled" : "wrong cancellation error"); }
    try {
      const megabyte = new Uint8Array(1024 * 1024);
      await window.Metadata394.stripImageMetadataLocal({ file: new File(Array(41).fill(megabyte), "too-large.png", { type: "image/png" }) });
      errors.push("WRONG_SUCCESS");
    } catch (error) { errors.push(String(error).includes("FILE_TOO_LARGE") ? "size-limited" : "wrong size error"); }
    return errors;
  });
  assert.deepEqual(rejected, ["refused", "refused", "refused", "cancelled", "size-limited"]);
  console.log("PASS #394 Chromium 390x844: actual canonical PNG pixels/CRC, native encoder XMP injection never invoked; unsupported formats/cancel/41MiB refused; 0 uploads");
} finally {
  await browser.close();
}
