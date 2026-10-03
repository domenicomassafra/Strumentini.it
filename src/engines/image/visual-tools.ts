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
  assertPixels,
  contrastRatio,
  decodeBitmap,
  extractPalette,
  fitDimensions,
  formatBytes,
  hslToRgb,
  normalizeName,
  parseHexColor,
  rgbToHex,
  rgbToHsl,
  type ImageVisualFile,
  type ImageVisualProgress,
} from "./visual";
import {
  assertOutputMime,
  bitmapCanvas,
  decodeImage,
  extensionForMime,
  get2d,
  imageDataFromFile,
  makeCanvas,
  outputBlob,
  readHeader,
  validateObject,
  validateQuality,
  type ImageDataResult,
  type OutputMime,
} from "./operations";

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
  progress?.({ phase: "decode", label: "Decoding locally" });
  const decoded = await decodeImage(file, signal, progress);
  try {
    if (x + width > decoded.width || y + height > decoded.height) throw new ImageVisualError("INVALID_INPUT", "Crop rectangle must fit inside the image");
    const canvas = makeCanvas(width, height);
    const context = get2d(canvas);
    context.drawImage(decoded.bitmap, x, y, width, height, 0, 0, width, height);
    const blob = await outputBlob(canvas, mime, quality, width, height, signal, progress);
    return { blob, filename: outputName(file, `${width}x${height}-crop`, mime), inputMime: inspectImageHeader(new Uint8Array(await file.blob.slice(0, 2 * 1024 * 1024).arrayBuffer())).mime, outputMime: mime, width, height, estimatedBytesSaved: file.size - blob.size };
  } finally {
    decoded.bitmap.close();
  }
}

export async function convertImageFormatLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const mime = assertOutputMime(value.mime);
  const quality = validateQuality(value.quality ?? 0.92);
  const decoded = await decodeImage(file, signal, progress);
  try {
    const canvas = bitmapCanvas(decoded.bitmap);
    const blob = await outputBlob(canvas, mime, quality, decoded.width, decoded.height, signal, progress);
    return { blob, filename: outputName(file, `converted.${extensionForMime(mime)}`, mime).replace(/\.([^.]+)\.([^.]+)$/u, ".$2"), inputMime: inspectImageHeader(new Uint8Array(await file.blob.slice(0, 2 * 1024 * 1024).arrayBuffer())).mime, outputMime: mime, width: decoded.width, height: decoded.height, estimatedBytesSaved: file.size - blob.size };
  } finally {
    decoded.bitmap.close();
  }
}

