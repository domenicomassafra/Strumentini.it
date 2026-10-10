/**
 * #212 isolated, bounded first-frame GIF -> RGBA PNG proof.
 * No HEIC codec or AVIF encoder is enabled here; native AVIF decode probe is
 * runtime-specific and never a production approval (feasibility #268).
 */
import { unzlibSync, zlibSync } from "fflate";
import { inspectGifStructure, type GifStructure } from "./gif-structure";

export const GIF_212_MAX_BYTES = 4 * 1024 * 1024;
export const GIF_212_MAX_PIXELS = 1_000_000;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function refuse(code: string, detail: string): never {
  throw new Error("IMAGE_212_" + code + ": " + detail);
}

function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Image conversion cancelled", "AbortError");
}

function ascii(bytes: Uint8Array, at: number, value: string): boolean {
  if (at < 0 || at + value.length > bytes.length) return false;
  return [...value].every((char, i) => bytes[at + i] === char.charCodeAt(0));
}

function u16(bytes: Uint8Array, at: number): number {
  return bytes[at]! | bytes[at + 1]! << 8;
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(size);
  let at = 0;
  for (const part of parts) { merged.set(part, at); at += part.length; }
  return merged;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name: string, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(payload.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, payload.length, false);
  for (let i = 0; i < 4; i++) bytes[4 + i] = name.charCodeAt(i);
  bytes.set(payload, 8);
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)), false);
  return bytes;
}

function pngFromRgba(rgba: Uint8Array, width: number, height: number, signal?: AbortSignal): Uint8Array {
  cancelled(signal);
  const scanlines = new Uint8Array(height * (1 + width * 4));
  for (let row = 0; row < height; row++) {
    if ((row & 127) === 0) cancelled(signal);
    scanlines.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), row * (1 + width * 4) + 1);
  }
  const compressed = zlibSync(scanlines, { level: 6 });
  cancelled(signal);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA, no interlacing.
  const png = concat([PNG_SIGNATURE, pngChunk("IHDR", ihdr), pngChunk("IDAT", compressed), pngChunk("IEND", new Uint8Array())]);
  // Container and raw RGBA scanline proof: do not trust an encoder return value.
  const inflated = unzlibSync(compressed);
  if (inflated.length !== scanlines.length || inflated.some((value, i) => value !== scanlines[i])) {
    refuse("OUTPUT_VERIFICATION_FAILED", "PNG cannot be independently inflated to source RGBA scanlines");
  }
  return png;
}

interface FirstImage {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly palette: Uint8Array;
  readonly transparentIndex: number | null;
  readonly minimumCodeBits: number;
  readonly compressed: Uint8Array;
  readonly interlaced: boolean;
}

