import { inspectImageHeader } from "./format";
import {
  ImageVisualError,
  IMAGE_VISUAL_LIMITS,
  abortIfNeeded,
  aspectRatio,
  assertDimension,
  assertCoordinate,
  assertFile,
  assertFiles,
  contrastRatio,
  colorHarmony,
  colorTintsAndShades,
  decodeBitmap,
  extractPalette,
  fitDimensions,
  formatBytes,
  hslToRgb,
  normalizeName,
  parseHexColor,
  resolveCssColor,
  rgbToHex,
  rgbToHsl,
  type ImageVisualFile,
  type ImageVisualProgress,
} from "./visual";
import { calculatePlatformSizes, PLATFORM_PRESETS, type PlatformSizeResult } from "./presets";
import {
  assertOutputMime,
  bitmapCanvas,
  decodeImage,
  encodeCanvas,
  extensionForMime,
  get2d,
  imageDataFromFile,
  makeCanvas,
  outputBlob,
  readHeader,
  validateObject,
  validateQuality,
  verifyOutput,
  type ImageDataResult,
  type OutputMime,
} from "./operations";
import {
  applyImageTransformPixels,
  defaultImageTransformState,
  pixelFrameToCanvas,
} from "./transform-workspace";
import { createZip, inspectZip } from "../file-privacy";
import { decodePortableImage } from "./portable-decode";
import type { GifStructure } from "./gif-structure";
import { decodeForConversion212 } from "./first-frame-gif-212";
import { findImageTargetSize, parseImageTarget } from "./target-size";
import { compressPngLossless47 } from "./png-lossless-47";
import { quantizePngPalette47 } from "./png-palette-lossy-47";
import { conversionCanvas, refuseTransparentJpeg } from "./jpeg-alpha-policy";

export interface TransformInput {
  readonly file: Blob;
  readonly quality?: number;
  readonly mime?: OutputMime;
  readonly signal?: AbortSignal;
  readonly progress?: (value: ImageVisualProgress) => void;
}

export interface ImageOutput {
  readonly blob: Blob;
  readonly filename: string;
  readonly inputMime: string;
  readonly outputMime: OutputMime;
  readonly width: number;
  readonly height: number;
  readonly estimatedBytesSaved?: number;
}

export interface ImageConversionOutput extends ImageOutput {
  readonly quality: number | null;
  readonly lossy: boolean;
  readonly lossNote: string;
  readonly sourceHadAlpha: boolean;
  readonly alphaPolicy: "preserved" | "opaque-source" | "flattened-on-background";
  readonly background: string | null;
  readonly verification: {
    readonly signature: true;
    readonly decoded: true;
    readonly dimensions: true;
  };
  readonly inputKind: "jpeg" | "png" | "webp" | "gif" | "avif" | "heic" | "heif";
  readonly framePolicy: "single-image" | "first-frame-only";
  readonly decoder: "browser" | "libheif-wasm";
  /** Measured source-GIF timing facts; output still contains only the first frame. */
  readonly gifSource?: GifStructure;
}

export const MACHADO_CVD_MATRICES = {
  protanopia: [
    0.152286, 1.052583, -0.204868,
    0.114503, 0.786281, 0.099216,
    -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968,
    0.280085, 0.672501, 0.047413,
    -0.011820, 0.042940, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779,
    -0.078411, 0.930809, 0.147602,
    0.004733, 0.691367, 0.303900,
  ],
} as const;

export type ColorVisionSimulationMode = keyof typeof MACHADO_CVD_MATRICES;

export const COLOR_VISION_SIMULATION_LABELS: Readonly<Record<ColorVisionSimulationMode, string>> = {
  protanopia: "Protanopia",
  deuteranopia: "Deuteranopia",
  tritanopia: "Tritanopia",
};

const MACHADO_MODEL = "Machado, Oliveira & Fernandes (2009), complete dichromacy matrix at severity 1.0";
const MACHADO_DOI = "10.1109/TVCG.2009.113";
const COLOR_VISION_DISCLAIMER =
  "This is a model-based visual simulation, not a medical diagnosis and not a universal representation of how every person with a color-vision deficiency perceives color.";

function assertColorVisionSimulationMode(value: unknown): ColorVisionSimulationMode {
  if (value === "protanopia" || value === "deuteranopia" || value === "tritanopia") return value;
  throw new ImageVisualError("INVALID_INPUT", "Choose protanopia, deuteranopia, or tritanopia simulation");
}

function srgbToLinearByte(value: number): number {
  const encoded = Math.max(0, Math.min(255, value)) / 255;
  return encoded <= 0.04045
    ? encoded / 12.92
    : ((encoded + 0.055) / 1.055) ** 2.4;
}

function linearToSrgbByte(value: number): number {
  const linear = Math.max(0, Math.min(1, value));
  const encoded = linear <= 0.0031308
    ? 12.92 * linear
    : 1.055 * (linear ** (1 / 2.4)) - 0.055;
  return Math.round(Math.max(0, Math.min(1, encoded)) * 255);
}