export async function compressImageLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageOutput> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const quality = validateQuality(value.quality ?? 0.72);
  const mime = assertOutputMime(value.mime ?? "image/jpeg");
  const decoded = await decodeImage(file, signal, progress);
  try {
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

export const PLATFORM_SIZE_PRESETS = [
  { id: "instagram-square", name: "Instagram square", width: 1080, height: 1080 },
  { id: "instagram-story", name: "Instagram story", width: 1080, height: 1920 },
  { id: "open-graph", name: "Open Graph", width: 1200, height: 630 },
  { id: "youtube-thumbnail", name: "YouTube thumbnail", width: 1280, height: 720 },
  { id: "app-icon", name: "App icon", width: 1024, height: 1024 },
] as const;

export function calculatePlatformSizesLocal(input: unknown, _signal?: AbortSignal): { readonly preset: (typeof PLATFORM_SIZE_PRESETS)[number]; readonly contain: { width: number; height: number }; readonly cover: { width: number; height: number } } {
  const value = validateObject(input);
  const preset = PLATFORM_SIZE_PRESETS.find((item) => item.id === value.presetId);
  if (preset === undefined) throw new ImageVisualError("INVALID_INPUT", "Choose a supported platform preset");
  const width = assertDimension(value.width, "Source width");
  const height = assertDimension(value.height, "Source height");
  return { preset, contain: fitDimensions(width, height, preset.width, preset.height), cover: { width: preset.width, height: preset.height } };
}

export interface ContactSheetOutput extends ImageOutput {
  readonly columns: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
}

export async function createContactSheetLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ContactSheetOutput> {
  const value = validateObject(input);
  const files = assertFiles(value.files, 24);
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
  for (let index = 0; index < files.length; index += 1) {
    abortIfNeeded(signal);
    const decoded = await decodeImage(files[index]!, signal, progress);
    try {
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
  return { blob, filename: "contact-sheet.png", inputMime: "image/*", outputMime: mime, width: canvas.width, height: canvas.height, columns, cellWidth, cellHeight };
}

export interface IconOutput {
  readonly size: number;
  readonly blob: Blob;
  readonly filename: string;
}

export async function createIconSizesLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<readonly IconOutput[]> {
  const value = validateObject(input);
  const file = asFile(value.file);
  const sizes = Array.isArray(value.sizes) ? value.sizes : [16, 32, 48, 64, 128, 180, 192, 512];
  if (!Array.isArray(sizes) || sizes.length < 1 || sizes.length > 12) throw new ImageVisualError("INVALID_INPUT", "Choose 1 to 12 icon sizes");
  const decoded = await decodeImage(file, signal, progress);
  try {
    const outputs: IconOutput[] = [];
    for (const rawSize of sizes) {
      abortIfNeeded(signal);
      const size = assertDimension(rawSize, "Icon size");
      const canvas = bitmapCanvas(decoded.bitmap, size, size);
      const blob = await outputBlob(canvas, "image/png", undefined, size, size, signal, progress);
      outputs.push({ size, blob, filename: outputName(file, `${size}x${size}`, "image/png") });
    }
    return outputs;
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
  const decoded = await decodeImage(file, signal, progress);
  try {
    const width = decoded.width + (border + padding) * 2;
    const height = decoded.height + (border + padding) * 2;
    assertPixels(width, height, "bordered image");
    const canvas = makeCanvas(width, height);
    const context = get2d(canvas);
    context.fillStyle = rgbToHex(color.r, color.g, color.b);
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.bitmap, border + padding, border + padding, decoded.width, decoded.height);
    const blob = await outputBlob(canvas, "image/png", undefined, width, height, signal, progress);
    return { blob, filename: outputName(file, "bordered", "image/png"), inputMime: "image/*", outputMime: "image/png", width, height, border, padding, background: rgbToHex(color.r, color.g, color.b) };
  } finally {
    decoded.bitmap.close();
  }
}

export interface CompareResult {
  readonly first: MetadataResult;
  readonly second: MetadataResult;
  readonly sameDimensions: boolean;
  readonly sampledPixels: number;
  readonly differentChannels: number;
  readonly differenceRatio: number;
}

export async function compareImagesLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<CompareResult> {
  const value = validateObject(input);
  const first = asFile(value.first);
  const second = asFile(value.second);
  const firstDecoded = await imageDataFromFile(first, signal, progress);
  const secondDecoded = await imageDataFromFile(second, signal, progress);
  const width = Math.min(firstDecoded.width, secondDecoded.width);
  const height = Math.min(firstDecoded.height, secondDecoded.height);
  const sampleCount = Math.min(IMAGE_VISUAL_LIMITS.maxPalettePixels, width * height);
  const stride = Math.max(1, Math.floor((width * height) / sampleCount));
  let sampled = 0;
  let different = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * 4;
      const otherOffset = (y * secondDecoded.width + x) * 4;
      if (firstDecoded.data[offset] !== secondDecoded.data[otherOffset] || firstDecoded.data[offset + 1] !== secondDecoded.data[otherOffset + 1] || firstDecoded.data[offset + 2] !== secondDecoded.data[otherOffset + 2]) different += 1;
      sampled += 1;
    }
  }
  return { first: await inspectImageMetadataLocal(first.blob, signal), second: await inspectImageMetadataLocal(second.blob, signal), sameDimensions: firstDecoded.width === secondDecoded.width && firstDecoded.height === secondDecoded.height, sampledPixels: sampled, differentChannels: different, differenceRatio: sampled === 0 ? 0 : different / sampled };
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

export function convertColorLocal(input: unknown, _signal?: AbortSignal): { hex: string; rgb: { r: number; g: number; b: number }; hsl: { h: number; s: number; l: number } } {
  const value = validateObject(input);
  const hex = typeof value.hex === "string" ? value.hex : "";
  const rgb = parseHexColor(hex);
  return { hex: rgbToHex(rgb.r, rgb.g, rgb.b), rgb, hsl: rgbToHsl(rgb.r, rgb.g, rgb.b) };
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

export function inspectColorLocal(input: unknown, _signal?: AbortSignal): { hex: string; rgb: { r: number; g: number; b: number }; hsl: { h: number; s: number; l: number } } {
  return convertColorLocal(input);
}

export function reencodeImageLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageOutput> {
  return convertImageFormatLocal({ ...validateObject(input), mime: "image/png" }, signal, progress);
}

export function asImageDataResult(data: ImageDataResult): ImageData {
  return asImageData(data);
}

export { decodeBitmap, hslToRgb, readHeader };
