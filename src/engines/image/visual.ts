export type ImageVisualToolId =
  | "image-crop"
  | "image-format-conversion"
  | "image-compression"
  | "aspect-ratio-calculator"
  | "platform-size-presets"
  | "image-metadata-viewer"
  | "exif-remover"
  | "color-picker"
  | "color-converter"
  | "contrast-checker"
  | "palette-extractor"
  | "dominant-color-extractor"
  | "image-dimensions-batch-inspector"
  | "image-rename-batch-preview"
  | "contact-sheet-generator"
  | "favicon-app-icon-size-generator"
  | "screenshot-border-background-helper"
  | "image-compare-slider"
  | "perceptual-duplicate-finder";

export const IMAGE_VISUAL_LIMITS = {
  maxFiles: 40,
  maxFileBytes: 40 * 1024 * 1024,
  maxPixels: 16_000_000,
  maxDimension: 8_192,
  maxContactSheetPixels: 12_000_000,
  maxPalettePixels: 250_000,
} as const;

export class ImageVisualError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "ImageVisualError";
  }
}

export interface ImageVisualFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly blob: Blob;
}

export interface ImageVisualProgress {
  readonly phase: "read" | "decode" | "transform" | "encode" | "verify";
  readonly label: string;
}

export function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

export function assertFile(input: unknown, label = "image"): ImageVisualFile {
  if (typeof input !== "object" || input === null || !(input instanceof Blob)) {
    throw new ImageVisualError("INVALID_INPUT", `Choose a local ${label} file`);
  }
  const source = input as Blob & { readonly name?: unknown; readonly type?: unknown };
  const file: ImageVisualFile = {
    name: typeof source.name === "string" ? source.name : label,
    size: source.size,
    type: typeof source.type === "string" ? source.type : "",
    blob: source,
  };
  if (file.size < 1) throw new ImageVisualError("INVALID_INPUT", "The selected file is empty");
  if (file.size > IMAGE_VISUAL_LIMITS.maxFileBytes) {
    throw new ImageVisualError("FILE_TOO_LARGE", `The selected file exceeds ${IMAGE_VISUAL_LIMITS.maxFileBytes} bytes`);
  }
  return file;
}

export function assertFiles(input: unknown, maxFiles: number = IMAGE_VISUAL_LIMITS.maxFiles): ImageVisualFile[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > maxFiles) {
    throw new ImageVisualError("INVALID_INPUT", `Choose between 1 and ${maxFiles} local files`);
  }
  return input.map((file) => assertFile(file));
}

export function assertDimension(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > IMAGE_VISUAL_LIMITS.maxDimension) {
    throw new ImageVisualError("INVALID_INPUT", `${label} must be a whole number from 1 to ${IMAGE_VISUAL_LIMITS.maxDimension}`);
  }
  return Number(value);
}

export function assertCoordinate(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) >= IMAGE_VISUAL_LIMITS.maxDimension) {
    throw new ImageVisualError("INVALID_INPUT", `${label} must be a whole number from 0 to ${IMAGE_VISUAL_LIMITS.maxDimension - 1}`);
  }
  return Number(value);
}

export function assertPixels(width: number, height: number, label = "image"): void {
  if (width * height > IMAGE_VISUAL_LIMITS.maxPixels) {
    throw new ImageVisualError("PIXEL_LIMIT", `The ${label} exceeds the local pixel limit`);
  }
}

export function normalizeName(name: string, fallback = "image"): string {
  const base = name.split(/[\\/]/u).at(-1) ?? fallback;
  const stem = base.replace(/\.[^.]*$/u, "").normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[.-]+|[.-]+$/gu, "")
    .slice(0, 100);
  return stem || fallback;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new ImageVisualError("ENCODE_FAILED", `Browser could not encode ${mime}`));
      else resolve(blob);
    }, mime, quality);
  });
}

export async function decodeBitmap(file: Blob, signal?: AbortSignal): Promise<ImageBitmap> {
  abortIfNeeded(signal);
  if (typeof createImageBitmap !== "function") {
    throw new ImageVisualError("UNSUPPORTED_BROWSER", "This browser does not expose local image decoding");
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    abortIfNeeded(signal);
    assertPixels(bitmap.width, bitmap.height);
    return bitmap;
  } catch (error) {
    abortIfNeeded(signal);
    if (error instanceof ImageVisualError) throw error;
    throw new ImageVisualError("DECODE_FAILED", "The browser could not decode this image");
  }
}

