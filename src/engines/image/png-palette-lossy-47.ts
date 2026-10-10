/**
 * #047 bounded PNG palette encoder, deliberately separate from the existing
 * byte-preserving lossless IDAT compressor. This changes PNG color encoding.
 *
 * Scope: strict 8-bit RGB/RGBA, noninterlaced PNG with no color metadata.
 * pHYs resolution survives byte-for-byte; profiles, EXIF and text are refused.
 * Exact mode requires <=256 unique RGBA colors. Lossy mode quantizes only RGB
 * using explicit small bins and preserves every source alpha byte exactly.
 * PNG palette/tRNS output is parsed and re-inflated before it is returned.
 */
import { unzlibSync, zlibSync } from "fflate";
import { compressPngLossless47 } from "./png-lossless-47";

const MAGIC = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PIXELS = 1_000_000;
const MAX_BYTES = 4 * 1024 * 1024;

export type PngPaletteMode47 = "exact" | "lossy";

export interface PngPaletteOptions47 {
  readonly mode: PngPaletteMode47;
  readonly signal?: AbortSignal;
}

export interface PngPaletteResult47 {
  readonly blob: Blob;
  readonly mode: PngPaletteMode47;
  readonly width: number;
  readonly height: number;
  readonly originalBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly savedPercent: number;
  readonly keptOriginal: boolean;
  readonly paletteColors: number;
  readonly sourceColorType: 2 | 6;
  readonly outputColorType: 2 | 3 | 6;
  readonly pixelPolicy: "exact" | "lossy-rgb" | "original-unmodified";
  readonly maxObservedChannelError: number;
  readonly alphaVerification: "exact";
  readonly note: string;
}

function fail(code: string, message: string): never {
  throw new Error(`PNG_PALETTE_47_${code}: ${message}`);
}

function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("PNG palette compression cancelled", "AbortError");
}

function u32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name: string, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(payload.length + 12);
  new DataView(bytes.buffer).setUint32(0, payload.length, false);
  for (let i = 0; i < 4; i++) bytes[4 + i] = name.charCodeAt(i);
  bytes.set(payload, 8);
  new DataView(bytes.buffer).setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)), false);
  return bytes;
}

interface StrictRgbPng {
  readonly width: number;
  readonly height: number;
  readonly colorType: 2 | 6;
  readonly idat: Uint8Array;
  readonly preservedChunks: readonly Uint8Array[];
}

/** Caller has first passed the complete CRC/zlib/chunk policy in png-lossless-47. */
function parseStrictRgb(bytes: Uint8Array, width: number, height: number, colorType: number): StrictRgbPng {
  if ((colorType !== 2 && colorType !== 6) || bytes[24] !== 8) {
    fail("UNSUPPORTED_VARIANT", "Palette converter supports only 8-bit RGB/RGBA source pixels");
  }
  const data: Uint8Array[] = [];
  const preservedChunks: Uint8Array[] = [];
  let size = 0;
  let encounteredIdat = false;
  let encounteredPhys = false;
  for (let offset = 8; offset < bytes.length;) {
    const n = u32(bytes, offset);
    const name = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (name === "IDAT") {
      encounteredIdat = true;
      data.push(bytes.subarray(offset + 8, offset + 8 + n));
      size += n;
    } else if (name === "pHYs") {
      if (encounteredIdat || encounteredPhys || n !== 9 || bytes[offset + 16]! > 1) {
        fail("METADATA_UNSUPPORTED", "Invalid or relocated PNG pixel density chunk");
      }
      encounteredPhys = true;
      // Pixel density is independent of the palette; retain it byte-exact.
      preservedChunks.push(bytes.slice(offset, offset + n + 12));
    } else if (name !== "IHDR" && name !== "IEND") {
      fail("METADATA_UNSUPPORTED", `Refusing to discard or reinterpret PNG chunk ${name}`);
    }
    offset += n + 12;
  }
  const idat = new Uint8Array(size);
  let at = 0;
  for (const part of data) { idat.set(part, at); at += part.length; }
  return { width, height, colorType, idat, preservedChunks };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const da = Math.abs(p - a);
  const db = Math.abs(p - b);
  const dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
}

