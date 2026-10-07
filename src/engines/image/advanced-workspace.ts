import { createZip, inspectZip } from "../file-privacy";
import {
  get2d,
  imageDataFromFile,
  makeCanvas,
  outputBlob,
  readHeader,
} from "./operations";
import { pixelFrameToCanvas, type PixelFrame } from "./transform-workspace";
import {
  ImageVisualError,
  abortIfNeeded,
  assertFile,
  assertPixels,
  normalizeName,
  parseHexColor,
  rgbToHex,
  type ImageVisualProgress,
} from "./visual";

const MAX_BATCH_FILES = 24;
const MAX_SLICE_COUNT = 20;
const MAX_OVERLAP_SAMPLES = 4096;
const MAX_OVERLAP_CANDIDATES = 256;

export interface WatermarkOutput {
  readonly blob: Blob;
  readonly filename: string;
  readonly outputMime: "image/png";
  readonly width: number;
  readonly height: number;
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly overlayOrder: readonly ("image" | "text")[];
  readonly placement: { readonly xPercent: number; readonly yPercent: number; readonly opacity: number; readonly scale: number; readonly rotationDegrees: number };
  readonly alphaPolicy: string;
  readonly colorSpacePolicy: string;
  readonly privacyClaim: "visual-overlay-not-redaction";
  readonly previewExportIdentity: "same-rendered-png-blob";
}

export interface ComposeBatchItem {
  readonly index: number;
  readonly name: string;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly sourceBytes: number;
  readonly x: number;
  readonly y: number;
}

export interface ComposeBatchOutput {
  readonly blob: Blob;
  readonly filename: string;
  readonly outputMime: "image/png";
  readonly width: number;
  readonly height: number;
  readonly outputBytes: number;
  readonly mode: "horizontal" | "vertical" | "grid";
  readonly gap: number;
  readonly background: string;
  readonly items: readonly ComposeBatchItem[];
}

export interface SliceOutputItem {
  readonly index: number;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly blob: Blob;
  readonly outputMime: "image/png";
  readonly outputBytes: number;
}

export interface SliceBatchOutput {
  readonly source: { readonly name: string; readonly width: number; readonly height: number; readonly bytes: number };
  readonly direction: "horizontal" | "vertical";
  readonly count: number;
  readonly items: readonly SliceOutputItem[];
  readonly ordering: "source-leading-edge-to-trailing-edge";
  readonly naming: string;
  readonly zipBlob: Blob;
  readonly zipFilename: string;
  readonly zipCompression: "store";
  readonly zipEntries: readonly string[];
  readonly zipVerified: true;
}

export interface SlicePlanItem {
  readonly index: number;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

export interface ScreenshotOverlapSuggestion {
  readonly direction: "vertical" | "horizontal";
  readonly suggestedOverlap: number;
  readonly confidence: number;
  readonly secondBestConfidence: number;
  readonly confidenceMargin: number;
  readonly ambiguous: boolean;
  readonly policy: string;
  readonly previewBlob: Blob;
  readonly previewMime: "image/png";
  readonly previewWidth: number;
  readonly previewHeight: number;
}

export interface ScreenshotOverlapMetrics {
  readonly suggestedOverlap: number;
  readonly confidence: number;
  readonly secondBestConfidence: number;
  readonly confidenceMargin: number;
  readonly ambiguous: boolean;
}

export interface ScreenshotStitchOutput {
  readonly blob: Blob;
  readonly filename: string;
  readonly outputMime: "image/png";
  readonly width: number;
  readonly height: number;
  readonly direction: "vertical" | "horizontal";
  readonly overlap: number;
  readonly crossOffset: number;
  readonly order: readonly [string, string];
  readonly cropPolicy: string;
  readonly manualCorrection: true;
}

export interface PerspectivePoint {
  readonly x: number;
  readonly y: number;
}

export interface PerspectiveCorners {
  readonly topLeft: PerspectivePoint;
  readonly topRight: PerspectivePoint;
  readonly bottomRight: PerspectivePoint;
  readonly bottomLeft: PerspectivePoint;
}

export interface PerspectivePixelOutput extends PixelFrame {
  readonly corners: PerspectiveCorners;
  readonly boundary: { readonly polygon: readonly PerspectivePoint[]; readonly sourceWidth: number; readonly sourceHeight: number };
  readonly sampling: "inverse-homography-bilinear-rgba";
}

export interface PerspectiveOutput {
  readonly blob: Blob;
  readonly filename: string;
  readonly outputMime: "image/png";
  readonly width: number;
  readonly height: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly corners: PerspectiveCorners;
  readonly boundary: PerspectivePixelOutput["boundary"];
  readonly sampling: PerspectivePixelOutput["sampling"];
}

function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new ImageVisualError("INVALID_INPUT", "Image workspace input is required");
  return value as Record<string, unknown>;
}

