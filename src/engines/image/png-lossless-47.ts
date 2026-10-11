/** Ticket #047: isolated, bounded PNG IDAT recompression (no pixel transformations).
 *
 * Explicitly refuses interlaced/APNG/unknown critical PNG chunks and all
 * unapproved JPEG/WebP advanced codec settings or SVG optimization (#209/#268).
 * No production route is registered; callers must honour these capability gates.
 */
import { Unzlib, zlibSync } from "fflate";

export const PNG_47_MAX_INPUT_BYTES = 4 * 1024 * 1024;
export const PNG_47_MAX_PIXELS = 1_000_000;
export const PNG_47_MAX_SCANLINE_BYTES = 4 * 1024 * 1024 + 8192;

export type ImageCompressionFormat47 = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export interface ImageCodecCapability47 {
  readonly mode: "verified-png-idat-lossless" | "refused";
  readonly supported: boolean;
  readonly reason: string;
}

export function probeImageCompression47(): Readonly<Record<ImageCompressionFormat47, ImageCodecCapability47>> {
  return {
    "image/png": {
      mode: "verified-png-idat-lossless", supported: true,
      reason: "PNG grayscale/indexed (1,2,4,8 bit) and gray+alpha/RGB/RGBA (8 bit), noninterlaced; exact filtered scanlines and palette/transparency/ancillary chunk preservation; no palette reduction or color changes",
    },
    "image/jpeg": {
      mode: "refused", supported: false,
      reason: "Advanced JPEG format-aware controls refused by #207/#268; existing browser re-encode is not a verified uniform codec contract",
    },
    "image/webp": {
      mode: "refused", supported: false,
      reason: "WebP lossless/effort and alpha controls refused by #207/#268; browser canvas MIME fallback is not sufficient proof",
    },
    "image/svg+xml": {
      mode: "refused", supported: false,
      reason: "SVG optimizer and preview refused by #209/#268; hostile vector content is never parsed, rendered or fetched here",
    },
  };
}

export interface PngLosslessResult47 {
  readonly blob: Blob;
  readonly inputMime: "image/png";
  readonly outputMime: "image/png";
  readonly width: number;
  readonly height: number;
  readonly hasAlphaChannel: boolean;
  /** PNG color type as stored in the IHDR; indexed tRNS does not add a color channel. */
  readonly colorType: 0 | 2 | 3 | 4 | 6;
  readonly bitDepth: 1 | 2 | 4 | 8;
  /** Explicit tRNS chunk, distinct from a native PNG alpha channel. */
  readonly hasTrnsChunk: boolean;
  readonly originalBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly savedPercent: number;
  readonly keptOriginal: boolean;
  readonly pixelVerification: "exact-filtered-scanlines";
  readonly note: string;
}

interface Chunk {
  readonly name: string;
  readonly start: number;
  readonly length: number;
  readonly payloadStart: number;
  readonly end: number;
}

interface PngParts {
  readonly width: number;
  readonly height: number;
  readonly hasAlphaChannel: boolean;
  readonly colorType: 0 | 2 | 3 | 4 | 6;
  readonly bitDepth: 1 | 2 | 4 | 8;
  readonly hasTrnsChunk: boolean;
  readonly chunks: readonly Chunk[];
  readonly idat: Uint8Array;
  readonly expectedScanlineBytes: number;
}

const MAGIC = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const encoder = new TextEncoder();

function fail(code: string, detail: string): never {
  throw new Error(`PNG_47_${code}: ${detail}`);
}

