import {
  IMAGE_VISUAL_LIMITS,
  ImageVisualError,
  abortIfNeeded,
  assertPixels,
  type ImageVisualFile,
  type ImageVisualProgress,
} from "./visual";

export type PortableImageKind = "jpeg" | "png" | "webp" | "gif" | "avif" | "heic" | "heif";

export interface PortableImageIdentification {
  readonly kind: PortableImageKind;
  readonly mime: string;
  readonly framePolicy: "single-image" | "first-frame-only";
  readonly decoder: "browser";
}

export interface PortableDecodedImage extends PortableImageIdentification {
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;
}

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset < 0 || offset + text.length > bytes.length) return false;
  return [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function bmffBrands(bytes: Uint8Array): string[] {
  if (bytes.length < 16 || !ascii(bytes, 4, "ftyp")) return [];
  const boxLength = (bytes[0]! * 0x1000000 + bytes[1]! * 0x10000 + bytes[2]! * 0x100 + bytes[3]!) >>> 0;
  // Never silently truncate the compatible-brand list: an unseen 'avis'
  // could make an AVIF sequence look like an ordinary single still image.
  if (boxLength < 16 || boxLength % 4 !== 0 || boxLength > bytes.length) {
    throw new ImageVisualError("UNVERIFIED_BMFF_BRANDS", "Image ftyp brands are incomplete or malformed");
  }
  const brands: string[] = [];
  for (let offset = 8; offset + 4 <= boxLength; offset += offset === 8 ? 8 : 4) {
    brands.push(String.fromCharCode(...bytes.subarray(offset, offset + 4)));
  }
  return brands;
}

export function identifyPortableImage(bytes: Uint8Array, _file?: Pick<ImageVisualFile, "name" | "type">): PortableImageIdentification {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: "jpeg", mime: "image/jpeg", framePolicy: "single-image", decoder: "browser" };
  }
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) {
    return { kind: "png", mime: "image/png", framePolicy: "single-image", decoder: "browser" };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) {
    return { kind: "webp", mime: "image/webp", framePolicy: "single-image", decoder: "browser" };
  }
  if (bytes.length >= 10 && (ascii(bytes, 0, "GIF87a") || ascii(bytes, 0, "GIF89a"))) {
    return { kind: "gif", mime: "image/gif", framePolicy: "first-frame-only", decoder: "browser" };
  }

  const brands = bmffBrands(bytes);
  // AVIF image sequences carry multiple timed frames. The browser may decode
  // frame 1, but this still-only conversion path cannot preserve animation.
  // The isolated #212 AVIF capability probe already refuses this 'avis' brand.
  if (brands.includes("avis")) {
    throw new ImageVisualError("UNSUPPORTED_AVIF_SEQUENCE", "Animated AVIF sequences require an approved animation-preserving converter");
  }
  // HEVC sequence tracks have timing that a single ImageBitmap cannot retain.
  // `msf1` is the codec-agnostic HEIF sequence brand (ISO/IEC 23008-12).
  if (brands.some((brand) => ["hevc", "hevx", "hevm", "hevs", "msf1"].includes(brand))) {
    throw new ImageVisualError("UNSUPPORTED_HEIC_SEQUENCE", "Timed HEIF/HEIC sequences require an approved animation-preserving converter");
  }
  // `mif1`/`msf1` only identify a generic HEIF container; neither proves HEVC.
  // Extension and client-supplied MIME cannot establish an AVIF/HEIC codec.
  const heic = brands.some((brand) => ["heic", "heix", "heim", "heis"].includes(brand));
  if (brands.includes("avif") && heic) {
    throw new ImageVisualError("AMBIGUOUS_HEIF_BRANDS", "Conflicting AVIF and HEIC codec brands cannot be safely converted");
  }
  if (brands.includes("avif")) return { kind: "avif", mime: "image/avif", framePolicy: "single-image", decoder: "browser" };
  if (heic) {
    // Only native HEVC-capable browsers can decode HEIC here. No libheif/WASM.
    return { kind: "heic", mime: "image/heic", framePolicy: "single-image", decoder: "browser" };
  }
  throw new ImageVisualError("UNSUPPORTED_TYPE", "Supported signatures are JPEG/JPG, PNG, WebP, still AVIF, HEIC and GIF (first frame only)");
}

async function readIdentification(file: ImageVisualFile, signal?: AbortSignal): Promise<PortableImageIdentification> {
  abortIfNeeded(signal);
  const bytes = new Uint8Array(await file.blob.slice(0, 512).arrayBuffer());
  abortIfNeeded(signal);
  return identifyPortableImage(bytes, file);
}

async function bitmapFromBlob(blob: Blob, signal?: AbortSignal): Promise<ImageBitmap> {
  abortIfNeeded(signal);
  if (typeof createImageBitmap !== "function") throw new ImageVisualError("UNSUPPORTED_BROWSER", "This browser does not expose local image decoding");
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    abortIfNeeded(signal);
    if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > IMAGE_VISUAL_LIMITS.maxDimension || bitmap.height > IMAGE_VISUAL_LIMITS.maxDimension) {
      throw new ImageVisualError("PIXEL_LIMIT", "The decoded image dimensions exceed the local limit");
    }
    assertPixels(bitmap.width, bitmap.height);
    return bitmap;
  } catch (error) {
    // The native decoder already allocated this surface. Release it on every
    // rejection, including pixel-count limits and aborts after decode settles.
    bitmap?.close();
    abortIfNeeded(signal);
    if (error instanceof ImageVisualError) throw error;
    throw new ImageVisualError("DECODE_FAILED", "This browser cannot decode the selected image format locally");
  }
}

export async function decodePortableImage(
  file: ImageVisualFile,
  signal?: AbortSignal,
  progress?: (value: ImageVisualProgress) => void,
): Promise<PortableDecodedImage> {
  if (file.size > IMAGE_VISUAL_LIMITS.maxFileBytes) throw new ImageVisualError("FILE_TOO_LARGE", `The selected file exceeds ${IMAGE_VISUAL_LIMITS.maxFileBytes} bytes`);
  const identification = await readIdentification(file, signal);
  progress?.({ phase: "decode", label: `Decoding ${identification.kind.toUpperCase()} in the browser` });
  const bitmap = await bitmapFromBlob(file.blob, signal);
  return { ...identification, bitmap, width: bitmap.width, height: bitmap.height };
}