function finite(value: unknown, fallback: number, minimum: number, maximum: number, label: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new ImageVisualError("INVALID_INPUT", `${label} must be from ${minimum} to ${maximum}`);
  return parsed;
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number, label: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new ImageVisualError("INVALID_INPUT", `${label} must be a whole number from ${minimum} to ${maximum}`);
  return parsed;
}

function imageFiles(value: unknown): ReturnType<typeof assertFile>[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BATCH_FILES) throw new ImageVisualError("INVALID_INPUT", `Choose 1 to ${MAX_BATCH_FILES} images`);
  return value.map((entry) => assertFile(entry));
}

async function frameFor(fileValue: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<{ file: ReturnType<typeof assertFile>; frame: PixelFrame }> {
  const file = assertFile(fileValue);
  return { file, frame: await imageDataFromFile(file, signal, progress) };
}

function drawFrame(context: CanvasRenderingContext2D, frame: PixelFrame, x = 0, y = 0): void {
  context.drawImage(pixelFrameToCanvas(frame), x, y);
}

async function verifiedStoreZip(items: readonly { filename: string; blob: Blob; outputMime: string }[], zipFilename: string, signal?: AbortSignal) {
  if (typeof File === "undefined") throw new ImageVisualError("UNSUPPORTED_BROWSER", "File API is required for local ZIP packaging");
  const files = items.map((item) => new File([item.blob], item.filename, { type: item.outputMime }));
  const archive = await createZip({ files }, signal);
  if (!("blob" in archive) || !(archive.blob instanceof Blob) || archive.compression !== "store") throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "STORE ZIP creation did not return a verifiable archive");
  const archiveFile = new File([archive.blob], zipFilename, { type: "application/zip" });
  const inspected = await inspectZip({ files: [archiveFile] }, signal);
  if (!("entries" in inspected) || !Array.isArray(inspected.entries)) throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "ZIP central directory is unavailable");
  const expected = items.map((item) => item.filename);
  const actual = inspected.entries.map((entry) => entry.path);
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index]) || inspected.entries.some((entry) => entry.method !== 0)) {
    throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "ZIP entries or methods do not exactly match the preview list");
  }
  return { blob: archive.blob, entries: expected };
}