export function simulateColorVisionRgba(
  rgba: Uint8ClampedArray,
  mode: ColorVisionSimulationMode,
): Uint8ClampedArray {
  if (rgba.length % 4 !== 0) throw new ImageVisualError("INVALID_INPUT", "RGBA pixel data length must be divisible by four");
  const matrix = MACHADO_CVD_MATRICES[mode];
  const output = new Uint8ClampedArray(rgba.length);
  for (let index = 0; index < rgba.length; index += 4) {
    const red = srgbToLinearByte(rgba[index] ?? 0);
    const green = srgbToLinearByte(rgba[index + 1] ?? 0);
    const blue = srgbToLinearByte(rgba[index + 2] ?? 0);
    output[index] = linearToSrgbByte(matrix[0] * red + matrix[1] * green + matrix[2] * blue);
    output[index + 1] = linearToSrgbByte(matrix[3] * red + matrix[4] * green + matrix[5] * blue);
    output[index + 2] = linearToSrgbByte(matrix[6] * red + matrix[7] * green + matrix[8] * blue);
    output[index + 3] = rgba[index + 3] ?? 255;
  }
  return output;
}

export interface ColorVisionSimulationOutput extends ImageOutput {
  readonly mode: ColorVisionSimulationMode;
  readonly modeLabel: string;
  readonly model: string;
  readonly modelDoi: string;
  readonly transformSpace: "linear RGB from sRGB";
  readonly disclaimer: string;
}

export async function simulateColorVisionLocal(
  input: unknown,
  signal?: AbortSignal,
  progress?: (value: ImageVisualProgress) => void,
): Promise<ColorVisionSimulationOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const mode = assertColorVisionSimulationMode(value.mode);
  const source = await imageDataFromFile(file, signal, progress);
  abortIfNeeded(signal);
  progress?.({ phase: "transform", label: `Simulating ${COLOR_VISION_SIMULATION_LABELS[mode]}` });
  const transformed = simulateColorVisionRgba(source.data, mode);
  abortIfNeeded(signal);
  const canvas = makeCanvas(source.width, source.height);
  const context = get2d(canvas);
  const imageData = context.createImageData(source.width, source.height);
  imageData.data.set(transformed);
  context.putImageData(imageData, 0, 0);
  const outputMime = "image/png" as const;
  const blob = await outputBlob(canvas, outputMime, undefined, source.width, source.height, signal, progress);
  const header = await readHeader(file, signal);
  return {
    blob,
    filename: outputName(file, `${mode}-simulation`, outputMime),
    inputMime: header.mime,
    outputMime,
    width: source.width,
    height: source.height,
    mode,
    modeLabel: COLOR_VISION_SIMULATION_LABELS[mode],
    model: MACHADO_MODEL,
    modelDoi: MACHADO_DOI,
    transformSpace: "linear RGB from sRGB",
    disclaimer: COLOR_VISION_DISCLAIMER,
  };
}

function asFile(value: unknown): ImageVisualFile {
  return assertFile(value);
}

function outputName(file: ImageVisualFile, suffix: string, mime: OutputMime): string {
  return `${normalizeName(file.name)}-${suffix}.${extensionForMime(mime)}`;
}

export async function cropImageLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const x = assertCoordinate(value.x ?? 0, "Crop x");
  const y = assertCoordinate(value.y ?? 0, "Crop y");
  const width = assertDimension(value.width, "Crop width");
  const height = assertDimension(value.height, "Crop height");
  const mime = assertOutputMime(value.mime ?? "image/png");
  const quality = validateQuality(value.quality ?? 0.92);
  if (x + width > IMAGE_VISUAL_LIMITS.maxDimension || y + height > IMAGE_VISUAL_LIMITS.maxDimension) {
    throw new ImageVisualError("INVALID_INPUT", "Crop rectangle exceeds the local dimension limit");
  }
  const source = await imageDataFromFile(file, signal, progress);
  if (x + width > source.width || y + height > source.height) throw new ImageVisualError("INVALID_INPUT", "Crop rectangle must fit inside the image");
  const pixels = applyImageTransformPixels(source, {
    ...defaultImageTransformState(source.width, source.height),
    crop: { x, y, width, height },
  });
  const blob = await outputBlob(pixelFrameToCanvas(pixels), mime, quality, width, height, signal, progress);
  return { blob, filename: outputName(file, `${width}x${height}-crop`, mime), inputMime: inspectImageHeader(new Uint8Array(await file.blob.slice(0, 2 * 1024 * 1024).arrayBuffer())).mime, outputMime: mime, width, height, estimatedBytesSaved: file.size - blob.size };
}