export function drawBitmap(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  assertDimension(width, "Width");
  assertDimension(height, "Height");
  assertPixels(width, height, "output");
  if (typeof document === "undefined") throw new ImageVisualError("UNSUPPORTED_BROWSER", "Canvas is unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) throw new ImageVisualError("UNSUPPORTED_BROWSER", "Canvas is unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

export function parseHexColor(value: string): { r: number; g: number; b: number } {
  const normalized = value.trim().replace(/^#/u, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/iu.test(normalized)) {
    throw new ImageVisualError("INVALID_COLOR", "Use a 3- or 6-digit hexadecimal color");
  }
  const expanded = normalized.length === 3 ? [...normalized].map((part) => `${part}${part}`).join("") : normalized;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness * 100 };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === red ? ((green - blue) / delta + (green < blue ? 6 : 0)) : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return { h: hue * 60, s: saturation * 100, l: lightness * 100 };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const lightness = Math.max(0, Math.min(100, l)) / 100;
  if (saturation === 0) {
    const value = lightness * 255;
    return { r: value, g: value, b: value };
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return { r: channel(hue / 360 + 1 / 3) * 255, g: channel(hue / 360) * 255, b: channel(hue / 360 - 1 / 3) * 255 };
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(first: { r: number; g: number; b: number }, second: { r: number; g: number; b: number }): number {
  const lighter = Math.max(relativeLuminance(first.r, first.g, first.b), relativeLuminance(second.r, second.g, second.b));
  const darker = Math.min(relativeLuminance(first.r, first.g, first.b), relativeLuminance(second.r, second.g, second.b));
  return (lighter + 0.05) / (darker + 0.05);
}

export function imageDataPixels(image: ImageData, maxPixels = IMAGE_VISUAL_LIMITS.maxPalettePixels): Uint8ClampedArray {
  const stride = Math.max(1, Math.floor((image.width * image.height) / maxPixels));
  const pixels = new Uint8ClampedArray(Math.ceil(image.width * image.height / stride) * 4);
  let count = 0;
  for (let index = 0; index < image.width * image.height; index += stride) {
    const offset = index * 4;
    pixels[count++] = image.data[offset] ?? 0;
    pixels[count++] = image.data[offset + 1] ?? 0;
    pixels[count++] = image.data[offset + 2] ?? 0;
    pixels[count++] = image.data[offset + 3] ?? 0;
  }
  return pixels.subarray(0, count);
}

export function quantizeColor(r: number, g: number, b: number, step = 32): string {
  return rgbToHex(Math.round(r / step) * step, Math.round(g / step) * step, Math.round(b / step) * step);
}

export function extractPalette(image: ImageData, count = 6): Array<{ hex: string; pixels: number }> {
  if (!Number.isInteger(count) || count < 1 || count > 32) throw new ImageVisualError("INVALID_INPUT", "Palette size must be from 1 to 32");
  const buckets = new Map<string, number>();
  const pixels = imageDataPixels(image);
  for (let index = 0; index < pixels.length; index += 4) {
    if ((pixels[index + 3] ?? 0) < 128) continue;
    const key = quantizeColor(pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, count).map(([hex, pixels]) => ({ hex, pixels }));
}

export function dominantColor(image: ImageData): { hex: string; pixels: number } | null {
  return extractPalette(image, 1)[0] ?? null;
}

export function aspectRatio(width: number, height: number, precision = 4): string {
  assertDimension(width, "Width");
  assertDimension(height, "Height");
  if (!Number.isInteger(precision) || precision < 1 || precision > 8) throw new ImageVisualError("INVALID_INPUT", "Precision must be from 1 to 8");
  const divisor = (left: number, right: number): number => right === 0 ? left : divisor(right, left % right);
  const gcd = divisor(width, height);
  const ratioWidth = width / gcd;
  const ratioHeight = height / gcd;
  const decimal = width / height;
  return `${ratioWidth}:${ratioHeight} (${decimal.toFixed(precision).replace(/0+$/u, "").replace(/\.$/u, "")})`;
}

export function fitDimensions(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  assertDimension(width, "Width");
  assertDimension(height, "Height");
  assertDimension(maxWidth, "Maximum width");
  assertDimension(maxHeight, "Maximum height");
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function safeFilename(name: string, suffix: string, extension?: string): string {
  const normalized = normalizeName(name);
  const ext = extension === undefined ? "" : `.${extension.replace(/^\./u, "")}`;
  return `${normalized}-${suffix}${ext}`;
}

export function emitProgress(progress: ((value: ImageVisualProgress) => void) | undefined, phase: ImageVisualProgress["phase"], label: string): void {
  progress?.({ phase, label });
}
