/**
 * #394 after-export JPEG forensics: image decoders can ignore a Huffman table
 * while its symbol bytes remain recoverable from an otherwise valid JPEG.
 * Never mistake a decoder's pixel success for an absence-of-private-bytes proof.
 */
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { scanImageMetadata, scanImageMetadataBlob } from "../src/engines/image/metadata";

// Every symbol is a distinct legal JPEG baseline AC run/size code. The first
// four spell EXIF; 32 more store an independently recoverable private vector.
// This is an otherwise standards-shaped Huffman table, not corrupt entropy.
const SENTINEL = Buffer.from("EXIF");
const symbolBytes: number[] = [...SENTINEL];
for (let run = 0; run < 16 && symbolBytes.length < 36; run++) {
  for (let size = 1; size <= 10 && symbolBytes.length < 36; size++) {
    const symbol = (run << 4) | size;
    if (!symbolBytes.includes(symbol)) symbolBytes.push(symbol);
  }
}
const PRIVATE_SYMBOLS = Buffer.from(symbolBytes);
const PIXELS = Buffer.alloc(16 * 16 * 3);
for (let y = 0; y < 16; y++) {
  for (let x = 0; x < 16; x++) {
    const at = (y * 16 + x) * 3;
    PIXELS[at] = x * 15;
    PIXELS[at + 1] = y * 15;
    PIXELS[at + 2] = (x * y * 9) & 255;
  }
}
const pillowInstalled = spawnSync("python3", ["-c", "from PIL import Image"], { encoding: "utf8" }).status === 0;

async function genuineJpeg(): Promise<Buffer> {
  return sharp(PIXELS, { raw: { width: 16, height: 16, channels: 3 } }).jpeg({ quality: 82 }).toBuffer();
}

function dhtWithPrivateSymbols(table: number): Buffer {
  // A valid Huffman AC table with 36 distinct legal symbols assigned to
  // eight-bit Huffman codes. An unused table does not affect decoded pixels.
  const histogram = Buffer.alloc(16);
  histogram[7] = PRIVATE_SYMBOLS.length;
  const payload = Buffer.concat([Buffer.from([0x10 | table]), histogram, PRIVATE_SYMBOLS]);
  const segment = Buffer.alloc(payload.length + 4);
  segment.set([0xff, 0xc4], 0);
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return segment;
}

function prependJpegSegment(jpeg: Buffer, marker: Buffer): Buffer {
  expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  expect([...jpeg.subarray(-2)]).toEqual([0xff, 0xd9]);
  return Buffer.concat([jpeg.subarray(0, 2), marker, jpeg.subarray(2)]);
}

function addPrivateTableToExistingDht(jpeg: Buffer, privateTable: Buffer): Buffer {
  let at = 2;
  while (at + 4 <= jpeg.length) {
    expect(jpeg[at]).toBe(0xff);
    const marker = jpeg[at + 1]!;
    if (marker === 0xda) break;
    const size = jpeg.readUInt16BE(at + 2);
    if (marker === 0xc4) {
      const added = privateTable.subarray(4); // the table record, within the existing DHT
      const length = Buffer.from([(size + added.length) >>> 8, (size + added.length) & 255]);
      return Buffer.concat([
        jpeg.subarray(0, at + 2), length,
        jpeg.subarray(at + 4, at + 2 + size), added,
        jpeg.subarray(at + 2 + size),
      ]);
    }
    at += size + 2;
  }
  throw new Error("Expected a genuine referenced JPEG DHT segment before SOS");
}

async function checkedPixels(source: Buffer): Promise<Buffer> {
  const reopened = await sharp(source).raw().toBuffer({ resolveWithObject: true });
  expect(reopened.info).toMatchObject({ width: 16, height: 16 });
  return reopened.data;
}