export async function convertImageFormatLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageConversionOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const mime = assertOutputMime(value.mime);
  const quality = validateQuality(value.quality ?? 0.92);
  const { decoded, gifSource } = await decodeForConversion212(file, signal, progress);
  try {
    if (decoded.kind === "gif" && gifSource === undefined) {
      throw new ImageVisualError("INVALID_GIF", "GIF input requires an identifiable GIF container");
    }
    if (gifSource !== undefined && (decoded.kind !== "gif" || gifSource.width !== decoded.width || gifSource.height !== decoded.height)) {
      throw new ImageVisualError("INVALID_GIF", "GIF container and decoded image dimensions differ");
    }
    const prepared = conversionCanvas(decoded.bitmap, mime, value.background);
    const canvas = prepared.canvas;
    const blob = await outputBlob(canvas, mime, quality, decoded.width, decoded.height, signal, progress);
    const lossy = mime === "image/jpeg" || mime === "image/webp";
    const sourceNote = decoded.framePolicy === "first-frame-only"
      ? ` GIF input has ${gifSource?.frameCount ?? "unknown"} source frame(s), with ${gifSource?.totalDelayCentiseconds ?? "unknown"} centiseconds of declared delays. Only its first decoded frame is exported; animation and frame timings are lost. Local first-frame extraction accepts GIFs up to 4 MiB and one million pixels. Short delays may be clamped by GIF players.`
      : decoded.kind === "heic" || decoded.kind === "heif"
        ? " HEIC/HEIF needs native browser decoding."
        : decoded.kind === "avif"
          ? " AVIF decode uses the browser's local decoder and fails explicitly when that decoder is unavailable."
          : "";
    const lossNote = mime === "image/png"
      ? `PNG re-encodes the decoded RGBA pixels without additional pixel loss, but source metadata/color-profile bytes are not preserved and prior lossy compression cannot be recovered.${sourceNote}`
      : `${mime === "image/jpeg" ? "JPEG" : "WebP"} output is a lossy re-encode at quality ${quality.toFixed(2)} of the decoded pixels; source metadata bytes are not preserved.${sourceNote}`;
    return {
      blob,
      filename: outputName(file, `converted.${extensionForMime(mime)}`, mime).replace(/\.([^.]+)\.([^.]+)$/u, ".$2"),
      inputMime: decoded.mime,
      outputMime: mime,
      width: decoded.width,
      height: decoded.height,
      estimatedBytesSaved: file.size - blob.size,
      quality: mime === "image/png" ? null : quality,
      lossy,
      lossNote,
      sourceHadAlpha: prepared.sourceHadAlpha,
      alphaPolicy: prepared.alphaPolicy,
      background: prepared.background,
      verification: { signature: true, decoded: true, dimensions: true },
      inputKind: decoded.kind,
      framePolicy: decoded.framePolicy,
      decoder: decoded.decoder,
      ...(gifSource === undefined ? {} : { gifSource }),
    };
  } finally {
    decoded.bitmap.close();
  }
}

export interface ImageCompressionOutput extends ImageOutput {
  readonly compressionMode?: "png-idat-lossless" | "png-palette-exact" | "png-palette-lossy";
  readonly pixelVerification?: "exact-filtered-scanlines";
  readonly paletteColors?: number;
  readonly palettePixelPolicy?: "exact" | "lossy-rgb" | "original-unmodified";
  readonly maxObservedChannelError?: number;
  readonly alphaVerification?: "exact";
  readonly keptOriginal?: boolean;
  readonly targetBytes?: number;
  readonly targetMet?: boolean;
  readonly targetAttempts?: number;
  readonly targetReason?: "met" | "quality-floor" | "png-no-quality-control";
  readonly chosenQuality?: number;
  readonly resizedForTarget?: boolean;
}

