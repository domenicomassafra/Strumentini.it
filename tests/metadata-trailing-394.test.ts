/** #394 independent forensic checks of real encoded JPEG / WebP export bytes.
 * Sharp is used only to make and independently decode image bytes, never as
 * the engine's metadata scanner or to decide expected container boundaries.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { scanImageMetadata, scanImageMetadataBlob } from "../src/engines/image/metadata";

const SECRET = new TextEncoder().encode("Exif\0\0PRIVATE_394_AFTER_EXPORT_GPS_XMP");
const JPEG_END = [0xff, 0xd9];

function join(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
  return output;
}

function jpegMarker(marker: number, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(4 + data.length);
  bytes.set([0xff, marker, (data.length + 2) >>> 8, (data.length + 2) & 255]);
  bytes.set(data, 4);
  return bytes;
}

function webpSize(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8;
}

// Independent small RIFF boundary checker; it does not import metadata.ts.
function independentlyWalkWebp(bytes: Uint8Array): { declaredEnd: number; chunks: string[]; exactEnd: boolean } {
  expect(Buffer.from(bytes.subarray(0, 4)).toString("ascii")).toBe("RIFF");
  expect(Buffer.from(bytes.subarray(8, 12)).toString("ascii")).toBe("WEBP");
  const declaredEnd = webpSize(bytes);
  const chunks: string[] = [];
  let offset = 12;
  while (offset + 8 <= Math.min(declaredEnd, bytes.byteLength)) {
    const name = Buffer.from(bytes.subarray(offset, offset + 4)).toString("ascii");
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    chunks.push(name);
    offset += 8 + size + (size & 1);
  }
  return { declaredEnd, chunks, exactEnd: offset === declaredEnd && declaredEnd === bytes.byteLength };
}

async function encoded(format: "jpeg" | "webp"): Promise<Uint8Array> {
  // The fixture consists of authentic decodable pixels, not fabricated JPEG
  // entropy or a mock WebP header; export is a fresh full codec serialization.
  const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
  const pipeline = sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } });
  const bytes = await (format === "jpeg" ? pipeline.jpeg() : pipeline.webp()).toBuffer();
  const decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  expect(decoded.info.width).toBe(2);
  expect(decoded.info.height).toBe(2);
  return new Uint8Array(bytes);
}

describe("#394 JPEG/WebP forensic readback beyond exported image container", () => {
  it("walks a real clean JPEG through entropy to a terminal EOI, then rejects extra hidden APP1/Exif", async () => {
    const clean = await encoded("jpeg");
    expect([...clean.subarray(-2)]).toEqual(JPEG_END);
    expect(scanImageMetadata(clean)).toMatchObject({ format: "jpeg", complete: true, segments: [] });

    const trailing = jpegMarker(0xe1, SECRET);
    const tampered = join(clean, trailing);
    // Real decoder may still display the image while hiding the appended data;
    // successful decoding alone does not prove a metadata-free export.
    const reopened = await sharp(tampered).raw().toBuffer({ resolveWithObject: true });
    expect(reopened.info.width).toBe(2);
    expect(tampered.indexOf(SECRET[0]!, clean.length)).toBe(clean.length + 4);
    const inventory = scanImageMetadata(tampered);
    expect(inventory.complete).toBe(false);
    expect(inventory.segments).toContainEqual(expect.objectContaining({ carrier: "ancillary", segment: "JPEG trailing payload", bytes: trailing.length }));
    expect(inventory.privacySegmentCount).toBeGreaterThanOrEqual(1);
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(tampered)]))).toEqual(inventory);
  });

  it("rejects a truncated JPEG scan missing EOI instead of certifying metadata-free output", async () => {
    const jpeg = await encoded("jpeg");
    const missingEnd = jpeg.subarray(0, -2);
    expect([...jpeg.subarray(-2)]).toEqual(JPEG_END);
    expect(scanImageMetadata(missingEnd)).toMatchObject({ format: "jpeg", complete: false });
    expect((await scanImageMetadataBlob(new Blob([new Uint8Array(missingEnd)]))).complete).toBe(false);
  });

  it("rejects appended WebP XMP/EXIF outside the declared RIFF size despite codec readback", async () => {
    const clean = await encoded("webp");
    const original = independentlyWalkWebp(clean);
    expect(original.exactEnd).toBe(true);
    expect(original.chunks.length).toBeGreaterThan(0);
    expect(scanImageMetadata(clean)).toMatchObject({ format: "webp", complete: true, segments: [] });

    const payload = join(new TextEncoder().encode("XMP "), new Uint8Array(4), SECRET, new Uint8Array(SECRET.length % 2));
    new DataView(payload.buffer).setUint32(4, SECRET.length, true);
    const appended = join(clean, payload); // RIFF size deliberately remains original
    expect(independentlyWalkWebp(appended)).toMatchObject({ declaredEnd: clean.length, exactEnd: false });
    const reopened = await sharp(appended).raw().toBuffer({ resolveWithObject: true });
    expect(reopened.info.height).toBe(2);
    const inventory = scanImageMetadata(appended);
    expect(inventory.complete).toBe(false);
    expect(inventory.segments).toContainEqual(expect.objectContaining({ carrier: "ancillary", segment: "WebP trailing payload", bytes: payload.length }));
    expect(inventory.privacySegmentCount).toBeGreaterThanOrEqual(1);
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(appended)]))).toEqual(inventory);
  });

  it("detects real WebP XMP FourCC (with mandatory trailing space) inside a valid exported RIFF", async () => {
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><Secret>PRIVATE_394_XMP</Secret></x:xmpmeta>`;
    const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
    const bytes = new Uint8Array(await sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).withXmp(xmp).webp().toBuffer());
    const outside = independentlyWalkWebp(bytes);
    expect(outside).toMatchObject({ exactEnd: true });
    expect(outside.chunks).toContain("XMP "); // independent FourCC, not engine classifier
    expect(Buffer.from(bytes).includes(Buffer.from("PRIVATE_394_XMP"))).toBe(true);
    expect((await sharp(bytes).raw().toBuffer({ resolveWithObject: true })).info.width).toBe(2);
    expect(scanImageMetadata(bytes)).toMatchObject({ complete: true, format: "webp", privacySegmentCount: 1 });
    expect(scanImageMetadata(bytes).segments).toContainEqual(expect.objectContaining({ carrier: "xmp", segment: "WebP XMP" }));
  });

  it("inventories unknown private WebP chunks instead of certifying a metadata-free exported RIFF", async () => {
    const original = await encoded("webp");
    const chunk = join(new TextEncoder().encode("PRIV"), new Uint8Array(4), SECRET, new Uint8Array(SECRET.length % 2));
    new DataView(chunk.buffer).setUint32(4, SECRET.length, true);
    const bytes = join(original, chunk);
    new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
    expect(independentlyWalkWebp(bytes)).toMatchObject({ exactEnd: true });
    expect(independentlyWalkWebp(bytes).chunks).toContain("PRIV");
    expect((await sharp(bytes).raw().toBuffer({ resolveWithObject: true })).info.width).toBe(2);
    const inventory = scanImageMetadata(bytes);
    expect(inventory.complete).toBe(true);
    expect(inventory.segments).toContainEqual(expect.objectContaining({ carrier: "ancillary", segment: "WebP PRIV" }));
    expect(inventory.privacySegmentCount).toBeGreaterThan(0);
  });

  it("does not certify a RIFF that declares additional unavailable bytes or partial chunk headers", async () => {
    const webp = await encoded("webp");
    const declaredTooBig = webp.slice();
    new DataView(declaredTooBig.buffer).setUint32(4, webp.length + 100 - 8, true);
    expect(scanImageMetadata(declaredTooBig).complete).toBe(false);

    const partialHeader = join(webp, new TextEncoder().encode("EXI"));
    new DataView(partialHeader.buffer).setUint32(4, partialHeader.length - 8, true);
    expect(scanImageMetadata(partialHeader).complete).toBe(false);
  });
});
