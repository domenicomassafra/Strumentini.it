/** #394 independent reviewer follow-on: a recognized JPEG APP carrier can still hide private bytes. */
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  describeMetadataIt,
  groupImageMetadata,
  scanImageMetadata,
  scanImageMetadataBlob,
} from "../src/engines/image/metadata";

const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
const plainJpeg = (): Promise<Buffer> => sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).jpeg().toBuffer();
const iccJpeg = (): Promise<Buffer> => sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).withIccProfile("srgb").jpeg().toBuffer();

function appSegment(marker: number, payload: Buffer): Buffer {
  const bytes = Buffer.alloc(payload.length + 4);
  bytes.set([0xff, marker], 0);
  bytes.writeUInt16BE(payload.length + 2, 2);
  payload.copy(bytes, 4);
  return bytes;
}

function withJfifDensity(source: Buffer, density: [number, number, number, number]): Buffer {
  expect([...source.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  // JFIF APP0 14-byte data: identifier, version, units, Xdensity, Ydensity,
  // Xthumbnail=0, Ythumbnail=0. Density is a pair of arbitrary 16-bit numbers.
  const jfif = Buffer.from([74, 70, 73, 70, 0, 1, 1, 0, ...density, 0, 0]);
  expect(jfif.length).toBe(14);
  return Buffer.concat([source.subarray(0, 2), appSegment(0xe0, jfif), source.subarray(2)]);
}

function withEmptyApp15(source: Buffer, count: number): Buffer {
  expect([...source.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  const markers = Buffer.alloc(count * 4);
  for (let index = 0; index < markers.length; index += 4) {
    markers.set([0xff, 0xef, 0, 2], index); // valid zero-payload JPEG APP15 segment
  }
  return Buffer.concat([source.subarray(0, 2), markers, source.subarray(2)]);
}

function withPrivateIccCopyright(source: Buffer, sentinel: string): Buffer {
  expect([...source.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe2]);
  const originalApp2End = 4 + source.readUInt16BE(4);
  expect(source.toString("latin1", 6, 18)).toBe("ICC_PROFILE\0");
  const profile = Buffer.from(source.subarray(20, originalApp2End));
  expect(profile.readUInt32BE(0)).toBe(profile.length);
  expect(profile.toString("ascii", 144, 148)).toBe("cprt");

  // Repoint the standard ICC `cprt` tag to a well-formed `mluc` copyright tag
  // appended after the existing profile data. Color transform tags are intact.
  const privateText = Buffer.from(sentinel, "utf16le").swap16();
  const copyright = Buffer.alloc((28 + privateText.length + 3) & ~3);
  copyright.write("mluc", 0, "ascii");
  copyright.writeUInt32BE(1, 8); // one multilingual record
  copyright.writeUInt32BE(12, 12);
  copyright.write("enUS", 16, "ascii");
  copyright.writeUInt32BE(privateText.length, 20);
  copyright.writeUInt32BE(28, 24);
  privateText.copy(copyright, 28);

  const amended = Buffer.concat([profile, copyright]);
  amended.writeUInt32BE(amended.length, 0);
  amended.writeUInt32BE(profile.length, 148); // cprt tag offset
  amended.writeUInt32BE(copyright.length, 152); // cprt tag length
  const app2 = appSegment(0xe2, Buffer.concat([Buffer.from("ICC_PROFILE\0", "latin1"), Buffer.from([1, 1]), amended]));
  return Buffer.concat([source.subarray(0, 2), app2, source.subarray(originalApp2End)]);
}

const hasPillow = spawnSync("python3", ["-c", "from PIL import Image"], { encoding: "utf8" }).status === 0;
function pillowRgbaAndIcc(source: Buffer): { rgbaHex: string; iccLength: number } {
  const script = [
    "import io, json, sys",
    "from PIL import Image",
    "with Image.open(io.BytesIO(sys.stdin.buffer.read())) as im:",
    "  im.load()",
    "  print(json.dumps({'rgbaHex': im.convert('RGBA').tobytes().hex(), 'iccLength': len(im.info.get('icc_profile', b''))}))",
  ].join("\n");
  const run = spawnSync("python3", ["-c", script], {
    input: source, encoding: "utf8", timeout: 10_000,
  });
  expect(run.status, run.stderr).toBe(0);
  return JSON.parse(run.stdout) as { rgbaHex: string; iccLength: number };
}

describe("#394 reviewer: JPEG JFIF and ICC privacy claims", () => {
  it("does not omit JFIF density fields that can store 'GPS!' while pixels decode normally", async () => {
    const clean = await plainJpeg();
    const encoded = withJfifDensity(clean, [0x47, 0x50, 0x53, 0x21]); // ASCII GPS! in valid numeric density fields
    expect(await sharp(encoded).raw().toBuffer()).toEqual(await sharp(clean).raw().toBuffer());
    if (hasPillow) expect(pillowRgbaAndIcc(encoded).rgbaHex).toBe(pillowRgbaAndIcc(clean).rgbaHex);
    expect(encoded.toString("latin1").includes("GPS!")).toBe(true);

    const inventory = scanImageMetadata(encoded);
    expect(inventory).toMatchObject({ format: "jpeg", complete: true, privacySegmentCount: 1, privacyBytes: 18 });
    expect(inventory.segments).toEqual([
      expect.objectContaining({ carrier: "ancillary", segment: "JPEG APP0", bytes: 18 }),
    ]);
    expect(describeMetadataIt(inventory)).not.toContain("Nessun segmento");

    // The exact fixed 1:1/no-thumbnail JFIF constant has no user-variable
    // data and remains ignored; any variable density, including 72:72, is
    // inventoried conservatively rather than treated as an empty APP0.
    const neutralJfif = withJfifDensity(clean, [0, 1, 0, 1]);
    expect(scanImageMetadata(neutralJfif)).toMatchObject({ complete: true, privacySegmentCount: 0, segments: [] });
    const variableJfif = withJfifDensity(clean, [0, 72, 0, 72]);
    expect(scanImageMetadata(variableJfif)).toMatchObject({ complete: true, privacySegmentCount: 1 });
    expect(scanImageMetadata(clean)).toMatchObject({ complete: true, privacySegmentCount: 0, segments: [] });
  });

  it("counts valid ICC copyright text carrying a private sentinel in the source privacy summary", async () => {
    const clean = await iccJpeg();
    const sentinel = "PRIVATE_GPS_XMP_NESTED_THUMBNAIL_394_REVIEW";
    const encoded = withPrivateIccCopyright(clean, sentinel);
    expect(await sharp(encoded).raw().toBuffer()).toEqual(await sharp(clean).raw().toBuffer());
    const icc = (await sharp(encoded).metadata()).icc;
    expect(icc).toBeDefined();
    expect(Buffer.from(icc!).includes(Buffer.from(sentinel, "utf16le").swap16())).toBe(true);
    if (hasPillow) {
      expect(pillowRgbaAndIcc(encoded).rgbaHex).toBe(pillowRgbaAndIcc(clean).rgbaHex);
      expect(pillowRgbaAndIcc(encoded).iccLength).toBe(icc!.length);
    }

    const inventory = scanImageMetadata(encoded);
    expect(inventory).toMatchObject({ format: "jpeg", complete: true, privacySegmentCount: 1 });
    expect(inventory.segments).toEqual([
      expect.objectContaining({ carrier: "icc-profile", segment: "JPEG APP2 ICC", bytes: icc!.length + 18 }),
    ]);
    expect(inventory.privacyBytes).toBe(inventory.bytesTotal);
    expect(groupImageMetadata(inventory)).toEqual([
      expect.objectContaining({ carrier: "icc-profile", class: "color", count: 1 }),
    ]);
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(encoded)]))).toMatchObject({ privacySegmentCount: 1 });
  });

  it("bounds the per-marker JPEG inventory, marks it partial, and keeps earlier findings", async () => {
    const clean = await plainJpeg();
    const valid = withEmptyApp15(clean, 1_000);
    // No mocked decoder: 1000 zero-payload APP15 blocks are genuinely decodable
    // by independent Sharp and Pillow while they retain the original picture.
    expect(await sharp(valid).raw().toBuffer()).toEqual(await sharp(clean).raw().toBuffer());
    if (hasPillow) expect(pillowRgbaAndIcc(valid).rgbaHex).toBe(pillowRgbaAndIcc(clean).rgbaHex);

    const inventory = scanImageMetadata(valid);
    expect(inventory).toMatchObject({ format: "jpeg", complete: false });
    expect(inventory.segments.length).toBeGreaterThan(0);
    expect(inventory.segments.length).toBeLessThanOrEqual(512);
    expect(inventory.privacySegmentCount).toBe(inventory.segments.length);
    expect(inventory.privacyBytes).toBe(inventory.segments.length * 4);
    expect(describeMetadataIt(inventory)).toMatch(/parziale|incomplet/iu);
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(valid)]))).toMatchObject({ complete: false });

    const ordinary = scanImageMetadata(withEmptyApp15(clean, 16));
    expect(ordinary).toMatchObject({ complete: true, privacySegmentCount: 16 });
    // A manageable 128 KiB marker-only stress case checks bounded allocations
    // without fabricating a multi-megabyte resource attack or risking OOM.
    const stress = scanImageMetadata(withEmptyApp15(clean, 32_768));
    expect(stress).toMatchObject({ complete: false });
    expect(stress.segments.length).toBeLessThanOrEqual(512);

    const abort = new AbortController();
    abort.abort();
    await expect(scanImageMetadataBlob(new Blob([new Uint8Array(valid)]), abort.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