export async function compressImageLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageCompressionOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  if (value.pngPalette !== undefined) {
    if ((value.pngPalette !== "exact" && value.pngPalette !== "lossy") || value.pngLossless === true ||
      value.mime !== "image/png" || value.targetKiB !== undefined || value.allowResize === true) {
      throw new ImageVisualError("INVALID_INPUT", "Palette PNG solo con modalità esatta/approssimata, output PNG, senza target o resize");
    }
    progress?.({ phase: "encode", label: "Palette PNG indicizzata con alpha preservato" });
    const output = await quantizePngPalette47(file.blob, { mode: value.pngPalette, ...(signal === undefined ? {} : { signal }) });
    abortIfNeeded(signal);
    return {
      blob: output.blob, filename: outputName(file, `palette-${value.pngPalette}`, "image/png"),
      inputMime: "image/png", outputMime: "image/png", width: output.width, height: output.height,
      estimatedBytesSaved: output.savedBytes, keptOriginal: output.keptOriginal,
      compressionMode: value.pngPalette === "exact" ? "png-palette-exact" : "png-palette-lossy",
      paletteColors: output.paletteColors, palettePixelPolicy: output.pixelPolicy,
      maxObservedChannelError: output.maxObservedChannelError, alphaVerification: output.alphaVerification,
    };
  }
  if (value.pngLossless === true) {
    // This strict opt-in operation preserves original scanlines and PNG
    // metadata bytes, and must never silently fall back to Canvas re-encoding.
    if (value.mime !== "image/png" || value.targetKiB !== undefined || value.allowResize === true) {
      throw new ImageVisualError("INVALID_INPUT", "PNG senza perdita: solo output PNG, senza target o ridimensionamento");
    }
    progress?.({ phase: "encode", label: "Ricompattazione IDAT senza perdita" });
    const result = await compressPngLossless47(file.blob, signal);
    abortIfNeeded(signal);
    return {
      blob: result.blob, filename: outputName(file, "idat-lossless", "image/png"),
      inputMime: "image/png", outputMime: "image/png",
      width: result.width, height: result.height,
      estimatedBytesSaved: result.savedBytes,
      compressionMode: "png-idat-lossless", pixelVerification: result.pixelVerification,
      keptOriginal: result.keptOriginal,
    };
  }
  const quality = validateQuality(value.quality ?? 0.72);
  const mime = assertOutputMime(value.mime ?? "image/jpeg");
  const decoded = await decodeImage(file, signal, progress);
  try {
    if (mime === "image/jpeg" && (await readHeader(file, signal)).mime !== "image/jpeg") {
      refuseTransparentJpeg(decoded.bitmap);
    }
    if (value.targetKiB !== undefined) {
      parseImageTarget(value.targetKiB);
      const result = await findImageTargetSize(
        {
          mime,
          targetKiB: value.targetKiB as number,
          minQuality: value.minQuality === undefined ? 0.45 : validateQuality(value.minQuality, 0.1, 0.92),
          allowResize: value.allowResize === true,
        },
        async (scale, trialQuality) => {
          abortIfNeeded(signal);
          const width = Math.max(1, Math.round(decoded.width * scale));
          const height = Math.max(1, Math.round(decoded.height * scale));
          const canvas = bitmapCanvas(decoded.bitmap, width, height);
          try {
            return await encodeCanvas(canvas, mime, trialQuality, signal, progress);
          } finally {
            canvas.width = 0;
            canvas.height = 0;
          }
        },
        signal,
      );
      const width = Math.max(1, Math.round(decoded.width * result.scale));
      const height = Math.max(1, Math.round(decoded.height * result.scale));
      await verifyOutput(result.blob, mime, width, height, signal, progress);
      return {
        blob: result.blob,
        filename: outputName(file, "target", mime),
        inputMime: inspectImageHeader(new Uint8Array(await file.blob.slice(0, 2 * 1024 * 1024).arrayBuffer())).mime,
        outputMime: mime, width, height, estimatedBytesSaved: file.size - result.blob.size,
        targetBytes: result.targetBytes, targetMet: result.meetsTarget,
        targetAttempts: result.attempts, targetReason: result.reason,
        chosenQuality: result.quality, resizedForTarget: width !== decoded.width || height !== decoded.height,
      };
    }
    const canvas = bitmapCanvas(decoded.bitmap);
    const blob = await outputBlob(canvas, mime, quality, decoded.width, decoded.height, signal, progress);
    return { blob, filename: outputName(file, "compressed", mime), inputMime: inspectImageHeader(new Uint8Array(await file.blob.slice(0, 2 * 1024 * 1024).arrayBuffer())).mime, outputMime: mime, width: decoded.width, height: decoded.height, estimatedBytesSaved: file.size - blob.size };
  } finally {
    decoded.bitmap.close();
  }
}

export interface MetadataResult {
  readonly name: string;
  readonly size: number;
  readonly sizeLabel: string;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly signature: "jpeg" | "png" | "webp";
  readonly bounded: boolean;
}

export async function inspectImageMetadataLocal(input: unknown, signal?: AbortSignal): Promise<MetadataResult> {
  const file = asFile(input);
  const header = await readHeader(file, signal);
  const signature = header.mime === "image/jpeg" ? "jpeg" : header.mime === "image/png" ? "png" : "webp";
  return { name: file.name, size: file.size, sizeLabel: formatBytes(file.size), mime: header.mime, width: header.width, height: header.height, signature, bounded: header.width * header.height <= IMAGE_VISUAL_LIMITS.maxPixels };
}

export interface MetadataBatchResult {
  readonly items: readonly MetadataResult[];
  readonly warnings: readonly string[];
}

export async function inspectImageBatchLocal(input: unknown, signal?: AbortSignal): Promise<MetadataBatchResult> {
  const files = assertFiles(input);
  const items: MetadataResult[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    abortIfNeeded(signal);
    try {
      items.push(await inspectImageMetadataLocal(file, signal));
    } catch (error) {
      warnings.push(`${file.name}: ${error instanceof Error ? error.message : "unreadable image"}`);
    }
  }
  return { items, warnings };
}

export interface PaletteResult {
  readonly mime: string;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly { hex: string; pixels: number }[];
}

function asImageData(result: ImageDataResult): ImageData {
  return { width: result.width, height: result.height, data: result.data, colorSpace: "srgb" } as ImageData;
}

export async function extractImagePaletteLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<PaletteResult> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const count = value.count === undefined ? 6 : Number(value.count);
  const data = await imageDataFromFile(file, signal, progress);
  return { mime: (await readHeader(file, signal)).mime, width: data.width, height: data.height, palette: extractPalette(asImageData(data), count) };
}

export async function extractDominantColorLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<PaletteResult & { dominant: { hex: string; pixels: number } | null }> {
  const file = asFile(input);
  const data = await imageDataFromFile(file, signal, progress);
  const palette = extractPalette(asImageData(data), 1);
  return { mime: (await readHeader(file, signal)).mime, width: data.width, height: data.height, palette, dominant: palette[0] ?? null };
}

export interface RenamePreview {
  readonly original: string;
  readonly renamed: string;
  readonly changed: boolean;
}