function firstFrameData(gif: Uint8Array, width: number, height: number, signal?: AbortSignal): FirstImage {
  const globalEntries = (gif[10]! & 0x80) ? 1 << ((gif[10]! & 7) + 1) : 0;
  const globalBytes = globalEntries * 3;
  if (13 + globalBytes > gif.length) refuse("MALFORMED_GIF", "Truncated global color table");
  const globalPalette = gif.subarray(13, 13 + globalBytes);
  let at = 13 + globalBytes;
  let transparentIndex: number | null = null;
  while (at < gif.length) {
    cancelled(signal);
    const marker = gif[at++]!;
    if (marker === 0x21) {
      const extension = gif[at++]!;
      if (extension === 0xf9) {
        if (at + 6 > gif.length || gif[at] !== 4 || gif[at + 5] !== 0) refuse("MALFORMED_GIF", "Invalid graphic control extension");
        transparentIndex = (gif[at + 1]! & 1) ? gif[at + 4]! : null;
        at += 6;
      } else {
        while (at < gif.length) {
          const count = gif[at++]!;
          if (!count) break;
          at += count;
          if (at > gif.length) refuse("MALFORMED_GIF", "Truncated GIF extension");
        }
      }
      continue;
    }
    if (marker !== 0x2c || at + 9 > gif.length) refuse("MALFORMED_GIF", "Missing first image descriptor");
    const left = u16(gif, at);
    const top = u16(gif, at + 2);
    const frameWidth = u16(gif, at + 4);
    const frameHeight = u16(gif, at + 6);
    const packed = gif[at + 8]!;
    at += 9;
    if (!frameWidth || !frameHeight || left + frameWidth > width || top + frameHeight > height) {
      refuse("UNSUPPORTED_GIF_FRAME", "First GIF frame is outside the logical canvas");
    }
    // Transparent first frames can be composed on a transparent canvas without
    // ambiguity. Opaque partial-frame background rendering varies by decoder;
    // keep those frames explicitly unsupported until its palette policy is proven.
    if ((left !== 0 || top !== 0 || frameWidth !== width || frameHeight !== height) && transparentIndex === null) {
      refuse("UNSUPPORTED_GIF_FRAME", "Opaque partial GIF frames require independently verified background palette compositing");
    }
    const paletteEntries = (packed & 0x80) ? 1 << ((packed & 7) + 1) : 0;
    const paletteSize = paletteEntries * 3;
    if (at + paletteSize > gif.length) refuse("MALFORMED_GIF", "Truncated local palette");
    const palette = paletteSize ? gif.subarray(at, at + paletteSize) : globalPalette;
    at += paletteSize;
    if (palette.length === 0 || (transparentIndex !== null && transparentIndex >= palette.length / 3)) {
      refuse("INVALID_GIF_PALETTE", "Missing color palette or invalid transparency index");
    }
    if (at >= gif.length) refuse("MALFORMED_GIF", "Missing first frame LZW stream");
    const minimumCodeBits = gif[at++]!;
    if (minimumCodeBits < 2 || minimumCodeBits > 8) refuse("INVALID_GIF_LZW", "Unsupported GIF LZW code size");
    const blocks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      if (at >= gif.length) refuse("MALFORMED_GIF", "Unterminated first frame");
      const count = gif[at++]!;
      if (!count) break;
      if (at + count > gif.length) refuse("MALFORMED_GIF", "Truncated first frame LZW block");
      blocks.push(gif.subarray(at, at + count));
      total += count;
      if (total > GIF_212_MAX_BYTES) refuse("GIF_LIMIT", "First frame LZW data exceeds local limit");
      at += count;
    }
    return { left, top, width: frameWidth, height: frameHeight, palette, transparentIndex, minimumCodeBits, compressed: concat(blocks),
      interlaced: (packed & 0x40) !== 0 };
  }
  return refuse("MALFORMED_GIF", "First frame not found");
}

function decodeLzw(frame: FirstImage, signal?: AbortSignal): Uint8Array {
  cancelled(signal);
  const clear = 1 << frame.minimumCodeBits;
  const end = clear + 1;
  const dictionary: Array<Uint8Array | undefined> = new Array(4096);
  let next = end + 1;
  let bits = frame.minimumCodeBits + 1;
  let bitPosition = 0;
  const expected = frame.width * frame.height;
  const result = new Uint8Array(expected);
  let written = 0;
  let previous: Uint8Array | null = null;
  let endFound = false;
  let clearSeen = false;
  let decodedCodes = 0;
  const reset = (): void => {
    dictionary.fill(undefined);
    for (let code = 0; code < clear; code++) dictionary[code] = Uint8Array.of(code);
    next = end + 1;
    bits = frame.minimumCodeBits + 1;
    previous = null;
  };
  while (bitPosition + bits <= frame.compressed.length * 8) {
    if ((decodedCodes++ & 1023) === 0) cancelled(signal);
    let code = 0;
    for (let i = 0; i < bits; i++) {
      const position = bitPosition + i;
      code |= ((frame.compressed[position >>> 3]! >>> (position & 7)) & 1) << i;
    }
    bitPosition += bits;
    if (code === clear) { reset(); clearSeen = true; continue; }
    if (!clearSeen) refuse("INVALID_GIF_LZW", "LZW stream must begin with a clear code");
    if (code === end) { endFound = true; break; }
    let word = code < next ? dictionary[code] : undefined;
    if (word === undefined && code === next && previous !== null) {
      word = new Uint8Array(previous.length + 1);
      word.set(previous);
      word[previous.length] = previous[0]!;
    }
    if (!word || !word.length || written + word.length > expected) {
      refuse("INVALID_GIF_LZW", "Invalid LZW dictionary code or decoded pixels exceed frame");
    }
    result.set(word, written);
    written += word.length;
    if (previous !== null && next < 4096) {
      const extended = new Uint8Array(previous.length + 1);
      extended.set(previous);
      extended[previous.length] = word[0]!;
      dictionary[next++] = extended;
      if (next === (1 << bits) && bits < 12) bits++;
    }
    previous = word;
  }
  if (!endFound || written !== expected) refuse("INVALID_GIF_LZW", "Truncated or incomplete LZW pixel stream");
  if (!frame.interlaced) return result;
  // GIF interlacing transmits rows in four passes. Reorder the actual decoded
  // indices; toggling the interlace bit without reordering is NOT sufficient.
  const rows = new Uint8Array(expected);
  let received = 0;
  for (const [start, stride] of [[0, 8], [4, 8], [2, 4], [1, 2]] as const) {
    for (let y = start; y < frame.height; y += stride) {
      if ((received & 31) === 0) cancelled(signal);
      rows.set(result.subarray(received * frame.width, (received + 1) * frame.width), y * frame.width);
      received++;
    }
  }
  if (received !== frame.height) refuse("INVALID_GIF_LZW", "Interlace row pass count disagrees with frame size");
  return rows;
}