function pillowPixels(source: Buffer): Buffer {
  const script = [
    "import io, sys",
    "from PIL import Image",
    "im = Image.open(io.BytesIO(sys.stdin.buffer.read()))",
    "im.load()",
    "sys.stdout.buffer.write(im.convert('RGB').tobytes())",
  ].join("\n");
  const result = spawnSync("python3", ["-c", script], {
    input: source, encoding: "buffer", maxBuffer: 100_000, timeout: 10_000,
  });
  expect(result.status, Buffer.from(result.stderr).toString()).toBe(0);
  return Buffer.from(result.stdout);
}

describe("#394 JPEG DHT private symbols that never contribute to pixels", () => {
  it("counts a valid unused table containing recoverable private bytes without changing decoded RGB", async () => {
    const clean = await genuineJpeg();
    const hidden = dhtWithPrivateSymbols(3); // AC table 3 is not referenced by normal baseline JPEG SOS
    const tainted = prependJpegSegment(clean, hidden);
    expect(tainted.includes(PRIVATE_SYMBOLS)).toBe(true);
    expect((await checkedPixels(tainted))).toEqual(await checkedPixels(clean));
    if (pillowInstalled) expect(pillowPixels(tainted)).toEqual(pillowPixels(clean));
    const inventory = scanImageMetadata(tainted);
    expect(inventory).toMatchObject({ format: "jpeg", complete: true, privacySegmentCount: 1, privacyBytes: hidden.length });
    expect(inventory.segments).toEqual([
      expect.objectContaining({ carrier: "ancillary", segment: "JPEG DHT unused", bytes: hidden.length }),
    ]);
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(tainted)]))).toEqual(inventory);
  }, 20_000);

  it("identifies redefined table bytes discarded before SOS, even if its table ID is later used", async () => {
    const clean = await genuineJpeg();
    const ignored = dhtWithPrivateSymbols(0); // existing AC0 is redefined by the actual JPEG's DHT before SOS
    const tainted = prependJpegSegment(clean, ignored);
    expect((await checkedPixels(tainted))).toEqual(await checkedPixels(clean));
    if (pillowInstalled) expect(pillowPixels(tainted)).toEqual(pillowPixels(clean));
    expect(scanImageMetadata(tainted)).toMatchObject({ complete: true, privacySegmentCount: 1, privacyBytes: ignored.length });
    expect(scanImageMetadata(tainted).segments).toContainEqual(
      expect.objectContaining({ carrier: "ancillary", segment: "JPEG DHT unused", bytes: ignored.length }),
    );
  }, 20_000);

  it("detects private unused symbols sharing the SAME DHT marker with referenced Huffman tables", async () => {
    const clean = await genuineJpeg();
    const leaked = addPrivateTableToExistingDht(clean, dhtWithPrivateSymbols(3));
    expect(leaked.includes(PRIVATE_SYMBOLS)).toBe(true);
    expect(await checkedPixels(leaked)).toEqual(await checkedPixels(clean));
    if (pillowInstalled) expect(pillowPixels(leaked)).toEqual(pillowPixels(clean));
    const inventory = scanImageMetadata(leaked);
    expect(inventory.complete).toBe(true);
    expect(inventory.privacySegmentCount).toBe(1);
    expect(inventory.segments).toContainEqual(expect.objectContaining({
      carrier: "ancillary", segment: "JPEG DHT unused",
    }));
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(leaked)]))).toEqual(inventory);
  }, 20_000);

  it("keeps real referenced Huffman tables neutral and refuses forged/partial inventories", async () => {
    const clean = await genuineJpeg();
    expect(scanImageMetadata(clean)).toMatchObject({ format: "jpeg", complete: true, segments: [], privacySegmentCount: 0 });
    const tainted = prependJpegSegment(clean, dhtWithPrivateSymbols(3));
    const cut = tainted.subarray(0, tainted.length - 2);
    expect(scanImageMetadata(cut).complete).toBe(false);
    const abort = AbortSignal.abort();
    await expect(scanImageMetadataBlob(new Blob([new Uint8Array(tainted)]), abort))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