export function previewImageRenamesLocal(input: unknown, _signal?: AbortSignal): { readonly items: readonly RenamePreview[] } {
  const value = validateObject(input);
  const files = assertFiles(value.files);
  const prefix = typeof value.prefix === "string" ? value.prefix : "";
  const suffix = typeof value.suffix === "string" ? value.suffix : "";
  const start = Number.isInteger(value.start) ? Number(value.start) : 1;
  if (prefix.length > 40 || suffix.length > 40) throw new ImageVisualError("INVALID_INPUT", "Prefix and suffix are limited to 40 characters");
  const items = files.map((file, index) => {
    const extension = file.name.includes(".") ? `.${file.name.split(".").at(-1)}` : "";
    const stem = extension === "" ? file.name : file.name.slice(0, -extension.length);
    const renamed = `${prefix}${String(start + index).padStart(2, "0")}-${normalizeName(stem)}${suffix}${extension}`;
    return { original: file.name, renamed, changed: renamed !== file.name };
  });
  return { items };
}

/**
 * Preset selection now lives in `./presets`, which carries the published source
 * and verification date for each size. This keeps the runtime entry point and
 * the value list in one place so the two cannot drift.
 */
export { PLATFORM_PRESETS, calculatePlatformSizes, containBox, coverCropFor, ratioLabel, type PixelBox, type CropBox, type PlatformFit, type PlatformPreset, type PlatformSizeResult } from "./presets";

export function calculatePlatformSizesLocal(input: unknown, _signal?: AbortSignal): PlatformSizeResult {
  const value = validateObject(input);
  const preset = PLATFORM_PRESETS.find((item) => item.id === value.presetId);
  if (preset === undefined) throw new ImageVisualError("INVALID_INPUT", "Choose a supported platform preset");
  const width = assertDimension(value.width, "Source width");
  const height = assertDimension(value.height, "Source height");
  return calculatePlatformSizes(preset, width, height);
}

export interface ContactSheetOutput extends ImageOutput {
  readonly columns: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly ordering: "selection" | "filename-asc";
  readonly sourceItems: readonly {
    readonly index: number;
    readonly name: string;
    readonly width: number;
    readonly height: number;
  }[];
  readonly verification: { readonly signature: true; readonly decoded: true; readonly dimensions: true };
}

export async function createContactSheetLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ContactSheetOutput> {
  const value = validateObject(input);
  const selectedFiles = assertFiles(value.files, 24);
  const ordering = value.ordering ?? "selection";
  if (ordering !== "selection" && ordering !== "filename-asc") throw new ImageVisualError("INVALID_INPUT", "Contact-sheet ordering must be selection or filename-asc");
  const files = ordering === "filename-asc"
    ? [...selectedFiles].sort((left, right) => left.name.localeCompare(right.name, "en-US"))
    : selectedFiles;
  const columns = Number.isInteger(value.columns) ? Number(value.columns) : 3;
  const cellWidth = assertDimension(value.cellWidth ?? 240, "Cell width");
  const cellHeight = assertDimension(value.cellHeight ?? 180, "Cell height");
  if (columns < 1 || columns > 8) throw new ImageVisualError("INVALID_INPUT", "Columns must be from 1 to 8");
  const rows = Math.ceil(files.length / columns);
  if (cellWidth * columns * cellHeight * rows > IMAGE_VISUAL_LIMITS.maxContactSheetPixels) throw new ImageVisualError("PIXEL_LIMIT", "Contact sheet exceeds the local pixel limit");
  const canvas = makeCanvas(cellWidth * columns, cellHeight * rows);
  const context = get2d(canvas);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const sourceItems: Array<{ index: number; name: string; width: number; height: number }> = [];
  for (let index = 0; index < files.length; index += 1) {
    abortIfNeeded(signal);
    const decoded = await decodePortableImage(files[index]!, signal, progress);
    try {
      sourceItems.push({ index: index + 1, name: files[index]!.name, width: decoded.width, height: decoded.height });
      const scale = Math.min(cellWidth / decoded.width, cellHeight / decoded.height);
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const x = (index % columns) * cellWidth + Math.floor((cellWidth - width) / 2);
      const y = Math.floor(index / columns) * cellHeight + Math.floor((cellHeight - height) / 2);
      context.drawImage(decoded.bitmap, x, y, width, height);
    } finally {
      decoded.bitmap.close();
    }
  }
  const mime = "image/png" as const;
  const blob = await outputBlob(canvas, mime, undefined, canvas.width, canvas.height, signal, progress);
  return {
    blob,
    filename: "contact-sheet.png",
    inputMime: "image/*",
    outputMime: mime,
    width: canvas.width,
    height: canvas.height,
    columns,
    cellWidth,
    cellHeight,
    ordering,
    sourceItems,
    verification: { signature: true, decoded: true, dimensions: true },
  };
}

export interface IconOutput {
  readonly size: number;
  readonly blob: Blob;
  readonly filename: string;
  readonly outputMime: "image/png";
  readonly width: number;
  readonly height: number;
  readonly verification: { readonly signature: true; readonly decoded: true; readonly dimensions: true };
}

export interface IconBatchOutput {
  readonly items: readonly IconOutput[];
  readonly source: { readonly width: number; readonly height: number; readonly name: string };
  readonly ordering: "size-ascending";
  readonly zipBlob: Blob;
  readonly zipFilename: string;
  readonly zipCompression: "store";
  readonly zipEntries: readonly string[];
  readonly zipVerified: true;
}