export async function composeWatermarkLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<WatermarkOutput> {
  const value = recordOf(input);
  const { file, frame } = await frameFor(value.file, signal, progress);
  const overlayFileValue = value.overlayFile;
  const text = typeof value.text === "string" ? value.text : "";
  if (overlayFileValue === undefined && text.trim() === "") throw new ImageVisualError("INVALID_INPUT", "Add watermark text or an overlay image");
  const opacity = finite(value.opacity, 0.7, 0.01, 1, "Overlay opacity");
  const scale = finite(value.scale, 0.25, 0.02, 4, "Overlay scale");
  const rotationDegrees = finite(value.rotationDegrees, 0, -180, 180, "Overlay rotation");
  const xPercent = finite(value.xPercent, 50, 0, 100, "Horizontal position");
  const yPercent = finite(value.yPercent, 50, 0, 100, "Vertical position");
  const fontSize = integer(value.fontSize, 32, 8, 512, "Font size");
  const textColor = rgbToHex(...Object.values(parseHexColor(typeof value.textColor === "string" ? value.textColor : "#ffffff")) as [number, number, number]);
  const canvas = pixelFrameToCanvas(frame);
  const context = get2d(canvas);
  const overlayOrder: Array<"image" | "text"> = [];
  const centerX = frame.width * xPercent / 100;
  const centerY = frame.height * yPercent / 100;

  if (overlayFileValue !== undefined) {
    const overlay = await frameFor(overlayFileValue, signal, progress);
    const width = Math.max(1, Math.round(overlay.frame.width * scale));
    const height = Math.max(1, Math.round(overlay.frame.height * scale));
    context.save();
    context.globalAlpha = opacity;
    context.translate(centerX, centerY);
    context.rotate(rotationDegrees * Math.PI / 180);
    context.drawImage(pixelFrameToCanvas(overlay.frame), -width / 2, -height / 2, width, height);
    context.restore();
    overlayOrder.push("image");
  }

  if (text.trim() !== "") {
    context.save();
    context.globalAlpha = opacity;
    context.translate(centerX, centerY);
    context.rotate(rotationDegrees * Math.PI / 180);
    context.fillStyle = textColor;
    context.font = `${fontSize}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 0, 0);
    context.restore();
    overlayOrder.push("text");
  }

  const blob = await outputBlob(canvas, "image/png", undefined, frame.width, frame.height, signal, progress);
  return {
    blob,
    filename: `${normalizeName(file.name)}-overlay.png`,
    outputMime: "image/png",
    width: frame.width,
    height: frame.height,
    sourceBytes: file.size,
    outputBytes: blob.size,
    overlayOrder,
    placement: { xPercent, yPercent, opacity, scale, rotationDegrees },
    alphaPolicy: "Canvas source-over compositing; PNG preserves resulting alpha. Opacity changes only overlay contribution.",
    colorSpacePolicy: "Canvas 2D default browser color space (sRGB-compatible); no linear-light or embedded-profile preservation claim.",
    privacyClaim: "visual-overlay-not-redaction",
    previewExportIdentity: "same-rendered-png-blob",
  };
}

export async function composeImageCollectionLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ComposeBatchOutput> {
  const value = recordOf(input);
  const files = imageFiles(value.files);
  const mode = value.mode === "horizontal" || value.mode === "vertical" || value.mode === "grid" ? value.mode : "grid";
  const gap = integer(value.gap, 0, 0, 256, "Gap");
  const backgroundRgb = parseHexColor(typeof value.background === "string" ? value.background : "#ffffff");
  const background = rgbToHex(backgroundRgb.r, backgroundRgb.g, backgroundRgb.b);
  const decoded = [];
  for (const file of files) decoded.push({ file, frame: await imageDataFromFile(file, signal, progress) });
  const columns = mode === "grid" ? integer(value.columns, Math.ceil(Math.sqrt(decoded.length)), 1, decoded.length, "Grid columns") : 1;
  const cellWidth = Math.max(...decoded.map((entry) => entry.frame.width));
  const cellHeight = Math.max(...decoded.map((entry) => entry.frame.height));
  const rows = Math.ceil(decoded.length / columns);
  const width = mode === "horizontal"
    ? decoded.reduce((sum, entry) => sum + entry.frame.width, 0) + gap * (decoded.length - 1)
    : mode === "vertical" ? cellWidth : cellWidth * columns + gap * (columns - 1);
  const height = mode === "vertical"
    ? decoded.reduce((sum, entry) => sum + entry.frame.height, 0) + gap * (decoded.length - 1)
    : mode === "horizontal" ? cellHeight : cellHeight * rows + gap * (rows - 1);
  assertPixels(width, height, "combined image");
  const canvas = makeCanvas(width, height);
  const context = get2d(canvas);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  const items: ComposeBatchItem[] = [];
  let cursorX = 0;
  let cursorY = 0;
  decoded.forEach((entry, index) => {
    let x = 0;
    let y = 0;
    if (mode === "horizontal") {
      x = cursorX;
      y = Math.floor((height - entry.frame.height) / 2);
      cursorX += entry.frame.width + gap;
    } else if (mode === "vertical") {
      x = Math.floor((width - entry.frame.width) / 2);
      y = cursorY;
      cursorY += entry.frame.height + gap;
    } else {
      const column = index % columns;
      const row = Math.floor(index / columns);
      x = column * (cellWidth + gap) + Math.floor((cellWidth - entry.frame.width) / 2);
      y = row * (cellHeight + gap) + Math.floor((cellHeight - entry.frame.height) / 2);
    }
    drawFrame(context, entry.frame, x, y);
    items.push({ index: index + 1, name: entry.file.name, sourceWidth: entry.frame.width, sourceHeight: entry.frame.height, sourceBytes: entry.file.size, x, y });
  });
  const blob = await outputBlob(canvas, "image/png", undefined, width, height, signal, progress);
  return { blob, filename: `immagini-${mode}.png`, outputMime: "image/png", width, height, outputBytes: blob.size, mode, gap, background, items };
}

export function planSlices(width: number, height: number, countValue: unknown, direction: "horizontal" | "vertical"): readonly SlicePlanItem[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new ImageVisualError("INVALID_INPUT", "Slice source dimensions must be positive integers");
  const axisLength = direction === "horizontal" ? width : height;
  const count = integer(countValue, 3, 2, Math.min(MAX_SLICE_COUNT, axisLength), "Slice count");
  const base = Math.floor(axisLength / count);
  const remainder = axisLength % count;
  const plan: SlicePlanItem[] = [];
  let offset = 0;
  for (let index = 0; index < count; index += 1) {
    const extent = base + (index < remainder ? 1 : 0);
    const sliceWidth = direction === "horizontal" ? extent : width;
    const sliceHeight = direction === "vertical" ? extent : height;
    const x = direction === "horizontal" ? offset : 0;
    const y = direction === "vertical" ? offset : 0;
    plan.push({ index: index + 1, width: sliceWidth, height: sliceHeight, x, y });
    offset += extent;
  }
  if (offset !== axisLength) throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Slice partition did not cover the full source axis exactly");
  return plan;
}

export async function sliceImageLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<SliceBatchOutput> {
  const value = recordOf(input);
  const { file, frame } = await frameFor(value.file, signal, progress);
  const direction = value.direction === "vertical" ? "vertical" : "horizontal";
  const plan = planSlices(frame.width, frame.height, value.count, direction);
  const count = plan.length;
  const sourceCanvas = pixelFrameToCanvas(frame);
  const items: SliceOutputItem[] = [];
  for (const slice of plan) {
    abortIfNeeded(signal);
    const { index, width, height, x, y } = slice;
    const canvas = makeCanvas(width, height);
    get2d(canvas).drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height);
    const blob = await outputBlob(canvas, "image/png", undefined, width, height, signal, progress);
    const filename = `${normalizeName(file.name)}-slice-${String(index).padStart(2, "0")}-of-${String(count).padStart(2, "0")}-${width}x${height}.png`;
    items.push({ index, filename, width, height, x, y, blob, outputMime: "image/png", outputBytes: blob.size });
  }
  const zipFilename = `${normalizeName(file.name)}-slices.zip`;
  const zip = await verifiedStoreZip(items, zipFilename, signal);
  return {
    source: { name: file.name, width: frame.width, height: frame.height, bytes: file.size },
    direction,
    count,
    items,
    ordering: "source-leading-edge-to-trailing-edge",
    naming: "<source>-slice-<NN>-of-<NN>-<width>x<height>.png",
    zipBlob: zip.blob,
    zipFilename,
    zipCompression: "store",
    zipEntries: zip.entries,
    zipVerified: true,
  };
}

function overlapScore(first: PixelFrame, second: PixelFrame, direction: "vertical" | "horizontal", overlap: number): number {
  const cross = direction === "vertical" ? Math.min(first.width, second.width) : Math.min(first.height, second.height);
  const area = cross * overlap;
  const samples = Math.min(MAX_OVERLAP_SAMPLES, area);
  let total = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const position = Math.floor(sample * area / samples);
    const along = Math.floor(position / cross);
    const across = position % cross;
    const firstX = direction === "vertical" ? across : first.width - overlap + along;
    const firstY = direction === "vertical" ? first.height - overlap + along : across;
    const secondX = direction === "vertical" ? across : along;
    const secondY = direction === "vertical" ? along : across;
    const firstOffset = (firstY * first.width + firstX) * 4;
    const secondOffset = (secondY * second.width + secondX) * 4;
    total += Math.abs((first.data[firstOffset] ?? 0) - (second.data[secondOffset] ?? 0));
    total += Math.abs((first.data[firstOffset + 1] ?? 0) - (second.data[secondOffset + 1] ?? 0));
    total += Math.abs((first.data[firstOffset + 2] ?? 0) - (second.data[secondOffset + 2] ?? 0));
  }
  return samples === 0 ? 0 : 1 - total / (samples * 3 * 255);
}

function overlapCandidates(maxOverlap: number): readonly number[] {
  if (maxOverlap <= MAX_OVERLAP_CANDIDATES) return Array.from({ length: maxOverlap }, (_unused, index) => index + 1);
  return [...new Set(Array.from({ length: MAX_OVERLAP_CANDIDATES }, (_unused, index) => Math.max(1, Math.round((index + 1) * maxOverlap / MAX_OVERLAP_CANDIDATES))))];
}

export function suggestScreenshotOverlapFromFrames(first: PixelFrame, second: PixelFrame, direction: "vertical" | "horizontal"): ScreenshotOverlapMetrics {
  if (first.width < 1 || first.height < 1 || second.width < 1 || second.height < 1) throw new ImageVisualError("INVALID_INPUT", "Screenshot dimensions must be positive");
  const maxOverlap = Math.max(1, Math.min(direction === "vertical" ? first.height : first.width, direction === "vertical" ? second.height : second.width) - 1);
  const ranked = overlapCandidates(maxOverlap)
    .map((overlap) => ({ overlap, score: overlapScore(first, second, direction, overlap) }))
    .sort((left, right) => right.score - left.score || right.overlap - left.overlap);
  const best = ranked[0]!;
  const secondBest = ranked[1]?.score ?? 0;
  const margin = best.score - secondBest;
  return {
    suggestedOverlap: best.overlap,
    confidence: best.score,
    secondBestConfidence: secondBest,
    confidenceMargin: margin,
    ambiguous: best.score < 0.92 || margin < 0.02,
  };
}

async function overlapPreview(first: PixelFrame, second: PixelFrame, direction: "vertical" | "horizontal", overlap: number, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void) {
  const width = direction === "vertical" ? Math.min(first.width, second.width) : overlap;
  const height = direction === "vertical" ? overlap : Math.min(first.height, second.height);
  const canvas = makeCanvas(width, height);
  const context = get2d(canvas);
  const firstCanvas = pixelFrameToCanvas(first);
  const secondCanvas = pixelFrameToCanvas(second);
  if (direction === "vertical") {
    context.drawImage(firstCanvas, 0, first.height - overlap, width, overlap, 0, 0, width, height);
    context.globalAlpha = 0.5;
    context.drawImage(secondCanvas, 0, 0, width, overlap, 0, 0, width, height);
  } else {
    context.drawImage(firstCanvas, first.width - overlap, 0, overlap, height, 0, 0, width, height);
    context.globalAlpha = 0.5;
    context.drawImage(secondCanvas, 0, 0, overlap, height, 0, 0, width, height);
  }
  context.globalAlpha = 1;
  return { blob: await outputBlob(canvas, "image/png", undefined, width, height, signal, progress), width, height };
}

export async function suggestScreenshotOverlapLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ScreenshotOverlapSuggestion> {
  const value = recordOf(input);
  const direction = value.direction === "horizontal" ? "horizontal" : "vertical";
  const first = await frameFor(value.first, signal, progress);
  const second = await frameFor(value.second, signal, progress);
  const metrics = suggestScreenshotOverlapFromFrames(first.frame, second.frame, direction);
  const preview = await overlapPreview(first.frame, second.frame, direction, metrics.suggestedOverlap, signal, progress);
  return {
    direction,
    ...metrics,
    policy: "Suggestion only: no pixels are discarded until the user explicitly applies an overlap. Ambiguous means score <0.92 or best-vs-second margin <0.02.",
    previewBlob: preview.blob,
    previewMime: "image/png",
    previewWidth: preview.width,
    previewHeight: preview.height,
  };
}

export async function stitchScreenshotsLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<ScreenshotStitchOutput> {
  const value = recordOf(input);
  const direction = value.direction === "horizontal" ? "horizontal" : "vertical";
  const first = await frameFor(value.first, signal, progress);
  const second = await frameFor(value.second, signal, progress);
  const maxOverlap = Math.min(direction === "vertical" ? first.frame.height : first.frame.width, direction === "vertical" ? second.frame.height : second.frame.width) - 1;
  const overlap = integer(value.overlap, 0, 0, Math.max(0, maxOverlap), "Manual overlap");
  const crossLimit = direction === "vertical" ? Math.max(first.frame.width, second.frame.width) : Math.max(first.frame.height, second.frame.height);
  const crossOffset = integer(value.crossOffset, 0, -crossLimit, crossLimit, "Cross-axis offset");
  const firstCanvas = pixelFrameToCanvas(first.frame);
  const secondCanvas = pixelFrameToCanvas(second.frame);
  let width: number;
  let height: number;
  let firstX = 0;
  let firstY = 0;
  let secondX = 0;
  let secondY = 0;
  if (direction === "vertical") {
    const minX = Math.min(0, crossOffset);
    const maxX = Math.max(first.frame.width, crossOffset + second.frame.width);
    width = maxX - minX;
    height = first.frame.height + second.frame.height - overlap;
    firstX = -minX;
    secondX = crossOffset - minX;
    secondY = first.frame.height - overlap;
  } else {
    const minY = Math.min(0, crossOffset);
    const maxY = Math.max(first.frame.height, crossOffset + second.frame.height);
    width = first.frame.width + second.frame.width - overlap;
    height = maxY - minY;
    firstY = -minY;
    secondX = first.frame.width - overlap;
    secondY = crossOffset - minY;
  }
  assertPixels(width, height, "stitched screenshot");
  const canvas = makeCanvas(width, height);
  const context = get2d(canvas);
  context.clearRect(0, 0, width, height);
  context.drawImage(firstCanvas, firstX, firstY);
  if (direction === "vertical") {
    context.drawImage(secondCanvas, 0, overlap, second.frame.width, second.frame.height - overlap, secondX, secondY + overlap, second.frame.width, second.frame.height - overlap);
  } else {
    context.drawImage(secondCanvas, overlap, 0, second.frame.width - overlap, second.frame.height, secondX + overlap, secondY, second.frame.width - overlap, second.frame.height);
  }
  const blob = await outputBlob(canvas, "image/png", undefined, width, height, signal, progress);
  return {
    blob,
    filename: `${normalizeName(first.file.name)}-${normalizeName(second.file.name)}-stitch.png`,
    outputMime: "image/png",
    width,
    height,
    direction,
    overlap,
    crossOffset,
    order: [first.file.name, second.file.name],
    cropPolicy: `First image is preserved whole. Exactly ${overlap}px are removed from the leading ${direction === "vertical" ? "top" : "left"} edge of the second image; cross-axis offset=${crossOffset}px.`,
    manualCorrection: true,
  };
}

function point(value: unknown, label: string, width: number, height: number): PerspectivePoint {
  if (typeof value !== "object" || value === null) throw new ImageVisualError("INVALID_INPUT", `${label} corner is required`);
  const record = value as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > width - 1 || y > height - 1) throw new ImageVisualError("INVALID_PERSPECTIVE_GEOMETRY", `${label} corner must stay inside the source image`);
  return { x, y };
}

function cross(a: PerspectivePoint, b: PerspectivePoint, c: PerspectivePoint): number {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

function polygonArea(points: readonly PerspectivePoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

export function normalizePerspectiveCorners(value: unknown, width: number, height: number): PerspectiveCorners {
  const record = recordOf(value);
  const corners: PerspectiveCorners = {
    topLeft: point(record.topLeft, "Top-left", width, height),
    topRight: point(record.topRight, "Top-right", width, height),
    bottomRight: point(record.bottomRight, "Bottom-right", width, height),
    bottomLeft: point(record.bottomLeft, "Bottom-left", width, height),
  };
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft] as const;
  const signs = points.map((current, index) => cross(current, points[(index + 1) % 4]!, points[(index + 2) % 4]!));
  if (signs.some((value) => Math.abs(value) < 1e-6) || !(signs.every((value) => value > 0) || signs.every((value) => value < 0))) {
    throw new ImageVisualError("INVALID_PERSPECTIVE_GEOMETRY", "Perspective corners are self-crossing, concave, or degenerate");
  }
  if (polygonArea(points) < 1) throw new ImageVisualError("INVALID_PERSPECTIVE_GEOMETRY", "Perspective quadrilateral area is too small");
  return corners;
}

function distance(a: PerspectivePoint, b: PerspectivePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function solveLinear(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    if (Math.abs(augmented[pivot]![column]!) < 1e-12) throw new ImageVisualError("INVALID_PERSPECTIVE_GEOMETRY", "Perspective transform matrix is degenerate");
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    for (let index = column; index <= size; index += 1) augmented[column]![index] = augmented[column]![index]! / divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let index = column; index <= size; index += 1) augmented[row]![index] = augmented[row]![index]! - factor * augmented[column]![index]!;
    }
  }
  return augmented.map((row) => row[size]!);
}

function homographyFor(corners: PerspectiveCorners): readonly number[] {
  const destinations = [
    { u: 0, v: 0, point: corners.topLeft },
    { u: 1, v: 0, point: corners.topRight },
    { u: 1, v: 1, point: corners.bottomRight },
    { u: 0, v: 1, point: corners.bottomLeft },
  ];
  const matrix: number[][] = [];
  const vector: number[] = [];
  for (const { u, v, point: target } of destinations) {
    matrix.push([u, v, 1, 0, 0, 0, -target.x * u, -target.x * v]);
    vector.push(target.x);
    matrix.push([0, 0, 0, u, v, 1, -target.y * u, -target.y * v]);
    vector.push(target.y);
  }
  return solveLinear(matrix, vector);
}

function bilinear(source: PixelFrame, x: number, y: number, channel: number): number {
  const clampedX = Math.max(0, Math.min(source.width - 1, x));
  const clampedY = Math.max(0, Math.min(source.height - 1, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(source.width - 1, x0 + 1);
  const y1 = Math.min(source.height - 1, y0 + 1);
  const tx = clampedX - x0;
  const ty = clampedY - y0;
  const sample = (px: number, py: number) => source.data[(py * source.width + px) * 4 + channel] ?? 0;
  const top = sample(x0, y0) * (1 - tx) + sample(x1, y0) * tx;
  const bottom = sample(x0, y1) * (1 - tx) + sample(x1, y1) * tx;
  return Math.round(top * (1 - ty) + bottom * ty);
}

export function perspectiveTransformPixels(source: PixelFrame, requested: unknown): PerspectivePixelOutput {
  const corners = normalizePerspectiveCorners(requested, source.width, source.height);
  const width = Math.max(1, Math.round((distance(corners.topLeft, corners.topRight) + distance(corners.bottomLeft, corners.bottomRight)) / 2) + 1);
  const height = Math.max(1, Math.round((distance(corners.topLeft, corners.bottomLeft) + distance(corners.topRight, corners.bottomRight)) / 2) + 1);
  assertPixels(width, height, "perspective output");
  const h = homographyFor(corners);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const v = height === 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = width === 1 ? 0 : x / (width - 1);
      const denominator = h[6]! * u + h[7]! * v + 1;
      const sourceX = (h[0]! * u + h[1]! * v + h[2]!) / denominator;
      const sourceY = (h[3]! * u + h[4]! * v + h[5]!) / denominator;
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) data[offset + channel] = bilinear(source, sourceX, sourceY, channel);
    }
  }
  return {
    width,
    height,
    data,
    corners,
    boundary: { polygon: [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft], sourceWidth: source.width, sourceHeight: source.height },
    sampling: "inverse-homography-bilinear-rgba",
  };
}

export async function straightenPerspectiveLocal(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<PerspectiveOutput> {
  const value = recordOf(input);
  const { file, frame } = await frameFor(value.file, signal, progress);
  const pixels = perspectiveTransformPixels(frame, value.corners);
  const canvas = pixelFrameToCanvas(pixels);
  const blob = await outputBlob(canvas, "image/png", undefined, pixels.width, pixels.height, signal, progress);
  await readHeader(file, signal);
  return {
    blob,
    filename: `${normalizeName(file.name)}-prospettiva.png`,
    outputMime: "image/png",
    width: pixels.width,
    height: pixels.height,
    sourceWidth: frame.width,
    sourceHeight: frame.height,
    corners: pixels.corners,
    boundary: pixels.boundary,
    sampling: pixels.sampling,
  };
}