function rawPixels(source: StrictRgbPng, signal?: AbortSignal): Uint8Array {
  const { width, height, colorType } = source;
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  // compressPngLossless47 already proved the zlib stream's exact decoded size
  // with its bounded streaming inflater. This second decode is bounded by it.
  const filtered = unzlibSync(source.idat);
  if (filtered.length !== height * (stride + 1)) fail("DECODE_MISMATCH", "PNG raw row size changed");
  const pixels = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  let at = 0;
  for (let y = 0; y < height; y++) {
    if ((y & 31) === 0) check(signal);
    const filter = filtered[at++]!;
    const row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels]! : 0;
      const above = previous[i]!;
      const corner = i >= channels ? previous[i - channels]! : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above :
        filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, corner);
      row[i] = (filtered[at++]! + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      pixels[dst] = row[src]!;
      pixels[dst + 1] = row[src + 1]!;
      pixels[dst + 2] = row[src + 2]!;
      pixels[dst + 3] = channels === 4 ? row[src + 3]! : 255;
    }
    previous = row;
  }
  return pixels;
}

function quantized(value: number, shift: number): number {
  return Math.min(255, ((value >> shift) << shift) + (1 << (shift - 1)));
}

function rgbaKey(r: number, g: number, b: number, a: number): number {
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

function rgbaFromKey(key: number): readonly [number, number, number, number] {
  return [(key >>> 16) & 255, (key >>> 8) & 255, key & 255, key >>> 24];
}

/**
 * Force exact alpha, including partial alpha values, even in lossy RGB mode.
 * If alpha variety cannot fit the bounded palette, reject without flattening.
 */
export async function quantizePngPalette47(input: Blob, options: PngPaletteOptions47): Promise<PngPaletteResult47> {
  check(options?.signal);
  if (!options || (options.mode !== "exact" && options.mode !== "lossy")) fail("INVALID_MODE", "Select exact or lossy RGB palette conversion");
  if (!(input instanceof Blob) || input.size < 57 || input.size > MAX_BYTES ||
      (input.type !== "" && input.type !== "image/png")) fail("INVALID_INPUT", "A PNG file no larger than 4 MiB is required");
  // Reuse the existing strict PNG parser and bounded zlib inflation as the
  // security gate before interpreting any pixels or allocating decoded memory.
  const validated = await compressPngLossless47(input, options.signal);
  check(options.signal);
  if (validated.width * validated.height > MAX_PIXELS) fail("PIXEL_LIMIT", "One million pixel limit");
  const inputBytes = new Uint8Array(await input.arrayBuffer());
  const source = parseStrictRgb(inputBytes, validated.width, validated.height, validated.colorType);
  const pixels = rawPixels(source, options.signal);
  const alphaValues = new Set<number>();
  for (let i = 3; i < pixels.length; i += 4) alphaValues.add(pixels[i]!);
  if (options.mode === "lossy" && alphaValues.size > 4) {
    fail("PALETTE_LIMIT", "More than four distinct alpha values require separate lossless alpha-preserving palette handling");
  }
  // Opaque images have 8×8×4=256 quantized RGB buckets. Two–four alpha
  // values use 4×4×4=64 buckets/alpha, avoiding silent alpha loss.
  const shifts: readonly [number, number, number] = alphaValues.size <= 1 ? [5, 5, 6] : [6, 6, 6];
  const palette: number[] = [];
  const indexByColor = new Map<number, number>();
  const indices = new Uint8Array(validated.width * validated.height);
  let maxError = 0;
  for (let i = 0; i < indices.length; i++) {
    if ((i & 8191) === 0) check(options.signal);
    const offset = 4 * i;
    const a = pixels[offset + 3]!;
    const r = pixels[offset]!;
    const g = pixels[offset + 1]!;
    const b = pixels[offset + 2]!;
    const rr = options.mode === "exact" ? r : quantized(r, shifts[0]);
    const gg = options.mode === "exact" ? g : quantized(g, shifts[1]);
    const bb = options.mode === "exact" ? b : quantized(b, shifts[2]);
    const key = rgbaKey(rr, gg, bb, a);
    let index = indexByColor.get(key);
    if (index === undefined) {
      if (palette.length === 256) fail("PALETTE_LIMIT", "Image cannot fit 256 colors while preserving source alpha");
      index = palette.length;
      palette.push(key);
      indexByColor.set(key, index);
    }
    indices[i] = index;
    maxError = Math.max(maxError, Math.abs(r - rr), Math.abs(g - gg), Math.abs(b - bb));
  }
  const paletteRgb = new Uint8Array(palette.length * 3);
  let lastTransparent = -1;
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b, a] = rgbaFromKey(palette[i]!);
    paletteRgb.set([r, g, b], i * 3);
    if (a !== 255) lastTransparent = i;
  }
  const transparency = lastTransparent >= 0 ? new Uint8Array(lastTransparent + 1).fill(255) : null;
  if (transparency) for (let i = 0; i < transparency.length; i++) transparency[i] = palette[i]! >>> 24;
  const raw = new Uint8Array((validated.width + 1) * validated.height);
  for (let y = 0; y < validated.height; y++) {
    // All rows have PNG filter 0; palette indices are one byte each.
    raw.set(indices.subarray(y * validated.width, (y + 1) * validated.width), y * (validated.width + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, validated.width);
  view.setUint32(4, validated.height);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const pieces = [MAGIC, chunk("IHDR", ihdr), ...source.preservedChunks, chunk("PLTE", paletteRgb)];
  if (transparency) pieces.push(chunk("tRNS", transparency));
  const compressed = zlibSync(raw, { level: 9 });
  pieces.push(chunk("IDAT", compressed), chunk("IEND", new Uint8Array()));
  const size = pieces.reduce((sum, part) => sum + part.length, 0);
  const candidate = new Uint8Array(size);
  let position = 0;
  for (const part of pieces) { candidate.set(part, position); position += part.length; }
  check(options.signal);
  if (candidate.length < input.size) {
    // Independently validate the *emitted* indexed PNG's structure, CRCs,
    // palette/tRNS constraints and bounded IDAT zlib stream.
    const checked = await compressPngLossless47(new Blob([candidate], { type: "image/png" }), options.signal);
    if (checked.colorType !== 3 || checked.width !== validated.width || checked.height !== validated.height) {
      fail("VERIFICATION", "Indexed output validation changed color model or dimensions");
    }
    const decoded = unzlibSync(compressed);
    if (decoded.length !== raw.length || decoded.some((byte, i) => byte !== raw[i])) {
      fail("VERIFICATION", "Reinflated indexed pixels differ from constructed rows");
    }
    for (let i = 0; i < indices.length; i++) {
      if ((i & 8191) === 0) check(options.signal);
      const [r, g, b, a] = rgbaFromKey(palette[indices[i]!]!);
      const offset = i * 4;
      if (a !== pixels[offset + 3] || Math.abs(r - pixels[offset]!) > 32 ||
          Math.abs(g - pixels[offset + 1]!) > 32 || Math.abs(b - pixels[offset + 2]!) > 32) {
        fail("VERIFICATION", "Pixel or alpha semantic mismatch");
      }
    }
  }
  const keptOriginal = candidate.length >= input.size;
  const output = keptOriginal ? inputBytes : candidate;
  const savedBytes = input.size - output.length;
  return {
    blob: new Blob([output], { type: "image/png" }), mode: options.mode,
    width: validated.width, height: validated.height,
    originalBytes: input.size, outputBytes: output.length, savedBytes,
    savedPercent: Number((100 * savedBytes / input.size).toFixed(2)),
    keptOriginal, paletteColors: keptOriginal ? 0 : palette.length,
    sourceColorType: source.colorType, outputColorType: keptOriginal ? source.colorType : 3,
    pixelPolicy: keptOriginal ? "original-unmodified" : options.mode === "exact" ? "exact" : "lossy-rgb",
    maxObservedChannelError: keptOriginal ? 0 : maxError,
    alphaVerification: "exact",
    note: "Local 8-bit RGB/RGBA PNG palette encoding. Pixel density pHYs is preserved; color profiles, EXIF and text are refused. Exact mode requires <=256 RGBA colors. Lossy mode uses bounded RGB bins (maximum 32/255 channel difference), never quantizes alpha, refuses unsafe alpha variety, and retains original when an indexed PNG would grow.",
  };
}
