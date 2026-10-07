import { preflightHeavyLocalJob } from "../../runtime/heavy-preflight";
import {
  assertOutputMime,
  get2d,
  imageDataFromFile,
  makeCanvas,
  outputBlob,
  readHeader,
  type OutputMime,
} from "./operations";
import {
  IMAGE_VISUAL_LIMITS,
  ImageVisualError,
  abortIfNeeded,
  assertFile,
  assertPixels,
  normalizeName,
  parseHexColor,
  rgbToHex,
  type ImageVisualProgress,
} from "./visual";

export const IMAGE_TRANSFORM_PIPELINE_VERSION = "direct-image-transform-v1";
export const IMAGE_TRANSFORM_HISTORY_LIMIT = 64;

export type QuarterTurn = 0 | 90 | 180 | 270;
export type TransformBackgroundMode = "transparent" | "color";
export type ImageRedactionMode = "solid" | "pixelate";

export interface ImageTransformCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ImageRedactionRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly mode: ImageRedactionMode;
  readonly color: string;
}

export interface ImageTransformState {
  readonly crop: ImageTransformCrop;
  readonly rotate: QuarterTurn;
  readonly flipHorizontal: boolean;
  readonly flipVertical: boolean;
  readonly roundCrop: boolean;
  readonly border: number;
  readonly borderColor: string;
  readonly backgroundMode: TransformBackgroundMode;
  readonly backgroundColor: string;
  readonly brightness: number;
  readonly contrast: number;
  readonly saturation: number;
  readonly redactions: readonly ImageRedactionRegion[];
}

export interface ImageTransformHistory {
  readonly initial: ImageTransformState;
  readonly current: ImageTransformState;
  readonly past: readonly ImageTransformState[];
}

export interface PixelFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface ImageTransformPixelResult extends PixelFrame {
  readonly contentWidth: number;
  readonly contentHeight: number;
  readonly alphaPolicy: "preserved" | "flattened-to-background";
  readonly pipeline: readonly string[];
}

export interface ImageTransformOutput {
  readonly blob: Blob;
  readonly filename: string;
  readonly inputMime: string;
  readonly outputMime: OutputMime;
  readonly width: number;
  readonly height: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly transform: ImageTransformState;
  readonly alphaPolicy: "preserved" | "flattened-to-background";
  readonly backgroundPolicy: string;
  readonly pipelineVersion: string;
  readonly pipeline: readonly string[];
  readonly redactionCount: number;
  readonly metadataPolicy: "png-reencoded-metadata-checked";
}

function integerInRange(value: unknown, minimum: number, maximum: number, label: string): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new ImageVisualError("INVALID_INPUT", `${label} must be a whole number from ${minimum} to ${maximum}`);
  }
  return Number(value);
}

function finiteInRange(value: unknown, minimum: number, maximum: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ImageVisualError("INVALID_INPUT", `${label} must be from ${minimum} to ${maximum}`);
  }
  return value;
}

