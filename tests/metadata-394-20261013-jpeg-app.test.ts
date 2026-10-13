/** #394: JPEG application markers must not disappear from a complete metadata inventory. */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { describeMetadataIt, scanImageMetadata, scanImageMetadataBlob } from "../src/engines/image/metadata";

const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
const jpeg = async (icc = false): Promise<Buffer> => {
  const image = sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } });
  return icc ? image.withIccProfile("srgb").jpeg().toBuffer() : image.jpeg().toBuffer();
};

function appMarker(marker: number, payload: Uint8Array): Uint8Array {
  const size = payload.length + 2;
  return Uint8Array.from([0xff, marker, size >>> 8, size & 255, ...payload]);
}

function addAppMarker(source: Uint8Array, marker: number, payload: Uint8Array): Uint8Array {
  // Insert a valid application segment immediately after JPEG SOI, before any
  // image codestream bytes. The original encoded pixels remain byte-identical.
  expect([...source.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  return Uint8Array.from([...source.subarray(0, 2), ...appMarker(marker, payload), ...source.subarray(2)]);
}

const pillowAvailable = spawnSync("python3", ["-c", "from PIL import Image"], { encoding: "utf8" }).status === 0;

function pillowInspect(source: Uint8Array): { width: number; height: number; iccBytes: number } {
  const python = [
    "import io, json, sys",
    "from PIL import Image",
    "with Image.open(io.BytesIO(sys.stdin.buffer.read())) as pic:",
    "  pic.load()",
    "  print(json.dumps({'width': pic.width, 'height': pic.height, 'iccBytes': len(pic.info.get('icc_profile', b''))}))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", python], {
    input: Buffer.from(source), encoding: "utf8", timeout: 10_000,
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { width: number; height: number; iccBytes: number };
}

describe("#394 JPEG APP metadata inventory and truthful after-export reporting", () => {
  it("inventories an authentic Sharp ICC_PROFILE APP2 instead of asserting no metadata", async () => {
    const source = await jpeg(true);
    const decoded = await sharp(source).metadata();
    expect(decoded).toMatchObject({ format: "jpeg", width: 2, height: 2 });
    expect(decoded.icc?.byteLength).toBeGreaterThan(100);
    expect(source.includes(Buffer.from("ICC_PROFILE\0", "latin1"))).toBe(true);
    if (pillowAvailable) expect(pillowInspect(source)).toMatchObject({ width: 2, height: 2, iccBytes: decoded.icc?.byteLength });

    const inventory = scanImageMetadata(source);
    expect(inventory).toMatchObject({ format: "jpeg", complete: true });
    expect(inventory.segments).toEqual(expect.arrayContaining([
      expect.objectContaining({ carrier: "icc-profile", segment: "JPEG APP2 ICC" }),
    ]));
    expect(inventory.bytesTotal).toBeGreaterThan(decoded.icc!.byteLength);
    expect(describeMetadataIt(inventory)).not.toContain("Nessun segmento");
  });

  it("retains unverified private APP15 data in the inventory of a genuine decodable JPEG", async () => {
    const clean = await jpeg();
    const sentinel = new TextEncoder().encode("PRIVATE_GPS_XMP_NESTED_THUMBNAIL_394");
    const source = addAppMarker(clean, 0xef, sentinel);
    expect(await sharp(source).raw().toBuffer()).toEqual(await sharp(clean).raw().toBuffer());
    if (pillowAvailable) expect(pillowInspect(source)).toMatchObject({ width: 2, height: 2 });
    expect(Buffer.from(source).includes(Buffer.from(sentinel))).toBe(true);

    const inventory = scanImageMetadata(source);
    expect(inventory).toMatchObject({
      format: "jpeg", complete: true, privacySegmentCount: 1, privacyBytes: sentinel.length + 4,
    });
    expect(inventory.segments).toEqual([
      expect.objectContaining({ carrier: "ancillary", segment: "JPEG APP15", bytes: sentinel.length + 4 }),
    ]);
    expect(describeMetadataIt(inventory)).not.toContain("Nessun segmento");
  });

  it("preserves clean JPEG reporting, bounded prefix disclosures and cancellation", async () => {
    const source = await jpeg();
    expect(scanImageMetadata(source)).toMatchObject({ complete: true, segments: [], privacySegmentCount: 0 });
    const tooLarge = new Blob([new Uint8Array(source), new Uint8Array(8 * 1024 * 1024)]);
    expect(await scanImageMetadataBlob(tooLarge)).toMatchObject({ format: "jpeg", complete: false });
    const abort = new AbortController();
    abort.abort();
    await expect(scanImageMetadataBlob(new Blob([new Uint8Array(source)]), abort.signal))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
