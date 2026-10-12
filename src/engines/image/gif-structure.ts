import { IMAGE_VISUAL_LIMITS, ImageVisualError, abortIfNeeded } from "./visual";

/** Container facts only: this parser never decodes, composites, or writes animated GIF frames. */
export interface GifStructure {
  readonly width: number;
  readonly height: number;
  readonly frameCount: number;
  readonly animated: boolean;
  /** Raw hundredths of a second; actual players may clamp zero/short delays. */
  readonly frameDelaysCentiseconds: readonly number[];
  readonly totalDelayCentiseconds: number;
  readonly transparentFrameCount: number;
  readonly disposalMethods: readonly number[];
}

const MAX_FRAMES = 256;

function invalid(reason: string): never {
  throw new ImageVisualError("INVALID_GIF", `GIF structure is invalid or unsupported: ${reason}`);
}

export function inspectGifStructure(bytes: Uint8Array): GifStructure {
  if (bytes.byteLength > IMAGE_VISUAL_LIMITS.maxFileBytes) invalid("file exceeds the local size limit");
  const header = String.fromCharCode(...bytes.subarray(0, 6));
  if (bytes.length < 14 || (header !== "GIF89a" && header !== "GIF87a")) invalid("missing header or logical screen");

  const short = (index: number): number => (bytes[index] ?? 0) | ((bytes[index + 1] ?? 0) << 8);
  const width = short(6);
  const height = short(8);
  if (width < 1 || height < 1 || width > IMAGE_VISUAL_LIMITS.maxDimension || height > IMAGE_VISUAL_LIMITS.maxDimension) invalid("screen dimensions exceed the local limit");
  const packed = bytes[10]!;
  let offset = 13 + ((packed & 0x80) !== 0 ? 3 * (1 << ((packed & 0x07) + 1)) : 0);
  if (offset > bytes.length) invalid("truncated global palette");

  const skipSubBlocks = (): number => {
    let dataBytes = 0;
    for (;;) {
      if (offset >= bytes.length) invalid("unterminated data sub-blocks");
      const size = bytes[offset++]!;
      if (size === 0) return dataBytes;
      if (offset + size > bytes.length) invalid("truncated data sub-block");
      dataBytes += size;
      offset += size;
    }
  };

  const delays: number[] = [];
  const disposalMethods: number[] = [];
  let transparentFrameCount = 0;
  let delay = 0;
  let disposal = 0;
  let transparent = false;

  while (offset < bytes.length) {
    const marker = bytes[offset++]!;
    if (marker === 0x3b) {
      if (delays.length < 1) invalid("no image frames");
      if (offset !== bytes.length) invalid("unexpected bytes after trailer");
      return {
        width, height, frameCount: delays.length, animated: delays.length > 1,
        frameDelaysCentiseconds: delays, totalDelayCentiseconds: delays.reduce((sum, value) => sum + value, 0),
        transparentFrameCount, disposalMethods,
      };
    }
    if (marker === 0x21) {
      if (offset >= bytes.length) invalid("missing extension label");
      const label = bytes[offset++]!;
      if (label === 0xf9) {
        if (offset + 6 > bytes.length || bytes[offset] !== 4 || bytes[offset + 5] !== 0) invalid("malformed graphic control extension");
        const flags = bytes[offset + 1]!;
        delay = short(offset + 2);
        disposal = (flags >> 2) & 0x07;
        // GIF89a defines disposal methods 0–3. Values 4–7 are reserved;
        // reporting one as an ordinary supported animation is misleading.
        if (disposal > 3) invalid("reserved graphic disposal method");
        transparent = (flags & 1) !== 0;
        offset += 6;
      } else if (label === 0x01) {
        // Plain text is itself a graphic-rendering block. Its fixed 12-byte
        // header and data consume a pending Graphic Control Extension, even
        // when it is followed by a separate image descriptor (GIF89a §12/25).
        if (offset + 13 > bytes.length || bytes[offset] !== 12) invalid("malformed plain-text extension");
        offset += 13;
        skipSubBlocks();
        delay = 0;
        disposal = 0;
        transparent = false;
      } else {
        skipSubBlocks();
      }
      continue;
    }
    if (marker !== 0x2c) invalid("unknown block marker");
    if (offset + 9 > bytes.length) invalid("truncated image descriptor");
    const x = short(offset);
    const y = short(offset + 2);
    const frameWidth = short(offset + 4);
    const frameHeight = short(offset + 6);
    const imagePacked = bytes[offset + 8]!;
    if (frameWidth < 1 || frameHeight < 1 || x + frameWidth > width || y + frameHeight > height) invalid("frame outside logical screen");
    offset += 9;
    if ((imagePacked & 0x80) !== 0) offset += 3 * (1 << ((imagePacked & 0x07) + 1));
    if (offset >= bytes.length || (bytes[offset] ?? 0) < 2 || (bytes[offset] ?? 0) > 8) invalid("missing palette or invalid LZW code size");
    offset++;
    // An image with no compressed data cannot contain even its LZW clear/end
    // codes; it is not a valid animated frame regardless of the descriptors.
    if (skipSubBlocks() === 0) invalid("image frame has no compressed pixel data");
    if (delays.length === MAX_FRAMES) invalid(`more than ${MAX_FRAMES} frames`);
    delays.push(delay);
    disposalMethods.push(disposal);
    if (transparent) transparentFrameCount++;
    delay = 0;
    disposal = 0;
    transparent = false;
  }
  return invalid("missing trailer");
}

export async function inspectGifBlob(blob: Blob, signal?: AbortSignal): Promise<GifStructure> {
  abortIfNeeded(signal);
  if (blob.size > IMAGE_VISUAL_LIMITS.maxFileBytes) invalid("file exceeds the local size limit");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  abortIfNeeded(signal);
  return inspectGifStructure(bytes);
}
