/** #394: ordinary JPEG APPn extension segments may carry hidden private data. */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { scanImageMetadata, scanImageMetadataBlob } from "../src/engines/image/metadata";

const privateNote = new TextEncoder().encode("PRIVATE_394_GPS_CONTACT_AFTER_EXPORT");

async function jpeg(withIcc = false): Promise<Uint8Array> {
  const image = sharp({ create: { width: 12, height: 12, channels: 3, background: "#6a487c" } });
  return new Uint8Array(await (withIcc ? image.withIccProfile("srgb") : image).jpeg().toBuffer());
}

function insertJpegApp(source: Uint8Array, marker: number, payload: Uint8Array): Uint8Array {
  expect([...source.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  expect([...source.subarray(-2)]).toEqual([0xff, 0xd9]);
  const entry = new Uint8Array(payload.length + 4);
  entry.set([0xff, marker, (payload.length + 2) >>> 8, (payload.length + 2) & 0xff]);
  entry.set(payload, 4);
  const joined = new Uint8Array(source.length + entry.length);
  joined.set(source.subarray(0, 2));
  joined.set(entry, 2);
  joined.set(source.subarray(2), entry.length + 2);
  return joined;
}

describe("#394 independently reopened JPEG APPn privacy inventory", () => {
  it("inventories opaque APP5 private payload in a decodable, EOI-terminated JPEG", async () => {
    const clean = await jpeg();
    expect(scanImageMetadata(clean)).toMatchObject({ format: "jpeg", complete: true, segments: [] });
    const encoded = insertJpegApp(clean, 0xe5, privateNote);
    expect([...encoded.subarray(2, 6)]).toEqual([0xff, 0xe5, 0, privateNote.length + 2]);
    expect(Buffer.from(encoded).includes(Buffer.from(privateNote))).toBe(true);
    const reopened = await sharp(encoded).raw().toBuffer({ resolveWithObject: true });
    const baseline = await sharp(clean).raw().toBuffer({ resolveWithObject: true });
    expect(reopened.info.width).toBe(12);
    expect(reopened.info.height).toBe(12);
    expect(reopened.data).toEqual(baseline.data);

    const inventory = scanImageMetadata(encoded);
    expect(inventory.complete).toBe(true);
    expect(inventory.segments).toContainEqual(expect.objectContaining({
      carrier: "ancillary", segment: "JPEG APP5", bytes: privateNote.length + 4,
    }));
    expect(inventory.privacySegmentCount).toBeGreaterThan(0);
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(encoded)]))).toEqual(inventory);
  });

  it("does not lose a real Sharp-encoded ICC APP2 container segment", async () => {
    const encoded = await jpeg(true);
    expect(Buffer.from(encoded).includes(Buffer.from("ICC_PROFILE\0"))).toBe(true);
    expect((await sharp(encoded).metadata()).icc).toBeDefined();
    const reopened = await sharp(encoded).raw().toBuffer({ resolveWithObject: true });
    expect(reopened.info.width).toBe(12);
    const inventory = scanImageMetadata(encoded);
    expect(inventory.complete).toBe(true);
    expect(inventory.segments).toContainEqual(expect.objectContaining({
      carrier: "icc-profile", segment: "JPEG APP2 ICC",
    }));
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(encoded)]))).toEqual(inventory);
  });

  it("does not confuse a normal JFIF APP0 header with a JFIF thumbnail carrying concealed pixels", async () => {
    const clean = await jpeg();
    // The 14-byte APP0 JFIF header includes x/y thumbnail dimensions at the end.
    const jfif = new Uint8Array([74, 70, 73, 70, 0, 1, 2, 0, 0, 1, 0, 1, 0, 0]);
    const pure = insertJpegApp(clean, 0xe0, jfif);
    expect((await sharp(pure).raw().toBuffer({ resolveWithObject: true })).info.width).toBe(12);
    expect(scanImageMetadata(pure).segments).toEqual([]);

    const thumbPayload = new Uint8Array([...jfif.subarray(0, -2), 1, 1, 12, 99, 201]);
    const withThumbnail = insertJpegApp(clean, 0xe0, thumbPayload);
    expect((await sharp(withThumbnail).raw().toBuffer({ resolveWithObject: true })).info.height).toBe(12);
    const inventory = scanImageMetadata(withThumbnail);
    expect(inventory.complete).toBe(true);
    expect(inventory.segments).toContainEqual(expect.objectContaining({
      carrier: "ancillary", segment: "JPEG APP0", bytes: thumbPayload.length + 4,
    }));
    expect(inventory.privacySegmentCount).toBeGreaterThan(0);
  });
});