function normalizedColor(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value : fallback;
  const rgb = parseHexColor(raw);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export function defaultImageTransformState(width: number, height: number): ImageTransformState {
  integerInRange(width, 1, IMAGE_VISUAL_LIMITS.maxDimension, "Source width");
  integerInRange(height, 1, IMAGE_VISUAL_LIMITS.maxDimension, "Source height");
  assertPixels(width, height, "source image");
  return {
    crop: { x: 0, y: 0, width, height },
    rotate: 0,
    flipHorizontal: false,
    flipVertical: false,
    roundCrop: false,
    border: 0,
    borderColor: "#000000",
    backgroundMode: "transparent",
    backgroundColor: "#ffffff",
    brightness: 0,
    contrast: 0,
    saturation: 0,
    redactions: [],
  };
}

export function normalizeImageTransformState(
  value: ImageTransformState,
  sourceWidth: number,
  sourceHeight: number,
): ImageTransformState {
  integerInRange(sourceWidth, 1, IMAGE_VISUAL_LIMITS.maxDimension, "Source width");
  integerInRange(sourceHeight, 1, IMAGE_VISUAL_LIMITS.maxDimension, "Source height");
  if (![0, 90, 180, 270].includes(value.rotate)) throw new ImageVisualError("INVALID_INPUT", "Rotation must be 0, 90, 180, or 270 degrees");
  const crop = {
    x: integerInRange(value.crop.x, 0, sourceWidth - 1, "Crop x"),
    y: integerInRange(value.crop.y, 0, sourceHeight - 1, "Crop y"),
    width: integerInRange(value.crop.width, 1, sourceWidth, "Crop width"),
    height: integerInRange(value.crop.height, 1, sourceHeight, "Crop height"),
  };
  if (crop.x + crop.width > sourceWidth || crop.y + crop.height > sourceHeight) {
    throw new ImageVisualError("INVALID_INPUT", "Crop rectangle must fit inside the decoded source image");
  }
  const border = integerInRange(value.border, 0, 512, "Border");
  const contentWidth = value.rotate === 90 || value.rotate === 270 ? crop.height : crop.width;
  const contentHeight = value.rotate === 90 || value.rotate === 270 ? crop.width : crop.height;
  const redactions = (Array.isArray(value.redactions) ? value.redactions : []).slice(0, 64).map((region, index) => {
    if (typeof region !== "object" || region === null) throw new ImageVisualError("INVALID_INPUT", `Redaction ${index + 1} is invalid`);
    const x = integerInRange(region.x, 0, contentWidth - 1, `Redaction ${index + 1} x`);
    const y = integerInRange(region.y, 0, contentHeight - 1, `Redaction ${index + 1} y`);
    const width = integerInRange(region.width, 1, contentWidth, `Redaction ${index + 1} width`);
    const height = integerInRange(region.height, 1, contentHeight, `Redaction ${index + 1} height`);
    if (x + width > contentWidth || y + height > contentHeight) throw new ImageVisualError("INVALID_INPUT", `Redaction ${index + 1} must fit inside transformed content`);
    return { x, y, width, height, mode: region.mode === "pixelate" ? "pixelate" as const : "solid" as const, color: normalizedColor(region.color, "#000000") };
  });
  assertPixels(contentWidth + border * 2, contentHeight + border * 2, "transformed output");
  return {
    crop,
    rotate: value.rotate,
    flipHorizontal: value.flipHorizontal === true,
    flipVertical: value.flipVertical === true,
    roundCrop: value.roundCrop === true,
    border,
    borderColor: normalizedColor(value.borderColor, "#000000"),
    backgroundMode: value.backgroundMode === "color" ? "color" : "transparent",
    backgroundColor: normalizedColor(value.backgroundColor, "#ffffff"),
    brightness: finiteInRange(value.brightness, -100, 100, "Brightness"),
    contrast: finiteInRange(value.contrast, -100, 100, "Contrast"),
    saturation: finiteInRange(value.saturation, -100, 100, "Saturation"),
    redactions,
  };
}

function stateKey(value: ImageTransformState): string {
  return JSON.stringify(value);
}

export function createImageTransformHistory(initial: ImageTransformState): ImageTransformHistory {
  return { initial, current: initial, past: [] };
}

export function commitImageTransform(history: ImageTransformHistory, next: ImageTransformState): ImageTransformHistory {
  if (stateKey(history.current) === stateKey(next)) return history;
  return {
    initial: history.initial,
    current: next,
    past: [...history.past, history.current].slice(-IMAGE_TRANSFORM_HISTORY_LIMIT),
  };
}

export function undoImageTransform(history: ImageTransformHistory): ImageTransformHistory {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    initial: history.initial,
    current: previous,
    past: history.past.slice(0, -1),
  };
}

