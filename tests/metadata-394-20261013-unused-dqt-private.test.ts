/** #394: a JPEG may define unused quantization tables that conceal non-pixel bytes. */
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { describeMetadataIt, scanImageMetadata, scanImageMetadataBlob } from "../src/engines/image/metadata";

const privateText = Buffer.from("PRIVATE_GPS_CONTACT_394_DQT", "ascii");

async function cleanJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 12, height: 12, channels: 3, background: "#7c5d31" } }).jpeg().toBuffer();
}

function dqt(table: number, values: Buffer): Buffer {
  expect(values.length).toBe(64);
  return Buffer.concat([Buffer.from([0xff, 0xdb, 0, 0x43, table]), values]);
}

function afterSoi(jpeg: Buffer, inserted: Buffer): Buffer {
  expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  expect([...jpeg.subarray(-2)]).toEqual([0xff, 0xd9]);
  return Buffer.concat([jpeg.subarray(0, 2), inserted, jpeg.subarray(2)]);
}

function pillowRead(jpeg: Buffer): { pixels: string; quantizationIds: number[] } {
  const program = [
    "import io, json, sys",
    "from PIL import Image",
    "with Image.open(io.BytesIO(sys.stdin.buffer.read())) as image:",
    "  image.load()",
    "  print(json.dumps({'pixels': image.convert('RGB').tobytes().hex(), 'quantizationIds': sorted(image.quantization.keys())}))",
  ].join("\n");
  const run = spawnSync("python3", ["-c", program], {
    input: jpeg, encoding: "utf8", timeout: 10_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  expect(run.status, run.stderr).toBe(0);
  return JSON.parse(run.stdout) as { pixels: string; quantizationIds: number[] };
}

/** Remap a real encoder's quantization table 0 to ID 3 in both DQT and SOF. */
function remapUsedTableToThree(jpeg: Buffer): Buffer {
  const bytes = Buffer.from(jpeg);
  let replacedDefinition = false;
  let replacedComponents = 0;
  for (let offset = 2; offset + 4 <= bytes.length;) {
    expect(bytes[offset]).toBe(0xff);
    const marker = bytes[offset + 1]!;
    if (marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    if (marker === 0xdb && !replacedDefinition && (bytes[offset + 4]! & 0x0f) === 0) {
      bytes[offset + 4] = (bytes[offset + 4]! & 0xf0) | 3;
      replacedDefinition = true;
    }
    if (marker === 0xc0) {
      const count = bytes[offset + 9]!;
      for (let component = 0; component < count; component += 1) {
        const selector = offset + 12 + component * 3;
        if (bytes[selector] === 0) { bytes[selector] = 3; replacedComponents += 1; }
      }
    }
    offset += 2 + length;
  }
  expect(replacedDefinition).toBe(true);
  expect(replacedComponents).toBeGreaterThan(0);
  return bytes;
}

describe("#394 unused JPEG DQT source privacy inventory", () => {
  it("warns about an unreferenced legal DQT table carrying private data despite identical Sharp/Pillow pixels", async () => {
    const original = await cleanJpeg();
    const values = Buffer.alloc(64, 1);
    privateText.copy(values);
    const injected = afterSoi(original, dqt(3, values));
    expect(injected.includes(privateText)).toBe(true);
    expect(await sharp(injected).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer());
    const beforePillow = pillowRead(original);
    const afterPillow = pillowRead(injected);
    expect(afterPillow.pixels).toBe(beforePillow.pixels);
    expect(beforePillow.quantizationIds).toEqual([0, 1]);
    expect(afterPillow.quantizationIds).toEqual([0, 1, 3]);

    const inventory = scanImageMetadata(injected);
    expect(inventory).toMatchObject({ format: "jpeg", complete: true, privacySegmentCount: 1, privacyBytes: 69 });
    expect(inventory.segments).toEqual([
      expect.objectContaining({ carrier: "ancillary", segment: "JPEG DQT unreferenced", bytes: 69 }),
    ]);
    expect(describeMetadataIt(inventory)).not.toContain("Nessun segmento di metadati");
    expect(await scanImageMetadataBlob(new Blob([new Uint8Array(injected)]))).toEqual(inventory);
  });

  it("keeps ordinarily referenced DQT tables neutral, including real JPEGs that use table ID 3", async () => {
    const original = await cleanJpeg();
    const mapped = remapUsedTableToThree(original);
    expect(await sharp(mapped).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer());
    const beforePillow = pillowRead(original);
    const afterPillow = pillowRead(mapped);
    expect(afterPillow.pixels).toBe(beforePillow.pixels);
    expect(afterPillow.quantizationIds).toEqual([1, 3]);
    for (const image of [original, mapped]) {
      expect(scanImageMetadata(image)).toMatchObject({ complete: true, privacySegmentCount: 0, segments: [] });
    }
  });

  it("reports a mixed DQT segment conservatively once when it also defines an unused table", async () => {
    const original = await cleanJpeg();
    const unusedValues = Buffer.alloc(64, 1);
    privateText.copy(unusedValues);
    const usedValues = Buffer.alloc(64, 1);
    const unused = dqt(3, unusedValues);
    const mixed = Buffer.concat([unused.subarray(0, 2), Buffer.from([0, 0x84, 0]), usedValues, unused.subarray(4)]);
    const injected = afterSoi(original, mixed);
    expect(await sharp(injected).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer());
    expect(pillowRead(injected).pixels).toBe(pillowRead(original).pixels);
    expect(scanImageMetadata(injected)).toMatchObject({ complete: true, privacySegmentCount: 1 });
    expect(scanImageMetadata(injected).segments).toEqual([
      expect.objectContaining({ carrier: "ancillary", segment: "JPEG DQT unreferenced", bytes: mixed.length }),
    ]);
  });
});