export function normalizeIconSizes(input: unknown): readonly number[] {
  const sizes = Array.isArray(input) ? input : [16, 32, 48, 64, 128, 180, 192, 512];
  if (sizes.length < 1 || sizes.length > 12) throw new ImageVisualError("INVALID_INPUT", "Choose 1 to 12 icon sizes");
  return [...new Set(sizes.map((size) => assertDimension(size, "Icon size")))].sort((left, right) => left - right);
}

export async function createIconSizesLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<IconBatchOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const sizes = normalizeIconSizes(value.sizes);
  const decoded = await decodeImage(file, signal, progress);
  try {
    const outputs: IconOutput[] = [];
    for (const size of sizes) {
      abortIfNeeded(signal);
      const canvas = bitmapCanvas(decoded.bitmap, size, size);
      const blob = await outputBlob(canvas, "image/png", undefined, size, size, signal, progress);
      outputs.push({
        size,
        blob,
        filename: outputName(file, `${size}x${size}`, "image/png"),
        outputMime: "image/png",
        width: size,
        height: size,
        verification: { signature: true, decoded: true, dimensions: true },
      });
    }
    if (typeof File === "undefined") throw new ImageVisualError("UNSUPPORTED_BROWSER", "File API is required for verified ZIP packaging");
    const files = outputs.map((output) => new File([output.blob], output.filename, { type: output.outputMime }));
    const archive = await createZip({ files }, signal);
    if (!("blob" in archive) || !(archive.blob instanceof Blob) || archive.compression !== "store") {
      throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Store-only ZIP packaging did not produce a verifiable archive");
    }
    const zipFilename = `${normalizeName(file.name)}-favicon-app-icons.zip`;
    const archiveFile = new File([archive.blob], zipFilename, { type: "application/zip" });
    const inspected = await inspectZip({ files: [archiveFile] }, signal);
    const expectedEntries = outputs.map((output) => output.filename);
    const inspectedEntries = "entries" in inspected && Array.isArray(inspected.entries) ? inspected.entries : [];
    const inspectedPaths = inspectedEntries.map((entry) => typeof entry === "object" && entry !== null && "path" in entry ? String(entry.path) : "");
    const storeOnly = inspectedEntries.every((entry) => typeof entry === "object" && entry !== null && "method" in entry && entry.method === 0);
    if (!storeOnly || inspectedPaths.length !== expectedEntries.length || inspectedPaths.some((path, index) => path !== expectedEntries[index])) {
      throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "ZIP central directory does not exactly match the previewed icon list");
    }
    return {
      items: outputs,
      source: { width: decoded.width, height: decoded.height, name: file.name },
      ordering: "size-ascending",
      zipBlob: archive.blob,
      zipFilename,
      zipCompression: "store",
      zipEntries: expectedEntries,
      zipVerified: true,
    };
  } finally {
    decoded.bitmap.close();
  }
}

export interface PlatformImageExportOutput extends ImageOutput {
  readonly preset: PlatformSizeResult["preset"];
  readonly source: { readonly width: number; readonly height: number };
  readonly coverCrop: PlatformSizeResult["coverCrop"];
  readonly ordering: "single-selected-preset";
  readonly verification: { readonly signature: true; readonly decoded: true; readonly dimensions: true };
}

export async function createPlatformImageExportLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<PlatformImageExportOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const preset = PLATFORM_PRESETS.find((item) => item.id === value.presetId);
  if (preset === undefined) throw new ImageVisualError("INVALID_INPUT", "Choose a supported platform preset");
  const decoded = await decodeImage(file, signal, progress);
  try {
    const sizing = calculatePlatformSizes(preset, decoded.width, decoded.height);
    const canvas = makeCanvas(preset.width, preset.height);
    const context = get2d(canvas);
    const crop = sizing.coverCrop;
    context.drawImage(decoded.bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, preset.width, preset.height);
    const blob = await outputBlob(canvas, "image/png", undefined, preset.width, preset.height, signal, progress);
    return {
      blob,
      filename: `${normalizeName(file.name)}-${preset.id}-${preset.width}x${preset.height}.png`,
      inputMime: (await readHeader(file, signal)).mime,
      outputMime: "image/png",
      width: preset.width,
      height: preset.height,
      preset,
      source: { width: decoded.width, height: decoded.height },
      coverCrop: crop,
      ordering: "single-selected-preset",
      verification: { signature: true, decoded: true, dimensions: true },
    };
  } finally {
    decoded.bitmap.close();
  }
}

export interface BorderOutput extends ImageOutput {
  readonly border: number;
  readonly padding: number;
  readonly background: string;
}