export function resetImageTransform(history: ImageTransformHistory): ImageTransformHistory {
  return { initial: history.initial, current: history.initial, past: [] };
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function tonalPixel(red: number, green: number, blue: number, state: ImageTransformState): [number, number, number] {
  const brightnessDelta = state.brightness * 2.55;
  const contrastScale = 1 + state.contrast / 100;
  const saturationScale = 1 + state.saturation / 100;
  let r = (red + brightnessDelta - 127.5) * contrastScale + 127.5;
  let g = (green + brightnessDelta - 127.5) * contrastScale + 127.5;
  let b = (blue + brightnessDelta - 127.5) * contrastScale + 127.5;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r = luma + (r - luma) * saturationScale;
  g = luma + (g - luma) * saturationScale;
  b = luma + (b - luma) * saturationScale;
  return [clampByte(r), clampByte(g), clampByte(b)];
}

function rotatedCoordinates(x: number, y: number, width: number, height: number, rotate: QuarterTurn): { x: number; y: number; width: number; height: number } {
  if (rotate === 90) return { x: height - 1 - y, y: x, width: height, height: width };
  if (rotate === 180) return { x: width - 1 - x, y: height - 1 - y, width, height };
  if (rotate === 270) return { x: y, y: width - 1 - x, width: height, height: width };
  return { x, y, width, height };
}

function outsideRoundMask(x: number, y: number, width: number, height: number): boolean {
  const nx = ((x + 0.5) - width / 2) / (width / 2);
  const ny = ((y + 0.5) - height / 2) / (height / 2);
  return nx * nx + ny * ny > 1;
}

function fillPixel(data: Uint8ClampedArray, width: number, x: number, y: number, red: number, green: number, blue: number, alpha: number): void {
  const offset = (y * width + x) * 4;
  data[offset] = red;
  data[offset + 1] = green;
  data[offset + 2] = blue;
  data[offset + 3] = alpha;
}

function compositeOverBackground(source: readonly number[], background: { r: number; g: number; b: number }): [number, number, number, number] {
  const alpha = (source[3] ?? 0) / 255;
  return [
    clampByte((source[0] ?? 0) * alpha + background.r * (1 - alpha)),
    clampByte((source[1] ?? 0) * alpha + background.g * (1 - alpha)),
    clampByte((source[2] ?? 0) * alpha + background.b * (1 - alpha)),
    255,
  ];
}

function applyRedactionRegions(content: Uint8ClampedArray, width: number, height: number, regions: readonly ImageRedactionRegion[]): void {
  for (const region of regions) {
    const xEnd = Math.min(width, region.x + region.width);
    const yEnd = Math.min(height, region.y + region.height);
    if (region.mode === "solid") {
      const color = parseHexColor(region.color);
      for (let y = region.y; y < yEnd; y += 1) {
        for (let x = region.x; x < xEnd; x += 1) fillPixel(content, width, x, y, color.r, color.g, color.b, 255);
      }
      continue;
    }
    const block = 12;
    for (let by = region.y; by < yEnd; by += block) {
      for (let bx = region.x; bx < xEnd; bx += block) {
        const blockEndX = Math.min(xEnd, bx + block);
        const blockEndY = Math.min(yEnd, by + block);
        let red = 0;
        let green = 0;
        let blue = 0;
        let alpha = 0;
        let count = 0;
        for (let y = by; y < blockEndY; y += 1) {
          for (let x = bx; x < blockEndX; x += 1) {
            const offset = (y * width + x) * 4;
            red += content[offset] ?? 0;
            green += content[offset + 1] ?? 0;
            blue += content[offset + 2] ?? 0;
            alpha += content[offset + 3] ?? 0;
            count += 1;
          }
        }
        const averaged = [red, green, blue, alpha].map((channel) => clampByte(channel / Math.max(1, count)));
        for (let y = by; y < blockEndY; y += 1) {
          for (let x = bx; x < blockEndX; x += 1) fillPixel(content, width, x, y, averaged[0]!, averaged[1]!, averaged[2]!, averaged[3]!);
        }
      }
    }
  }
}

export function applyImageTransformPixels(source: PixelFrame, requested: ImageTransformState): ImageTransformPixelResult {
  if (source.data.length !== source.width * source.height * 4) throw new ImageVisualError("INVALID_INPUT", "RGBA source length does not match source dimensions");
  const state = normalizeImageTransformState(requested, source.width, source.height);
  const crop = state.crop;
  const rotatedWidth = state.rotate === 90 || state.rotate === 270 ? crop.height : crop.width;
  const rotatedHeight = state.rotate === 90 || state.rotate === 270 ? crop.width : crop.height;
  const content = new Uint8ClampedArray(rotatedWidth * rotatedHeight * 4);

  for (let sourceY = 0; sourceY < crop.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < crop.width; sourceX += 1) {
      const sourceOffset = ((crop.y + sourceY) * source.width + crop.x + sourceX) * 4;
      const rotated = rotatedCoordinates(sourceX, sourceY, crop.width, crop.height, state.rotate);
      const targetX = state.flipHorizontal ? rotated.width - 1 - rotated.x : rotated.x;
      const targetY = state.flipVertical ? rotated.height - 1 - rotated.y : rotated.y;
      const targetOffset = (targetY * rotatedWidth + targetX) * 4;
      const tone = tonalPixel(source.data[sourceOffset] ?? 0, source.data[sourceOffset + 1] ?? 0, source.data[sourceOffset + 2] ?? 0, state);
      content[targetOffset] = tone[0];
      content[targetOffset + 1] = tone[1];
      content[targetOffset + 2] = tone[2];
      content[targetOffset + 3] = state.roundCrop && outsideRoundMask(targetX, targetY, rotatedWidth, rotatedHeight)
        ? 0
        : source.data[sourceOffset + 3] ?? 255;
    }
  }

  applyRedactionRegions(content, rotatedWidth, rotatedHeight, state.redactions);

  const width = rotatedWidth + state.border * 2;
  const height = rotatedHeight + state.border * 2;
  const data = new Uint8ClampedArray(width * height * 4);
  const borderRgb = parseHexColor(state.borderColor);
  const backgroundRgb = parseHexColor(state.backgroundColor);

  if (state.border > 0) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) fillPixel(data, width, x, y, borderRgb.r, borderRgb.g, borderRgb.b, 255);
    }
  }

  for (let y = 0; y < rotatedHeight; y += 1) {
    for (let x = 0; x < rotatedWidth; x += 1) {
      const sourceOffset = (y * rotatedWidth + x) * 4;
      const targetX = x + state.border;
      const targetY = y + state.border;
      if (state.backgroundMode === "color") {
        const rgba = compositeOverBackground([
          content[sourceOffset] ?? 0,
          content[sourceOffset + 1] ?? 0,
          content[sourceOffset + 2] ?? 0,
          content[sourceOffset + 3] ?? 0,
        ], backgroundRgb);
        fillPixel(data, width, targetX, targetY, rgba[0], rgba[1], rgba[2], rgba[3]);
      } else {
        fillPixel(
          data,
          width,
          targetX,
          targetY,
          content[sourceOffset] ?? 0,
          content[sourceOffset + 1] ?? 0,
          content[sourceOffset + 2] ?? 0,
          content[sourceOffset + 3] ?? 0,
        );
      }
    }
  }

  return {
    width,
    height,
    data,
    contentWidth: rotatedWidth,
    contentHeight: rotatedHeight,
    alphaPolicy: state.backgroundMode === "color" ? "flattened-to-background" : "preserved",
    pipeline: [
      "crop source rectangle",
      "brightness/contrast/saturation in encoded sRGB channels",
      `rotate ${state.rotate}° clockwise`,
      `flip horizontal=${state.flipHorizontal} vertical=${state.flipVertical}`,
      state.redactions.length === 0 ? "no destructive redactions" : `apply ${state.redactions.length} destructive pixel redaction region(s)`,
      state.roundCrop ? "elliptical alpha mask" : "rectangular alpha mask",
      state.backgroundMode === "color" ? `flatten alpha onto ${state.backgroundColor}` : "preserve alpha",
      `compose ${state.border}px border ${state.borderColor}`,
    ],
  };
}