function running(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Image compression cancelled", "AbortError");
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function crc32(bytes: Uint8Array, from = 0, to = bytes.length): number {
  let crc = 0xffffffff;
  for (let index = from; index < to; index++) {
    crc ^= bytes[index]!;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array, signal?: AbortSignal): number {
  let a = 1;
  let b = 0;
  // Accumulate in modest blocks to bound intermediate sums and cancellation
  // latency for the verified (at most ~4 MiB) decoded PNG scanline buffer.
  for (let start = 0; start < bytes.length; start += 5552) {
    running(signal);
    const end = Math.min(start + 5552, bytes.length);
    for (let i = start; i < end; i++) {
      a += bytes[i]!;
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function parsePng47(bytes: Uint8Array, signal?: AbortSignal): PngParts {
  running(signal);
  if (bytes.length < 57 || bytes.length > PNG_47_MAX_INPUT_BYTES ||
      !MAGIC.every((byte, i) => bytes[i] === byte)) {
    fail("INPUT_LIMIT", "Expected a PNG file of 57 bytes–4 MiB with a valid signature");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Chunk[] = [];
  const idatSlices: Uint8Array[] = [];
  let seenIHDR = false;
  let seenIDAT = false;
  let endedIDAT = false;
  let seenIEND = false;
  let width = 0;
  let height = 0;
  let hasAlphaChannel = false;
  let colorType: 0 | 2 | 3 | 4 | 6 = 2;
  let bitDepth: 1 | 2 | 4 | 8 = 8;
  let paletteColors = 0;
  let seenPalette = false;
  let hasTrnsChunk = false;
  let expectedScanlineBytes = 0;
  let idatBytes = 0;

  for (let offset = 8; offset < bytes.length;) {
    running(signal);
    if (offset + 12 > bytes.length) fail("MALFORMED", "Truncated PNG chunk");
    const length = u32(view, offset);
    const end = offset + 12 + length;
    if (!Number.isSafeInteger(end) || end > bytes.length) fail("MALFORMED", "Chunk exceeds PNG file");
    const nameBytes = bytes.subarray(offset + 4, offset + 8);
    if (!nameBytes.every((n) => (n >= 65 && n <= 90) || (n >= 97 && n <= 122))) {
      fail("MALFORMED", "Invalid chunk type");
    }
    const name = String.fromCharCode(...nameBytes);
    if ((nameBytes[2]! & 32) !== 0) fail("MALFORMED", "Chunk type reserved bit set");
    if (crc32(bytes, offset + 4, end - 4) !== u32(view, end - 4)) {
      fail("INVALID_CRC", `Chunk ${name} has a broken CRC`);
    }
    if (!seenIHDR && (name !== "IHDR" || length !== 13)) {
      fail("MALFORMED", "IHDR must be first and exactly 13 bytes");
    }
    if (seenIEND) fail("MALFORMED", "Data after IEND");
    if (name === "IHDR") {
      if (seenIHDR || length !== 13) fail("MALFORMED", "Duplicate or invalid IHDR");
      seenIHDR = true;
      width = u32(view, offset + 8);
      height = u32(view, offset + 12);
      const depth = bytes[offset + 16]!;
      const color = bytes[offset + 17]!;
      const compression = bytes[offset + 18]!;
      const filter = bytes[offset + 19]!;
      const interlace = bytes[offset + 20]!;
      if (width < 1 || height < 1 || width * height > PNG_47_MAX_PIXELS || width > 8192 || height > 8192) {
        fail("PIXEL_LIMIT", "PNG dimensions exceed local 1-million-pixel ceiling");
      }
      const channels = color === 0 || color === 3 ? 1 : color === 4 ? 2 : color === 2 ? 3 : color === 6 ? 4 : 0;
      if (channels === 0 || ![1, 2, 4, 8].includes(depth) ||
          ((color === 2 || color === 4 || color === 6) && depth !== 8) ||
          compression !== 0 || filter !== 0 || interlace !== 0) {
        fail("UNSUPPORTED_VARIANT", "Only noninterlaced grayscale/indexed <=8bit and 8-bit RGB/RGBA/grayscale+alpha PNG are supported");
      }
      colorType = color as 0 | 2 | 3 | 4 | 6;
      bitDepth = depth as 1 | 2 | 4 | 8;
      hasAlphaChannel = color === 4 || color === 6;
      expectedScanlineBytes = height * (1 + Math.ceil(width * channels * depth / 8));
      if (expectedScanlineBytes > PNG_47_MAX_SCANLINE_BYTES) fail("PIXEL_LIMIT", "Decoded scanline buffer too large");
    } else if (name === "IDAT") {
      if (colorType === 3 && !seenPalette) fail("MALFORMED", "Indexed PNG requires a palette before IDAT");
      if (endedIDAT) fail("UNSUPPORTED_VARIANT", "Nonconsecutive IDAT chunks are refused");
      seenIDAT = true;
      idatBytes += length;
      if (idatBytes > PNG_47_MAX_INPUT_BYTES) fail("INPUT_LIMIT", "Too much compressed IDAT data");
      idatSlices.push(bytes.subarray(offset + 8, offset + 8 + length));
    } else if (name === "IEND") {
      if (!seenIDAT || length !== 0 || end !== bytes.length) fail("MALFORMED", "IEND must terminate PNG");
      seenIEND = true;
    } else if (name === "tRNS") {
      if (seenIDAT || hasTrnsChunk || colorType === 4 || colorType === 6 ||
          (colorType === 3 && (!seenPalette || length < 1 || length > paletteColors)) ||
          (colorType === 0 && length !== 2) || (colorType === 2 && length !== 6)) {
        fail("MALFORMED", "PNG tRNS transparency chunk invalid for its color model or position");
      }
      hasTrnsChunk = true;
    } else {
      if (name === "acTL" || name === "fcTL" || name === "fdAT") fail("UNSUPPORTED_VARIANT", "APNG animation is not supported");
      if (nameBytes[0]! < 97) {
        if (name !== "PLTE") fail("UNSUPPORTED_VARIANT", `Unknown critical PNG chunk ${name}`);
        // RGB images may have optional suggested palettes, preserved byte-exact.
        if (seenIDAT || length === 0 || length % 3 !== 0 || length > 768) {
          fail("MALFORMED", "Unexpected PLTE location or size");
        }
        if (seenPalette || colorType === 0 || colorType === 4 ||
            (colorType === 3 && length / 3 > 1 << bitDepth)) {
          fail("MALFORMED", "Palette is duplicate, forbidden or larger than indexed bit depth");
        }
        seenPalette = true;
        paletteColors = length / 3;
      }
      if (seenIDAT) endedIDAT = true;
    }
    chunks.push({ name, start: offset, length, payloadStart: offset + 8, end });
    offset = end;
  }
  if (!seenIHDR || !seenIEND || idatBytes < 6) fail("MALFORMED", "Incomplete PNG image");
  const idat = new Uint8Array(idatBytes);
  let at = 0;
  for (const chunk of idatSlices) { idat.set(chunk, at); at += chunk.length; }
  return { width, height, hasAlphaChannel, colorType, bitDepth, hasTrnsChunk,
    chunks, idat, expectedScanlineBytes };
}

function inflateBounded47(compressed: Uint8Array, expected: number, rowBytes: number, height: number, signal?: AbortSignal): Uint8Array {
  running(signal);
  const result = new Uint8Array(expected);
  let written = 0;
  let finished = false;
  try {
    const inflator = new Unzlib((data, final) => {
      running(signal);
      if (written + data.length > expected) fail("INFLATE_LIMIT", "PNG decompressed beyond declared scanline budget");
      result.set(data, written);
      written += data.length;
      if (final) finished = true;
    });
    // Tiny compressed chunks bound expansion from each synchronous streaming call.
    for (let at = 0; at < compressed.length; at += 256) {
      running(signal);
      inflator.push(compressed.subarray(at, Math.min(at + 256, compressed.length)), at + 256 >= compressed.length);
    }
  } catch (error) {
    running(signal);
    if (error instanceof Error && error.message.startsWith("PNG_47_")) throw error;
    fail("INVALID_ZLIB", "IDAT zlib stream could not be decoded");
  }
  if (!finished || written !== expected) fail("MALFORMED", "IDAT bytes do not match PNG scanline dimensions");
  // fflate's streaming Unzlib inflates bytes but does not validate the zlib
  // Adler-32 trailer. The outer PNG chunk CRC can be recomputed by a corrupt
  // producer, so independently validate the decoded IDAT bytes here.
  const trailer = compressed.length - 4;
  const suppliedAdler = ((compressed[trailer]! << 24) | (compressed[trailer + 1]! << 16) |
    (compressed[trailer + 2]! << 8) | compressed[trailer + 3]!) >>> 0;
  if (adler32(result, signal) !== suppliedAdler) {
    fail("INVALID_ZLIB", "PNG IDAT stream has an invalid Adler-32 checksum");
  }
  const stride = 1 + rowBytes;
  for (let row = 0; row < height; row++) {
    if ((row & 127) === 0) running(signal);
    if (result[row * stride]! > 4) fail("MALFORMED", "Invalid PNG scanline filter");
  }
  return result;
}

function idatChunk47(compressed: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + compressed.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, compressed.length, false);
  chunk.set(encoder.encode("IDAT"), 4);
  chunk.set(compressed, 8);
  view.setUint32(chunk.length - 4, crc32(chunk, 4, chunk.length - 4), false);
  return chunk;
}

/**
 * Recompress only IDAT zlib bytes. All non-IDAT chunks (including iCCP, tRNS,
 * eXIf, tEXt and transparency semantics) remain byte-exact in original order.
 * A candidate is accepted only if it shrinks and independently re-inflates to
 * the exact same filtered scanlines. Otherwise original validated bytes win.
 */
export async function compressPngLossless47(input: Blob, signal?: AbortSignal): Promise<PngLosslessResult47> {
  running(signal);
  if (!(input instanceof Blob) || input.size < 57 || input.size > PNG_47_MAX_INPUT_BYTES) {
    fail("INPUT_LIMIT", "PNG input must be 57 bytes–4 MiB");
  }
  const source = new Uint8Array(await input.arrayBuffer());
  running(signal);
  const parsed = parsePng47(source, signal);
  const rowBytes = parsed.expectedScanlineBytes / parsed.height - 1;
  const originalPixels = inflateBounded47(parsed.idat, parsed.expectedScanlineBytes,
    rowBytes, parsed.height, signal);
  running(signal);
  const recompressed = zlibSync(originalPixels, { level: 9 });
  running(signal);
  const newIDAT = idatChunk47(recompressed);
  const originalIDATBytes = parsed.chunks.filter((chunk) => chunk.name === "IDAT").reduce((sum, chunk) => sum + chunk.end - chunk.start, 0);
  let output = source;
  if (newIDAT.length < originalIDATBytes) {
    const candidate = new Uint8Array(source.length - originalIDATBytes + newIDAT.length);
    candidate.set(MAGIC, 0);
    let pointer = 8;
    let emittedIDAT = false;
    for (const chunk of parsed.chunks) {
      running(signal);
      if (chunk.name === "IDAT") {
        if (emittedIDAT) continue;
        candidate.set(newIDAT, pointer); pointer += newIDAT.length; emittedIDAT = true;
      } else {
        candidate.set(source.subarray(chunk.start, chunk.end), pointer);
        pointer += chunk.end - chunk.start;
      }
    }
    if (pointer !== candidate.length) fail("INTERNAL", "Output size does not reconcile");
    const verified = parsePng47(candidate, signal);
    const candidatePixels = inflateBounded47(verified.idat, verified.expectedScanlineBytes,
      rowBytes, verified.height, signal);
    if (candidatePixels.length !== originalPixels.length || candidatePixels.some((byte, i) => byte !== originalPixels[i])) {
      fail("VERIFICATION", "Lossless scanline identity could not be proven");
    }
    output = candidate;
  }
  running(signal);
  const originalBytes = source.length;
  const outputBytes = output.length;
  const savedBytes = originalBytes - outputBytes;
  return {
    blob: new Blob([new Uint8Array(output)], { type: "image/png" }),
    inputMime: "image/png", outputMime: "image/png",
    width: parsed.width, height: parsed.height, hasAlphaChannel: parsed.hasAlphaChannel,
    colorType: parsed.colorType, bitDepth: parsed.bitDepth, hasTrnsChunk: parsed.hasTrnsChunk,
    originalBytes, outputBytes, savedBytes,
    savedPercent: Number((100 * savedBytes / originalBytes).toFixed(2)),
    keptOriginal: output === source, pixelVerification: "exact-filtered-scanlines",
    note: "PNG IDAT lossless recompression only: exact filtered scanlines, indexed palette and tRNS transparency and metadata chunks; no palette reduction, dithering, resampling, chromatic/color-profile transforms, APNG or SVG optimization.",
  };
}