export async function addImageBorderLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<BorderOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const border = Number.isInteger(value.border) ? Number(value.border) : 24;
  const padding = Number.isInteger(value.padding) ? Number(value.padding) : 0;
  const background = typeof value.background === "string" ? value.background : "#ffffff";
  const color = parseHexColor(background);
  if (border < 0 || border > 512 || padding < 0 || padding > 512) throw new ImageVisualError("INVALID_INPUT", "Border and padding must be from 0 to 512 pixels");
  const source = await imageDataFromFile(file, signal, progress);
  const frame = border + padding;
  const backgroundHex = rgbToHex(color.r, color.g, color.b);
  const pixels = applyImageTransformPixels(source, {
    ...defaultImageTransformState(source.width, source.height),
    border: frame,
    borderColor: backgroundHex,
    backgroundMode: "color",
    backgroundColor: backgroundHex,
  });
  const blob = await outputBlob(pixelFrameToCanvas(pixels), "image/png", undefined, pixels.width, pixels.height, signal, progress);
  return { blob, filename: outputName(file, "bordered", "image/png"), inputMime: "image/*", outputMime: "image/png", width: pixels.width, height: pixels.height, border, padding, background: backgroundHex };
}

export interface CompareResult {
  readonly first: MetadataResult;
  readonly second: MetadataResult;
  readonly sameDimensions: boolean;
  readonly alignmentPolicy: "top-left-overlap-no-stretch";
  readonly comparedWidth: number;
  readonly comparedHeight: number;
  readonly unmatchedPixels: number;
  readonly threshold: number;
  readonly algorithm: string;
  readonly maxSampledPixels: number;
  readonly sampledPixels: number;
  readonly differentPixels: number;
  readonly differenceRatio: number;
  readonly meanAbsoluteChannelDifference: number;
  readonly diffBlob: Blob;
  readonly diffFilename: string;
  readonly diffMime: "image/png";
}

export interface PixelDiffSummary {
  readonly sampledPixels: number;
  readonly differentPixels: number;
  readonly differenceRatio: number;
  readonly meanAbsoluteChannelDifference: number;
}

export function compareRgbaBounded(
  first: ImageDataResult,
  second: ImageDataResult,
  threshold = 0,
  maxSamples: number = IMAGE_VISUAL_LIMITS.maxPalettePixels,
): PixelDiffSummary {
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) throw new ImageVisualError("INVALID_INPUT", "Pixel difference threshold must be an integer from 0 to 255");
  if (!Number.isInteger(maxSamples) || maxSamples < 1 || maxSamples > IMAGE_VISUAL_LIMITS.maxPalettePixels) throw new ImageVisualError("INVALID_INPUT", "Pixel sample bound is invalid");
  const width = Math.min(first.width, second.width);
  const height = Math.min(first.height, second.height);
  const overlapPixels = width * height;
  const sampleCount = Math.min(maxSamples, overlapPixels);
  let differentPixels = 0;
  let totalAbsoluteChannelDifference = 0;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const pixelIndex = Math.floor((sample * overlapPixels) / sampleCount);
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const firstOffset = (y * first.width + x) * 4;
    const secondOffset = (y * second.width + x) * 4;
    let maximumDelta = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs((first.data[firstOffset + channel] ?? 0) - (second.data[secondOffset + channel] ?? 0));
      totalAbsoluteChannelDifference += delta;
      maximumDelta = Math.max(maximumDelta, delta);
    }
    if (maximumDelta > threshold) differentPixels += 1;
  }
  return {
    sampledPixels: sampleCount,
    differentPixels,
    differenceRatio: sampleCount === 0 ? 0 : differentPixels / sampleCount,
    meanAbsoluteChannelDifference: sampleCount === 0 ? 0 : totalAbsoluteChannelDifference / (sampleCount * 4),
  };
}