export function transformPreflight(inputBytes: number, sourcePixels?: number) {
  return preflightHeavyLocalJob({
    capabilities: { "image-decode": "required", worker: "unused", wasm: "unused" },
    limits: {
      softInputBytes: 20 * 1024 * 1024,
      hardInputBytes: IMAGE_VISUAL_LIMITS.maxFileBytes,
      softWorkingSetBytes: 128 * 1024 * 1024,
      hardWorkingSetBytes: 256 * 1024 * 1024,
    },
  }, {
    inputBytes,
    ...(sourcePixels === undefined ? {} : { estimatedWorkingSetBytes: sourcePixels * 4 * 3 }),
  });
}

export async function readImageTransformSource(fileValue: Blob, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<PixelFrame> {
  const file = assertFile(fileValue);
  const preflight = transformPreflight(file.size);
  if (preflight.state === "unsupported") throw new ImageVisualError("UNSUPPORTED_BROWSER", preflight.reasons.join(" "));
  const frame = await imageDataFromFile(file, signal, progress);
  const decodedPreflight = transformPreflight(file.size, frame.width * frame.height);
  if (decodedPreflight.state === "unsupported") throw new ImageVisualError("PIXEL_LIMIT", decodedPreflight.reasons.join(" "));
  return frame;
}

export function pixelFrameToCanvas(frame: PixelFrame): HTMLCanvasElement {
  const canvas = makeCanvas(frame.width, frame.height);
  const context = get2d(canvas);
  const imageData = context.createImageData(frame.width, frame.height);
  imageData.data.set(frame.data);
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function pngMetadataChunkTypes(bytes: Uint8Array): string[] {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 12 || signature.some((value, index) => bytes[index] !== value)) throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Redaction output is not a PNG");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const metadata = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]);
  const found: string[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    if (length > bytes.length - offset - 12) throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "PNG chunk bounds are invalid");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (metadata.has(type)) found.push(type);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return found;
}

export async function transformImageLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ImageTransformOutput> {
  if (typeof input !== "object" || input === null) throw new ImageVisualError("INVALID_INPUT", "Transform input is required");
  const value = input as Record<string, unknown>;
  const file = assertFile(value.file);
  const source = await readImageTransformSource(file.blob, signal, progress);
  abortIfNeeded(signal);
  const requested = value.transform as ImageTransformState | undefined;
  if (requested === undefined) throw new ImageVisualError("INVALID_INPUT", "Transform state is required");
  const transform = normalizeImageTransformState(requested, source.width, source.height);
  progress?.({ phase: "transform", label: "Applying exact preview/export pixel pipeline" });
  const pixels = applyImageTransformPixels(source, transform);
  abortIfNeeded(signal);
  const canvas = pixelFrameToCanvas(pixels);
  const outputMime = assertOutputMime(value.mime ?? "image/png");
  if (outputMime !== "image/png") throw new ImageVisualError("INVALID_INPUT", "Direct transform workspace currently exports PNG so alpha/background behavior stays explicit");
  const blob = await outputBlob(canvas, outputMime, undefined, pixels.width, pixels.height, signal, progress);
  const outputBytes = new Uint8Array(await blob.arrayBuffer());
  const metadataChunks = pngMetadataChunkTypes(outputBytes);
  if (transform.redactions.length > 0 && metadataChunks.length > 0) {
    throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", `Redacted PNG still contains metadata-bearing chunks: ${metadataChunks.join(", ")}`);
  }
  const header = await readHeader(file, signal);
  return {
    blob,
    filename: `${normalizeName(file.name)}-trasformata.png`,
    inputMime: header.mime,
    outputMime,
    width: pixels.width,
    height: pixels.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    transform,
    alphaPolicy: pixels.alphaPolicy,
    backgroundPolicy: transform.backgroundMode === "color"
      ? `Alpha compositato esplicitamente su ${transform.backgroundColor}; output completamente opaco.`
      : "Alpha sorgente preservato; round crop rende trasparenti i pixel fuori dalla maschera.",
    pipelineVersion: IMAGE_TRANSFORM_PIPELINE_VERSION,
    pipeline: pixels.pipeline,
    redactionCount: transform.redactions.length,
    metadataPolicy: "png-reencoded-metadata-checked",
  };
}
