import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { describeMetadataIt, groupImageMetadata, scanImageMetadata, scanImageMetadataBlob } from "../src/engines/image/metadata";

const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
const jpeg = (icc = false): Promise<Buffer> => {
  const image = sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } });
  return icc ? image.withIccProfile("srgb").jpeg().toBuffer() : image.jpeg().toBuffer();
};

function app(marker: number, payload: Buffer): Buffer {
  const result = Buffer.alloc(payload.length + 4);
  result.set([0xff, marker], 0);
  result.writeUInt16BE(payload.length + 2, 2);
  payload.copy(result, 4);
  return result;
}
function prepend(source: Buffer, insertion: Buffer): Buffer {
  return Buffer.concat([source.subarray(0, 2), insertion, source.subarray(2)]);
}

const pillowAvailable = spawnSync("python3", ["-c", "from PIL import Image"], { encoding: "utf8" }).status === 0;
function pillowPixels(source: Buffer): { pixels: string; iccBytes: number } {
  const python = [
    "import io, json, sys",
    "from PIL import Image",
    "with Image.open(io.BytesIO(sys.stdin.buffer.read())) as img:",
    "  img.load()",
    "  print(json.dumps({'pixels': img.convert('RGB').tobytes().hex(), 'iccBytes': len(img.info.get('icc_profile', b''))}))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", python], { input: source, encoding: "utf8", timeout: 10_000 });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { pixels: string; iccBytes: number };
}
async function decodesUnchanged(clean: Buffer, candidate: Buffer): Promise<void> {
  expect(await sharp(candidate).raw().toBuffer()).toEqual(await sharp(clean).raw().toBuffer());
  if (pillowAvailable) expect(pillowPixels(candidate).pixels).toBe(pillowPixels(clean).pixels);
}

describe("#394 source-bound JPEG metadata privacy and marker budget", () => {
  it("retains ordinary canonical 1:1 JFIF but inventories valid variable density carrying 'GPS!'", async () => {
    const clean = await jpeg();
    const header = Buffer.from([74, 70, 73, 70, 0, 1, 2, 0, 0, 1, 0, 1, 0, 0]);
    const neutral = prepend(clean, app(0xe0, header));
    expect(scanImageMetadata(neutral)).toMatchObject({ complete: true, privacySegmentCount: 0, segments: [] });
    const variable = Buffer.from(header);
    variable.set([0x47, 0x50, 0x53, 0x21], 8);
    const source = prepend(clean, app(0xe0, variable));
    await decodesUnchanged(clean, source);
    expect(source.includes(Buffer.from("GPS!"))).toBe(true);
    const inventory = scanImageMetadata(source);
    expect(inventory).toMatchObject({ complete: true, privacySegmentCount: 1, privacyBytes: 18 });
    expect(inventory.segments).toEqual([expect.objectContaining({ carrier: "ancillary", segment: "JPEG APP0" })]);
  });

  it("counts an authentic color ICC profile's well-formed private copyright as privacy", async () => {
    const clean = await jpeg(true);
    expect([...clean.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe2]);
    const previousEnd = 4 + clean.readUInt16BE(4);
    expect(clean.toString("latin1", 6, 18)).toBe("ICC_PROFILE\0");
    const profile = Buffer.from(clean.subarray(20, previousEnd));
    expect(profile.readUInt32BE(0)).toBe(profile.length);
    expect(profile.toString("ascii", 144, 148)).toBe("cprt");
    const privateText = Buffer.from("PRIVATE_GPS_CONTACT_394", "utf16le").swap16();
    const copyright = Buffer.alloc((28 + privateText.length + 3) & ~3);
    copyright.write("mluc", 0, "ascii");
    copyright.writeUInt32BE(1, 8);
    copyright.writeUInt32BE(12, 12);
    copyright.write("enUS", 16, "ascii");
    copyright.writeUInt32BE(privateText.length, 20);
    copyright.writeUInt32BE(28, 24);
    privateText.copy(copyright, 28);
    const modifiedProfile = Buffer.concat([profile, copyright]);
    modifiedProfile.writeUInt32BE(modifiedProfile.length, 0);
    modifiedProfile.writeUInt32BE(profile.length, 148);
    modifiedProfile.writeUInt32BE(copyright.length, 152);
    const amendedApp2 = app(0xe2, Buffer.concat([Buffer.from("ICC_PROFILE\0"), Buffer.from([1, 1]), modifiedProfile]));
    const source = Buffer.concat([clean.subarray(0, 2), amendedApp2, clean.subarray(previousEnd)]);
    await decodesUnchanged(clean, source);
    const decodedIcc = (await sharp(source).metadata()).icc;
    expect(decodedIcc).toBeDefined();
    expect(Buffer.from(decodedIcc!).includes(privateText)).toBe(true);
    if (pillowAvailable) expect(pillowPixels(source).iccBytes).toBe(decodedIcc!.length);
    const inventory = scanImageMetadata(source);
    expect(inventory).toMatchObject({ complete: true, privacySegmentCount: 1, privacyBytes: amendedApp2.length });
    expect(inventory.segments).toEqual([expect.objectContaining({ carrier: "icc-profile", segment: "JPEG APP2 ICC" })]);
    expect(groupImageMetadata(inventory)).toEqual([expect.objectContaining({ class: "color" })]);
    expect((await scanImageMetadataBlob(new Blob([new Uint8Array(source)]))).privacySegmentCount).toBe(1);
  });

  it("stops after 512 JPEG markers with a partial truthful report even when Sharp/Pillow decode 1000", async () => {
    const clean = await jpeg();
    const extra = Buffer.alloc(1000 * 4);
    for (let offset = 0; offset < extra.length; offset += 4) extra.set([0xff, 0xef, 0, 2], offset);
    const source = prepend(clean, extra);
    await decodesUnchanged(clean, source);
    const inventory = scanImageMetadata(source);
    expect(inventory).toMatchObject({ format: "jpeg", complete: false });
    expect(inventory.segments.length).toBeGreaterThan(0);
    expect(inventory.segments.length).toBeLessThanOrEqual(512);
    expect(inventory.privacySegmentCount).toBe(inventory.segments.length);
    expect(describeMetadataIt(inventory)).toMatch(/parziale|incomplet/iu);
    expect((await scanImageMetadataBlob(new Blob([new Uint8Array(source)]))).complete).toBe(false);
  });
});