export interface GifFirstFrame212 {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly frameCount: number;
  readonly frameDelaysCentiseconds: readonly number[];
  readonly totalDelayCentiseconds: number;
  readonly transparentFrameCount: number;
  readonly disposalMethods: readonly number[];
  readonly framePolicy: "first-frame-only";
  readonly animationDiscarded: boolean;
  readonly fidelity: "exact-first-frame-rgba-with-transparent-rgb-normalized";
  readonly lossNote: string;
}

/**
 * Retains only GIF frame #0. Calling this with an animated GIF requires the
 * user to explicitly accept animation loss; loop timing is never exported.
 */
export async function gifFirstFrameToPng212(
  source: Blob, options: { readonly allowAnimationLoss?: boolean; readonly signal?: AbortSignal } = {},
): Promise<GifFirstFrame212> {
  cancelled(options.signal);
  if (!(source instanceof Blob) || source.size < 14 || source.size > GIF_212_MAX_BYTES) {
    refuse("GIF_LIMIT", "GIF input must be 14 bytes–4 MiB");
  }
  const bytes = new Uint8Array(await source.arrayBuffer());
  cancelled(options.signal);
  const structure: GifStructure = inspectGifStructure(bytes);
  if (structure.width * structure.height > GIF_212_MAX_PIXELS) {
    refuse("GIF_LIMIT", "Maximum first-frame surface is one million pixels");
  }
  if (structure.animated && options.allowAnimationLoss !== true) {
    refuse("ANIMATION_LOSS_NOT_ACKNOWLEDGED", "Animated GIF requires explicit still-frame export approval");
  }
  const frame = firstFrameData(bytes, structure.width, structure.height, options.signal);
  const indexes = decodeLzw(frame, options.signal);
  const rgba = new Uint8Array(structure.width * structure.height * 4);
  for (let pixel = 0; pixel < indexes.length; pixel++) {
    if ((pixel & 65535) === 0) cancelled(options.signal);
    const index = indexes[pixel]!;
    const color = index * 3;
    if (color + 2 >= frame.palette.length) refuse("INVALID_GIF_PALETTE", "Decoded index outside active GIF color table");
    if (index === frame.transparentIndex) continue; // Canonical transparent black.
    const row = Math.floor(pixel / frame.width);
    const column = pixel % frame.width;
    const target = ((frame.top + row) * structure.width + frame.left + column) * 4;
    rgba[target] = frame.palette[color]!;
    rgba[target + 1] = frame.palette[color + 1]!;
    rgba[target + 2] = frame.palette[color + 2]!;
    rgba[target + 3] = 255;
  }
  const png = pngFromRgba(rgba, structure.width, structure.height, options.signal);
  cancelled(options.signal);
  return {
    png, width: structure.width, height: structure.height,
    inputBytes: bytes.length, outputBytes: png.length,
    frameCount: structure.frameCount,
    frameDelaysCentiseconds: structure.frameDelaysCentiseconds,
    totalDelayCentiseconds: structure.totalDelayCentiseconds,
    transparentFrameCount: structure.transparentFrameCount,
    disposalMethods: structure.disposalMethods,
    framePolicy: "first-frame-only",
    animationDiscarded: structure.animated,
    fidelity: "exact-first-frame-rgba-with-transparent-rgb-normalized",
    lossNote: structure.animated
      ? "Only frame 1 exported; original animation, all delays and loop/disposal behavior are lost. Raw delays are hundredths of a second and players may clamp short delays."
      : "Still GIF frame converted to PNG; transparent RGB canonicalized to 0 (alpha preserved).",
  };
}

