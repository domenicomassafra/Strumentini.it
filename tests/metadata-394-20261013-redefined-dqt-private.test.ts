/** #394: an overwritten DQT definition retains recoverable non-pixel bytes. */
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { describeMetadataIt, scanImageMetadata, scanImageMetadataBlob } from "../src/engines/image/metadata";

const privateText = Buffer.from("PRIVATE_GPS_OVERRIDDEN_DQT_394_20261013", "ascii");

async function originalJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 12, height: 12, channels: 3, background: "#7c5d31" } }).jpeg().toBuffer();
}

function insertAfterSoi(original: Buffer, marker: Buffer): Buffer {
  expect([...original.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  expect([...original.subarray(-2)]).toEqual([0xff, 0xd9]);
  return Buffer.concat([original.subarray(0, 2), marker, original.subarray(2)]);
}

function pillowPixels(jpeg: Buffer): { pixels: string; quantizationIds: number[] } {
  const program = [
    "import io, json, sys",
    "from PIL import Image",
    "with Image.open(io.BytesIO(sys.stdin.buffer.read())) as image:",
    "  image.load()",
    "  print(json.dumps({'pixels': image.convert('RGB').tobytes().hex(), 'quantizationIds': sorted(image.quantization.keys())}))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", program], {
    input: jpeg, encoding: "utf8", timeout: 10_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { pixels: string; quantizationIds: number[] };
}

describe("#394 JPEG repeated DQT table-ID privacy inventory", () => {
  it("flags an early DQT ID0 private carrier superseded by the real encoder DQT0", async () => {
    const original = await originalJpeg();
    const values = Buffer.alloc(64, 1);
    privateText.copy(values);
    const hostile = insertAfterSoi(original, Buffer.concat([Buffer.from([0xff, 0xdb, 0, 0x43, 0]), values]));
    expect(hostile.includes(privateText)).toBe(true);
    expect(await sharp(hostile).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer());
    const before = pillowPixels(original);
    const after = pillowPixels(hostile);
    expect(after.pixels).toBe(before.pixels);
    expect(before.quantizationIds).toEqual([0, 1]);
    expect(after.quantizationIds).toEqual([0, 1]);
    expect(scanImageMetadata(original)).toMatchObject({ complete: true, privacySegmentCount: 0, segments: [] });
    const inventory = scanImageMetadata(hostile);
    expect(inventory).toMatchObject({ format: "jpeg", complete: true, privacySegmentCount: 1, privacyBytes: 69 });
    expect(inventory.segments).toEqual([
      expect.objectContaining({ carrier: "ancillary", segment: "JPEG DQT redefined", bytes: 69 }),
    ]);
    expect(describeMetadataIt(inventory)).not.toContain("Nessun segmento di metadati");
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(hostile)]))).toEqual(inventory);
  });

  it("counts a mixed DQT marker once even when it repeats one ID internally", async () => {
    const original = await originalJpeg();
    const values = Buffer.alloc(64, 1);
    privateText.copy(values);
    const mixed = Buffer.concat([
      Buffer.from([0xff, 0xdb, 0, 0x84, 0]), values,
      Buffer.from([0]), Buffer.alloc(64, 2),
    ]);
    const hostile = insertAfterSoi(original, mixed);
    expect(hostile.includes(privateText)).toBe(true);
    expect(await sharp(hostile).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer());
    expect(pillowPixels(hostile).pixels).toBe(pillowPixels(original).pixels);
    const inventory = scanImageMetadata(hostile);
    expect(inventory.complete).toBe(true);
    expect(inventory.privacySegmentCount).toBe(1);
    expect(inventory.segments.filter((item) => item.segment === "JPEG DQT redefined" && item.bytes === mixed.length))
      .toHaveLength(1);
  });
});
