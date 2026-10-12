import { ImageResizeError } from "./policy";

export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

export interface ImageHeader {
  mime: SupportedImageMime;
  width: number;
  height: number;
}

function ensure(bytes: Uint8Array, offset: number, length: number) {
  if (offset < 0 || offset + length > bytes.length) {
    throw new ImageResizeError("TRUNCATED_IMAGE", "Image header is truncated");
  }
}

function be16(bytes: Uint8Array, offset: number): number {
  ensure(bytes, offset, 2);
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function be32(bytes: Uint8Array, offset: number): number {
  ensure(bytes, offset, 4);
  return (
    (bytes[offset]! * 0x1000000) +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  ) >>> 0;
}

function le16(bytes: Uint8Array, offset: number): number {
  ensure(bytes, offset, 2);
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  ensure(bytes, offset, text.length);
  return [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function parsePng(bytes: Uint8Array): ImageHeader | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < signature.length || !signature.every((value, index) => bytes[index] === value)) return null;
  ensure(bytes, 8, 16);
  if (!ascii(bytes, 12, "IHDR")) throw new ImageResizeError("CORRUPT_IMAGE", "PNG is missing IHDR");
  const width = be32(bytes, 16);
  const height = be32(bytes, 20);
  if (width === 0 || height === 0) throw new ImageResizeError("CORRUPT_IMAGE", "PNG has invalid dimensions");
  return { mime: "image/png", width, height };
}

/** Read only the TIFF orientation in a bounded JPEG APP1 Exif segment.
 * Unknown/malformed metadata is not authority for rotating any pixels.
 * 5..8 swap displayed axes (including mirrored diagonal orientations).
 */
function jpegExifOrientation(bytes: Uint8Array, start: number, end: number): number | null {
  if (end - start < 14 || !ascii(bytes, start, "Exif\0\0")) return null;
  const tiff = start + 6;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!little && !big) return null;
  const read16 = (at: number): number => little
    ? bytes[at]! | (bytes[at + 1]! << 8)
    : (bytes[at]! << 8) | bytes[at + 1]!;
  const read32 = (at: number): number => little
    ? (bytes[at]! + bytes[at + 1]! * 0x100 + bytes[at + 2]! * 0x10000 + bytes[at + 3]! * 0x1000000) >>> 0
    : be32(bytes, at);
  if (read16(tiff + 2) !== 42) return null;
  const firstIfd = tiff + read32(tiff + 4);
  if (firstIfd < tiff + 8 || firstIfd > end - 2) return null;
  const entries = read16(firstIfd);
  if (entries > Math.floor((end - firstIfd - 2) / 12)) return null;
  for (let n = 0; n < entries; n += 1) {
    const at = firstIfd + 2 + n * 12;
    if (read16(at) !== 0x0112) continue;
    // TIFF tag 0x0112: SHORT (3), count 1; its value is inline, not a pointer.
    if (read16(at + 2) !== 3 || read32(at + 4) !== 1) return null;
    const orientation = read16(at + 8);
    return orientation >= 1 && orientation <= 8 ? orientation : null;
  }
  return null;
}

function parseJpeg(bytes: Uint8Array): ImageHeader | null {
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  let offset = 2;
  let orientation: number | null = null;
  let codedDimensions: { width: number; height: number } | null = null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    ensure(bytes, offset, 1);
    const marker = bytes[offset]!;
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const segmentLength = be16(bytes, offset);
    if (segmentLength < 2) throw new ImageResizeError("CORRUPT_IMAGE", "JPEG segment length is invalid");
    ensure(bytes, offset, segmentLength);
    if (marker === 0xe1) {
      const parsed = jpegExifOrientation(bytes, offset + 2, offset + segmentLength);
      if (parsed !== null) {
        if (orientation !== null && orientation !== parsed) {
          throw new ImageResizeError("CORRUPT_IMAGE", "JPEG has conflicting Exif orientations");
        }
        orientation = parsed;
      }
    }
    if (sofMarkers.has(marker)) {
      if (segmentLength < 7) throw new ImageResizeError("CORRUPT_IMAGE", "JPEG SOF length is invalid");
      ensure(bytes, offset, 7);
      const height = be16(bytes, offset + 3);
      const width = be16(bytes, offset + 5);
      if (width === 0 || height === 0) throw new ImageResizeError("CORRUPT_IMAGE", "JPEG has invalid dimensions");
      if (codedDimensions !== null && (width !== codedDimensions.width || height !== codedDimensions.height)) {
        throw new ImageResizeError("CORRUPT_IMAGE", "JPEG has conflicting frame dimensions");
      }
      codedDimensions = { width, height };
    }
    offset += segmentLength;
  }
  if (codedDimensions === null) throw new ImageResizeError("CORRUPT_IMAGE", "JPEG dimensions were not found");
  return orientation !== null && orientation >= 5
    ? { mime: "image/jpeg", width: codedDimensions.height, height: codedDimensions.width }
    : { mime: "image/jpeg", ...codedDimensions };
}

function parseWebp(bytes: Uint8Array): ImageHeader | null {
  if (bytes.length < 12 || !ascii(bytes, 0, "RIFF") || !ascii(bytes, 8, "WEBP")) return null;
  ensure(bytes, 12, 8);
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === "VP8X") {
    ensure(bytes, 24, 6);
    const width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
    const height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
    return { mime: "image/webp", width, height };
  }
  if (chunk === "VP8 ") {
    ensure(bytes, 20, 10);
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      throw new ImageResizeError("CORRUPT_IMAGE", "WebP VP8 frame header is invalid");
    }
    return {
      mime: "image/webp",
      width: le16(bytes, 26) & 0x3fff,
      height: le16(bytes, 28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    ensure(bytes, 20, 5);
    if (bytes[20] !== 0x2f) throw new ImageResizeError("CORRUPT_IMAGE", "WebP VP8L signature is invalid");
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    return {
      mime: "image/webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  throw new ImageResizeError("UNSUPPORTED_TYPE", `Unsupported WebP chunk ${chunk}`);
}

export function inspectImageHeader(bytes: Uint8Array): ImageHeader {
  const parsed = parsePng(bytes) ?? parseJpeg(bytes) ?? parseWebp(bytes);
  if (parsed === null) {
    throw new ImageResizeError("UNSUPPORTED_TYPE", "Only JPEG, PNG, and WebP input is supported");
  }
  return parsed;
}

export function signatureMatches(bytes: Uint8Array, mime: "image/jpeg" | "image/webp"): boolean {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP");
}
