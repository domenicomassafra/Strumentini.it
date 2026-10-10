import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { quantizePngPalette47 } from "../src/engines/image/png-palette-lossy-47";

const W = 128;
const H = 96;

function sourcePixels(kind: "exact" | "photo" | "alpha" | "many-alpha"): Uint8Array {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = 4 * (y * W + x);
    if (kind === "exact") {
      const color = (x + y) % 4;
      data.set([color * 61, 255 - color * 49, color * 29, color % 2 ? 97 : 255], i);
    } else {
      data.set([(x * 7 + y * 3) & 255, (x * 3 + y * 11) & 255, (x * 13 + y * 5) & 255,
        kind === "alpha" ? (x % 4 === 0 ? 0 : 255) : kind === "many-alpha" ? x : 255], i);
    }
  }
  return data;
}

async function png(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const output = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 0, palette: false }).toBuffer();
  return new Uint8Array(output);
}

function chunkOffset(bytes: Uint8Array, name: string): number | null {
  for (let at = 8; at + 12 <= bytes.length;) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, false);
    const kind = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (kind === name) return at;
    at += size + 12;
  }
  return null;
}

function chunkAt(bytes: Uint8Array, name: string): Uint8Array | null {
  const at = chunkOffset(bytes, name);
  if (at === null) return null;
  const size = new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, false);
  return bytes.slice(at, at + size + 12);
}

function ancillaryTextChunk(): Uint8Array {
  const payload = new TextEncoder().encode("Comment\0private source text");
  const c = new Uint8Array(12 + payload.length);
  new DataView(c.buffer).setUint32(0, payload.length);
  c.set(new TextEncoder().encode("tEXt"), 4);
  c.set(payload, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < c.length - 4; i++) {
    crc ^= c[i]!;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  new DataView(c.buffer).setUint32(c.length - 4, (crc ^ 0xffffffff) >>> 0);
  return c;
}

describe("#047 PNG palette conversion from validated local source pixels", () => {
  it("produces a genuinely indexed pixel-exact transparent PNG (independent Sharp decode)", async () => {
    const source = sourcePixels("exact");
    const input = await png(source);
    const result = await quantizePngPalette47(new Blob([input], { type: "image/png" }), { mode: "exact" });
    const output = Buffer.from(await result.blob.arrayBuffer());
    const info = await sharp(output).metadata();
    expect(info.isPalette).toBe(true);
    expect(info.hasAlpha).toBe(true);
    expect(await sharp(output).ensureAlpha().raw().toBuffer()).toEqual(Buffer.from(source));
    expect(result).toMatchObject({ pixelPolicy: "exact", outputColorType: 3, maxObservedChannelError: 0,
      alphaVerification: "exact", keptOriginal: false, originalBytes: input.length, outputBytes: output.length });
    expect(result.savedBytes).toBe(input.length - output.length);
    expect(output.length).toBeLessThan(input.length);
    const sourcePhys = chunkAt(input, "pHYs");
    if (sourcePhys) expect(Array.from(chunkAt(output, "pHYs") ?? [])).toEqual(Array.from(sourcePhys));
  });

  it("reports an actual bounded RGB error while keeping binary transparency byte-exact", async () => {
    const source = sourcePixels("alpha");
    const input = await png(source);
    const result = await quantizePngPalette47(new Blob([input], { type: "image/png" }), { mode: "lossy" });
    const output = Buffer.from(await result.blob.arrayBuffer());
    const pixels = await sharp(output).ensureAlpha().raw().toBuffer();
    expect((await sharp(output).metadata()).isPalette).toBe(true);
    expect(result).toMatchObject({ pixelPolicy: "lossy-rgb", alphaVerification: "exact", outputColorType: 3, keptOriginal: false });
    let observed = 0;
    for (let i = 0; i < source.length; i += 4) {
      expect(pixels[i + 3]).toBe(source[i + 3]);
      for (let channel = 0; channel < 3; channel++) {
        const error = Math.abs(pixels[i + channel]! - source[i + channel]!);
        observed = Math.max(observed, error);
        expect(error).toBeLessThanOrEqual(32);
      }
    }
    expect(result.maxObservedChannelError).toBe(observed);
    expect(output.length).toBeLessThan(input.length);
  });

  it("refuses exact conversion when >256 distinct RGBA colors are needed", async () => {
    await expect(quantizePngPalette47(new Blob([await png(sourcePixels("photo"))]), { mode: "exact" }))
      .rejects.toThrow(/PNG_PALETTE_47_PALETTE_LIMIT/);
  });

  it("refuses transparency that cannot be represented without alpha changes, and rejects corruption", async () => {
    await expect(quantizePngPalette47(new Blob([await png(sourcePixels("many-alpha"))]), { mode: "lossy" }))
      .rejects.toThrow(/PNG_PALETTE_47_PALETTE_LIMIT/);
    const broken = await png(sourcePixels("exact"));
    broken[20] = broken[20]! ^ 1; // mutate IHDR width without changing chunk layout
    await expect(quantizePngPalette47(new Blob([broken]), { mode: "exact" })).rejects.toThrow(/PNG_47_INVALID_CRC/);
    const cancel = new AbortController(); cancel.abort();
    await expect(quantizePngPalette47(new Blob([await png(sourcePixels("exact"))]),
      { mode: "exact", signal: cancel.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("fails closed on ancillary text rather than silently dropping metadata", async () => {
    const input = await png(sourcePixels("exact"));
    const beforeIdat = chunkOffset(input, "IDAT");
    expect(beforeIdat).not.toBeNull();
    const inserted = ancillaryTextChunk();
    const output = new Uint8Array(input.length + inserted.length);
    output.set(input.subarray(0, beforeIdat!));
    output.set(inserted, beforeIdat!);
    output.set(input.subarray(beforeIdat!), beforeIdat! + inserted.length);
    await expect(quantizePngPalette47(new Blob([output]), { mode: "lossy" }))
      .rejects.toThrow(/PNG_PALETTE_47_METADATA_UNSUPPORTED/);
  });

  it("keeps compact source bytes unmodified when palette packaging would cost more", async () => {
    const input = await sharp(new Uint8Array([12, 42, 82, 255]), {
      raw: { width: 1, height: 1, channels: 4 },
    }).png({ palette: false }).toBuffer();
    const result = await quantizePngPalette47(new Blob([new Uint8Array(input)]), { mode: "exact" });
    expect(result.keptOriginal).toBe(true);
    expect(result.outputColorType).toBe(6);
    expect(Buffer.from(await result.blob.arrayBuffer())).toEqual(input);
    expect(result.savedBytes).toBe(0);
  });
});
