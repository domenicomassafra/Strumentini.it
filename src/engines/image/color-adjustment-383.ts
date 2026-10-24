import { scanImageMetadataBlob } from "./metadata";
import { IMAGE_LIMITS } from "./policy";

/**
 * STR-383 works on explicitly sRGB, encoded 8-bit pixels. It is intentionally
 * not an ICC engine. Unknown source metadata blocks the browser decode path.
 */
export interface SrgbPixels383 {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly colorSpace?: string;
}

export interface TonePoint383 {
  readonly input: number;
  readonly output: number;
}

export interface ColorAdjustments383 {
  readonly levels?: { readonly black: number; readonly white: number; readonly gamma: number };
  readonly curve?: readonly TonePoint383[];
}

export interface EditorColorPolicy383 {
  readonly sourceProfile: "untagged-assumed-srgb";
  readonly workingColorSpace: "srgb";
  readonly outputProfile: "srgb-canvas";
  readonly metadataPolicy: string;
}

export const MAX_EDITOR_PIXELS_383 = 2_000_000;

function fail(code: "INVALID_INPUT" | "UNVERIFIED_COLOR_PROFILE", explanation: string): never {
  throw new Error(`${code}: ${explanation}`);
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

export async function inspectEditorSource383(blob: Blob, signal?: AbortSignal): Promise<EditorColorPolicy383> {
  abortIfNeeded(signal);
  if (!(blob instanceof Blob) || blob.size < 1 || blob.size > IMAGE_LIMITS.maxInputBytes) {
    fail("INVALID_INPUT", "Input must be a local image within the existing size limit");
  }
  const inventory = await scanImageMetadataBlob(blob, signal);
  abortIfNeeded(signal);
  // The existing inventory reports recognized ICC/EXIF and unknown ancillary
  // payloads. Every such payload can affect the meaning of a decoded pixel.
  // Refuse until the editor has verified ICC/EXIF conversion and orientation.
  if (!inventory.complete || inventory.format === "unknown" || inventory.segments.length > 0) {
    fail("UNVERIFIED_COLOR_PROFILE", "Source metadata, color profile or orientation cannot be verified; original preserved");
  }
  return {
    sourceProfile: "untagged-assumed-srgb",
    workingColorSpace: "srgb",
    outputProfile: "srgb-canvas",
    metadataPolicy: "Untagged source is interpreted as sRGB. No original ICC/EXIF profile is copied or claimed; export must declare sRGB.",
  };
}

function makeLut383(options: ColorAdjustments383): Uint8ClampedArray {
  const { levels, curve } = options;
  if (levels !== undefined && (
    !Number.isInteger(levels.black) || !Number.isInteger(levels.white) ||
    levels.black < 0 || levels.white > 255 || levels.white <= levels.black ||
    !Number.isFinite(levels.gamma) || levels.gamma < 0.1 || levels.gamma > 5
  )) {
    fail("INVALID_INPUT", "Levels must have 0 <= black < white <= 255 and gamma between 0.1 and 5");
  }
  if (curve !== undefined && (
    !Array.isArray(curve) || curve.length < 2 || curve.length > 32 ||
    curve[0]?.input !== 0 || curve[curve.length - 1]?.input !== 255 ||
    curve.some((point, i) =>
      !Number.isInteger(point.input) || !Number.isInteger(point.output) ||
      point.input < 0 || point.input > 255 || point.output < 0 || point.output > 255 ||
      (i > 0 && point.input <= curve[i - 1]!.input))
  )) {
    fail("INVALID_INPUT", "Curve requires 2–32 increasing input points, endpoints 0/255, and 8-bit output values");
  }

  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    const normalized = levels === undefined ? i / 255
      : Math.min(1, Math.max(0, (i - levels.black) / (levels.white - levels.black)));
    const mapped = Math.pow(normalized, 1 / (levels?.gamma ?? 1)) * 255;
    if (curve === undefined) {
      lut[i] = mapped;
      continue;
    }
    let segment = 1;
    while (segment < curve.length - 1 && mapped > curve[segment]!.input) segment += 1;
    const left = curve[segment - 1]!;
    const right = curve[segment]!;
    lut[i] = left.output + (mapped - left.input) * (right.output - left.output) / (right.input - left.input);
  }
  return lut;
}

export function adjustSrgbPixels383(
  source: SrgbPixels383,
  options: ColorAdjustments383,
  signal?: AbortSignal,
): SrgbPixels383 & { readonly colorSpace: "srgb" } {
  abortIfNeeded(signal);
  if (source?.colorSpace !== "srgb") {
    fail("UNVERIFIED_COLOR_PROFILE", "Only explicitly declared 8-bit sRGB pixels can be adjusted");
  }
  if (!Number.isInteger(source.width) || !Number.isInteger(source.height) ||
      source.width < 1 || source.height < 1 ||
      source.width > IMAGE_LIMITS.maxDimension || source.height > IMAGE_LIMITS.maxDimension ||
      source.width * source.height > MAX_EDITOR_PIXELS_383 ||
      !(source.data instanceof Uint8ClampedArray) || source.data.length !== source.width * source.height * 4 ||
      options === null || typeof options !== "object") {
    fail("INVALID_INPUT", "Invalid or oversized RGBA frame");
  }
  const lut = makeLut383(options);
  const output = new Uint8ClampedArray(source.data.length);
  for (let i = 0; i < source.data.length; i += 4) {
    if ((i & 0xffff) === 0) abortIfNeeded(signal);
    output[i] = lut[source.data[i]!]!;
    output[i + 1] = lut[source.data[i + 1]!]!;
    output[i + 2] = lut[source.data[i + 2]!]!;
    output[i + 3] = source.data[i + 3]!;
  }
  abortIfNeeded(signal);
  return { width: source.width, height: source.height, data: output, colorSpace: "srgb" };
}
