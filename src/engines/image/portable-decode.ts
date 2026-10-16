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
  readonly decoder: "browser" | "libheif-wasm";
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

function filenameExtension(file: Pick<ImageVisualFile, "name">): string {
  const name = file.name.toLowerCase();
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1);
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

export function identifyPortableImage(bytes: Uint8Array, file?: Pick<ImageVisualFile, "name" | "type">): PortableImageIdentification {
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
  const declared = file?.type.toLowerCase() ?? "";
  const extension = file === undefined ? "" : filenameExtension(file);
  // AVIF image sequences carry multiple timed frames. The browser may decode
  // frame 1, but this still-only conversion path cannot preserve animation.
  // The isolated #212 AVIF capability probe already refuses this 'avis' brand.
  if (brands.includes("avis")) {
    throw new ImageVisualError("UNSUPPORTED_AVIF_SEQUENCE", "Animated AVIF sequences require an approved animation-preserving converter");
  }
  const avif = brands.includes("avif") || declared === "image/avif" || extension === "avif";
  if (avif) return { kind: "avif", mime: "image/avif", framePolicy: "single-image", decoder: "browser" };

  const heifBrand = brands.some((brand) => ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand));
  const heicDeclared = declared === "image/heic" || declared === "image/heif" || extension === "heic" || extension === "heif";
  if (heifBrand || heicDeclared) {
    const heif = declared === "image/heif" || extension === "heif";
    return { kind: heif ? "heif" : "heic", mime: heif ? "image/heif" : "image/heic", framePolicy: "single-image", decoder: "libheif-wasm" };
  }
  throw new ImageVisualError("UNSUPPORTED_TYPE", "Supported inputs are JPEG/JPG, PNG, WebP, AVIF, HEIC/HEIF and GIF (first frame only)");
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
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    abortIfNeeded(signal);
    if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > IMAGE_VISUAL_LIMITS.maxDimension || bitmap.height > IMAGE_VISUAL_LIMITS.maxDimension) {
      bitmap.close();
      throw new ImageVisualError("PIXEL_LIMIT", "The decoded image dimensions exceed the local limit");
    }
    assertPixels(bitmap.width, bitmap.height);
    return bitmap;
  } catch (error) {
    abortIfNeeded(signal);
    if (error instanceof ImageVisualError) throw error;
    throw new ImageVisualError("DECODE_FAILED", "This browser cannot decode the selected image format locally");
  }
}

async function decodeHeif(file: ImageVisualFile, signal?: AbortSignal): Promise<ImageBitmap> {
  abortIfNeeded(signal);
  const { heicTo } = await import("heic-to/csp");
  abortIfNeeded(signal);
  try {
    const converted = await heicTo({ blob: file.blob, type: "image/png", quality: 1 });
    abortIfNeeded(signal);
    if (!(converted instanceof Blob) || converted.size < 1) throw new ImageVisualError("DECODE_FAILED", "HEIC/HEIF decoder did not produce a usable frame");
    return await bitmapFromBlob(converted, signal);
  } catch (error) {
    if (error instanceof ImageVisualError) throw error;
    throw new ImageVisualError("DECODE_FAILED", error instanceof Error ? `HEIC/HEIF decode failed: ${error.message}` : "HEIC/HEIF decode failed locally");
  }
}

export async function decodePortableImage(
  file: ImageVisualFile,
  signal?: AbortSignal,
  progress?: (value: ImageVisualProgress) => void,
): Promise<PortableDecodedImage> {
  if (file.size > IMAGE_VISUAL_LIMITS.maxFileBytes) throw new ImageVisualError("FILE_TOO_LARGE", `The selected file exceeds ${IMAGE_VISUAL_LIMITS.maxFileBytes} bytes`);
  const identification = await readIdentification(file, signal);
  progress?.({ phase: "decode", label: identification.decoder === "libheif-wasm" ? "Decoding HEIC/HEIF locally" : `Decoding ${identification.kind.toUpperCase()} locally` });
  const bitmap = identification.decoder === "libheif-wasm"
    ? await decodeHeif(file, signal)
    : await bitmapFromBlob(file.blob, signal);
  return { ...identification, bitmap, width: bitmap.width, height: bitmap.height };
}
