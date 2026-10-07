/*
 * Builds the synthetic images used by the image-metadata-segments fixture.
 *
 * Each file is assembled from the container rules of its own specification —
 * W3C PNG chunk layout and CRC-32, ITU-T T.81 JPEG marker segments — so the
 * fixture's expected segment inventory is decided by the format, not by the
 * scanner under test. Run with: npx tsx scripts/generate-metadata-segment-fixtures.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "quality/fixtures/image-metadata-segments");
mkdirSync(outDir, { recursive: true });

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/*
 * The pixel data is copied from an existing, browser-decodable synthetic PNG
 * fixture, so the files produced here are real images a browser can open — the
 * segment walk and an actual decoder both work on them. Only the ancillary
 * chunks, which are what the fixture is about, are authored here.
 */
const PIXEL_SOURCE = readFileSync(resolve(root, "quality/fixtures/image-metadata/synthetic-1x1-rgb.png"));

function readChunks(bytes: Buffer): Map<string, Buffer> {
  const chunks = new Map<string, Buffer>();
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    chunks.set(type, bytes.subarray(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return chunks;
}

const PIXEL_CHUNKS = readChunks(PIXEL_SOURCE);

function ihdr(): Buffer {
  const header = PIXEL_CHUNKS.get("IHDR");
  if (header === undefined) throw new Error("pixel source PNG has no IHDR");
  return pngChunk("IHDR", header);
}

function idat(): Buffer {
  const data = PIXEL_CHUNKS.get("IDAT");
  if (data === undefined) throw new Error("pixel source PNG has no IDAT");
  return pngChunk("IDAT", data);
}

function text(keyword: string, value: string): Buffer {
  return pngChunk("tEXt", Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0]), Buffer.from(value, "latin1")]));
}

function time(): Buffer {
  const value = Buffer.alloc(7);
  value.writeUInt16BE(2026, 0);
  value[2] = 10;
  value[3] = 4;
  value[4] = 12;
  value[5] = 30;
  value[6] = 15;
  return pngChunk("tIME", value);
}

/** A minimal Exif TIFF block: byte order, IFD0 with one ASCII tag, next IFD 0. */
function exifPayload(make: string): Buffer {
  const value = Buffer.from(make, "latin1");
  const ifdOffset = 8;
  const entryCount = 1;
  const ifdSize = 2 + entryCount * 12 + 4;
  const valueOffset = ifdOffset + ifdSize;
  const total = valueOffset + value.length;
  const out = Buffer.alloc(total);
  out.write("MM", 0, "ascii");
  out.writeUInt16BE(42, 2);
  out.writeUInt32BE(ifdOffset, 4);
  out.writeUInt16BE(entryCount, ifdOffset);
  out.writeUInt16BE(0x010f, ifdOffset + 2);
  out.writeUInt16BE(2, ifdOffset + 4);
  out.writeUInt32BE(value.length, ifdOffset + 6);
  out.writeUInt32BE(valueOffset, ifdOffset + 10);
  out.writeUInt32BE(0, ifdOffset + 14);
  value.copy(out, valueOffset);
  return out;
}

function exifChunk(): Buffer {
  return pngChunk("eXIf", exifPayload("Strumentini"));
}

function png(extra: readonly Buffer[]): Buffer {
  return Buffer.concat([PNG_SIGNATURE, ihdr(), ...extra, idat(), pngChunk("IEND", Buffer.alloc(0))]);
}

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const out = Buffer.alloc(4 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  out.writeUInt16BE(payload.length + 2, 2);
  payload.copy(out, 4);
  return out;
}

/** SOF0 declaring 2×2, then a minimal scan payload; enough for a segment walk. */
function jpeg(metadata: readonly Buffer[]): Buffer {
  const sof = Buffer.alloc(13);
  sof[0] = 8;
  sof.writeUInt16BE(2, 1);
  sof.writeUInt16BE(2, 3);
  sof[5] = 1;
  sof[6] = 1;
  sof[7] = 0x11;
  sof[8] = 0;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe0, Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])),
    ...metadata,
    jpegSegment(0xdb, Buffer.alloc(65)),
    jpegSegment(0xc0, sof),
    jpegSegment(0xc4, Buffer.alloc(2 + 16 + 1)),
    jpegSegment(0xda, Buffer.from([0x01, 0x01, 0x00, 0x00, 0x3f, 0x00])),
    Buffer.from([0x12, 0x34, 0x56]),
    Buffer.from([0xff, 0xd9]),
  ]);
}

writeFileSync(resolve(outDir, "with-text.png"), png([text("Software", "Strumentini"), time()]));
writeFileSync(resolve(outDir, "with-exif.png"), png([exifChunk(), text("Comment", "synthetic fixture")]));
writeFileSync(resolve(outDir, "clean.png"), png([]));

const comment = Buffer.from("synthetic fixture", "latin1");
writeFileSync(resolve(outDir, "exif-app1.jpg"), jpeg([
  jpegSegment(0xe1, Buffer.concat([Buffer.from("Exif\0\0", "latin1"), exifPayload("Strumentini")])),
  jpegSegment(0xfe, comment),
]));

writeFileSync(resolve(outDir, "xmp-app1.jpg"), jpeg([
  jpegSegment(0xe1, Buffer.concat([
    Buffer.from("http://ns.adobe.com/xap/1.0/\0", "latin1"),
    Buffer.from("<x:xmpmeta/>", "latin1"),
  ])),
]));

writeFileSync(resolve(outDir, "iptc-app13.jpg"), jpeg([
  jpegSegment(0xed, Buffer.concat([Buffer.from("Photoshop 3.0\0", "latin1"), Buffer.from([0x38, 0x42, 0x49, 0x4d, 0x04, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])])),
]));

// A PNG whose declared chunk length runs past the end of the file.
const truncated = Buffer.concat([PNG_SIGNATURE, ihdr()]);
writeFileSync(resolve(outDir, "truncated.png"), truncated);

writeFileSync(resolve(outDir, "not-an-image.bin"), Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]));

console.log("image-metadata-segments fixtures written");