async function createPixelDiffBlob(
  first: ImageDataResult,
  second: ImageDataResult,
  signal?: AbortSignal,
  progress?: (value: ImageVisualProgress) => void,
): Promise<Blob> {
  const width = Math.min(first.width, second.width);
  const height = Math.min(first.height, second.height);
  const canvas = makeCanvas(width, height);
  const context = get2d(canvas);
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    abortIfNeeded(signal);
    for (let x = 0; x < width; x += 1) {
      const targetOffset = (y * width + x) * 4;
      const firstOffset = (y * first.width + x) * 4;
      const secondOffset = (y * second.width + x) * 4;
      image.data[targetOffset] = Math.abs((first.data[firstOffset] ?? 0) - (second.data[secondOffset] ?? 0));
      image.data[targetOffset + 1] = Math.abs((first.data[firstOffset + 1] ?? 0) - (second.data[secondOffset + 1] ?? 0));
      image.data[targetOffset + 2] = Math.abs((first.data[firstOffset + 2] ?? 0) - (second.data[secondOffset + 2] ?? 0));
      image.data[targetOffset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return outputBlob(canvas, "image/png", undefined, width, height, signal, progress);
}

export async function compareImagesLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<CompareResult> {
  const value = validateObject(input);
  const first = asFile(value.first);
  const second = asFile(value.second);
  const alignmentPolicy = value.alignmentPolicy ?? "top-left-overlap-no-stretch";
  if (alignmentPolicy !== "top-left-overlap-no-stretch") throw new ImageVisualError("INVALID_INPUT", "Comparison alignment must be top-left overlap without stretching");
  const threshold = value.threshold === undefined ? 0 : Number(value.threshold);
  const firstDecoded = await imageDataFromFile(first, signal, progress);
  const secondDecoded = await imageDataFromFile(second, signal, progress);
  const width = Math.min(firstDecoded.width, secondDecoded.width);
  const height = Math.min(firstDecoded.height, secondDecoded.height);
  const summary = compareRgbaBounded(firstDecoded, secondDecoded, threshold);
  const diffBlob = await createPixelDiffBlob(firstDecoded, secondDecoded, signal, progress);
  const overlapPixels = width * height;
  return {
    first: await inspectImageMetadataLocal(first.blob, signal),
    second: await inspectImageMetadataLocal(second.blob, signal),
    sameDimensions: firstDecoded.width === secondDecoded.width && firstDecoded.height === secondDecoded.height,
    alignmentPolicy,
    comparedWidth: width,
    comparedHeight: height,
    unmatchedPixels: firstDecoded.width * firstDecoded.height + secondDecoded.width * secondDecoded.height - 2 * overlapPixels,
    threshold,
    algorithm: `Top-left overlap, no stretch; evenly sample at most ${IMAGE_VISUAL_LIMITS.maxPalettePixels} overlap pixels; a sampled pixel differs when any RGBA channel delta is > threshold.`,
    maxSampledPixels: IMAGE_VISUAL_LIMITS.maxPalettePixels,
    ...summary,
    diffBlob,
    diffFilename: "image-pixel-diff.png",
    diffMime: "image/png",
  };
}

function colorSignature(data: ImageDataResult): string {
  const pixels = extractPalette(asImageData(data), 8).map((item) => `${item.hex}:${item.pixels}`).join("|");
  return `${data.width}x${data.height}|${pixels}`;
}

function hammingDistance(left: string, right: string): number {
  let distance = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) if (left[index] !== right[index]) distance += 1;
  return distance + Math.abs(left.length - right.length);
}

export interface DuplicatePair {
  readonly first: string;
  readonly second: string;
  readonly similarity: number;
}

export async function findPerceptualDuplicatesLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<readonly DuplicatePair[]> {
  const value = validateObject(input);
  const files = assertFiles(value.files, 40);
  const signatures: Array<{ name: string; signature: string }> = [];
  for (const file of files) {
    abortIfNeeded(signal);
    const data = await imageDataFromFile(file, signal, progress);
    signatures.push({ name: file.name, signature: colorSignature(data) });
  }
  const pairs: DuplicatePair[] = [];
  for (let left = 0; left < signatures.length; left += 1) {
    for (let right = left + 1; right < signatures.length; right += 1) {
      const a = signatures[left]!;
      const b = signatures[right]!;
      const distance = hammingDistance(a.signature, b.signature);
      const similarity = Math.max(0, 1 - distance / Math.max(a.signature.length, b.signature.length, 1));
      if (similarity >= 0.98) pairs.push({ first: a.name, second: b.name, similarity });
    }
  }
  return pairs;
}

export function convertColorLocal(input: unknown, _signal?: AbortSignal): unknown {
  const value = validateObject(input);
  const source = typeof value.color === "string" ? value.color : typeof value.hex === "string" ? value.hex : "";
  const mode = typeof value.mode === "string" ? value.mode : "convert";
  const resolved = resolveCssColor(source);
  if (mode === "harmonies") {
    return { mode, input: source, namedColor: resolved.namedColor, ...colorHarmony(source) };
  }
  if (mode === "tints-shades") {
    return { mode, input: source, namedColor: resolved.namedColor, ...colorTintsAndShades(source) };
  }
  if (mode === "convert" || mode === "named-color") {
    return {
      mode,
      input: source,
      namedColor: resolved.namedColor,
      hex: resolved.hex,
      rgb: resolved.rgb,
      hsl: rgbToHsl(resolved.rgb.r, resolved.rgb.g, resolved.rgb.b),
      colorSpace: "sRGB/HSL",
    };
  }
  throw new ImageVisualError("INVALID_INPUT", "Choose convert, named-color, harmonies, or tints-shades mode");
}

export function checkContrastLocal(input: unknown, _signal?: AbortSignal): { foreground: string; background: string; ratio: number; aaNormal: boolean; aaLarge: boolean; aaaNormal: boolean } {
  const value = validateObject(input);
  const foreground = typeof value.foreground === "string" ? value.foreground : "";
  const background = typeof value.background === "string" ? value.background : "";
  const ratio = contrastRatio(parseHexColor(foreground), parseHexColor(background));
  return { foreground: rgbToHex(...Object.values(parseHexColor(foreground)) as [number, number, number]), background: rgbToHex(...Object.values(parseHexColor(background)) as [number, number, number]), ratio, aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7 };
}

export function calculateAspectRatioLocal(input: unknown, _signal?: AbortSignal): { ratio: string; width: number; height: number; contain: { width: number; height: number } } {
  const value = validateObject(input);
  const width = assertDimension(value.width, "Width");
  const height = assertDimension(value.height, "Height");
  return { ratio: aspectRatio(width, height), width, height, contain: fitDimensions(width, height, 1920, 1080) };
}

export function inspectColorLocal(input: unknown, _signal?: AbortSignal): unknown {
  return convertColorLocal(input);
}

export function reencodeImageLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageOutput> {
  return convertImageFormatLocal({ ...validateObject(input), mime: "image/png" }, signal, progress);
}

export function asImageDataResult(data: ImageDataResult): ImageData {
  return asImageData(data);
}

export { decodeBitmap, hslToRgb, readHeader };