export type DirectionalProbe212 = {
  readonly runtimeDecodeSupported: boolean;
  readonly productionApproved: false;
  readonly format: "avif" | "heic";
  readonly reason: string;
  readonly decodedWidth?: number;
  readonly decodedHeight?: number;
};

/**
 * AVIF native decode probe based on the real provided BMFF bytes, not MIME or
 * extension. It verifies only this runtime/fixture; no AVIF encode promise.
 */
export async function probeAvifDecode212(source: Blob, signal?: AbortSignal): Promise<DirectionalProbe212> {
  cancelled(signal);
  if (!(source instanceof Blob) || source.size < 16 || source.size > GIF_212_MAX_BYTES) {
    return { format: "avif", runtimeDecodeSupported: false, productionApproved: false, reason: "AVIF input size is invalid or over 4 MiB" };
  }
  const bytes = new Uint8Array(await source.slice(0, 256).arrayBuffer());
  cancelled(signal);
  const head = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxSize = head.getUint32(0, false);
  const brands: string[] = [];
  if (ascii(bytes, 4, "ftyp") && boxSize >= 16 && boxSize <= source.size && boxSize <= bytes.length && boxSize % 4 === 0) {
    for (let at = 8; at + 4 <= boxSize; at += at === 8 ? 8 : 4) {
      brands.push(String.fromCharCode(...bytes.subarray(at, at + 4)));
    }
  }
  if (brands.includes("avis")) {
    return { format: "avif", runtimeDecodeSupported: false, productionApproved: false, reason: "AVIF image sequence unsupported (animation policy unverified)" };
  }
  if (!brands.includes("avif")) {
    return { format: "avif", runtimeDecodeSupported: false, productionApproved: false, reason: "AVIF ftyp brand unverified; extension/MIME ignored" };
  }
  if (typeof createImageBitmap !== "function") {
    return { format: "avif", runtimeDecodeSupported: false, productionApproved: false, reason: "Native browser createImageBitmap decoder unavailable" };
  }
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    cancelled(signal);
    if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width * bitmap.height > GIF_212_MAX_PIXELS) {
      return { format: "avif", runtimeDecodeSupported: false, productionApproved: false, reason: "Decoded AVIF exceeds bounded surface" };
    }
    return {
      format: "avif", runtimeDecodeSupported: true, productionApproved: false,
      decodedWidth: bitmap.width, decodedHeight: bitmap.height,
      reason: "This local runtime decoded the supplied AVIF fixture only; encode and physical iOS/Android acceptance NOT_RUN",
    };
  } catch (error) {
    cancelled(signal);
    return { format: "avif", runtimeDecodeSupported: false, productionApproved: false, reason: "Native browser AVIF decode failed" };
  } finally {
    bitmap?.close();
  }
}

/** #268: no real iPhone HEIC fixture / physical device certification. */
export function probeHeicDecode212(): DirectionalProbe212 {
  return {
    format: "heic", runtimeDecodeSupported: false, productionApproved: false,
    reason: "HEIC refused: synthetic macOS fixture is not a real iPhone capture; physical iOS/Android evidence NOT_RUN (#268)",
  };
}
