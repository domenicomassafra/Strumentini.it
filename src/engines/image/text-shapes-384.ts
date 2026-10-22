import { imageDataFromFile, outputBlob, readHeader } from "./operations";
import { pixelFrameToCanvas } from "./transform-workspace";
import {
  ImageVisualError, abortIfNeeded, assertFile, normalizeName, parseHexColor,
  type ImageVisualProgress,
} from "./visual";

const MAX_LAYERS = 16;
const MAX_PIXELS = 2_000_000; // Same conservative bound as STR-381's pending compositor.
const RTL = /[\u0590-\u08ff\ufb1d-\ufeff]/u;
const EMOJI = /[\p{Extended_Pictographic}\ufe0f\u200d]/u;
const FAMILIES = ["sans-serif", "serif", "monospace"] as const;

interface CommonLayer {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly opacity: number;
  readonly visible: boolean;
  readonly fill: string;
}

export type TextShapeLayer384 = CommonLayer & (
  | { readonly type: "text"; readonly text: string; readonly fontSize: number; readonly fontFamily: typeof FAMILIES[number]; readonly direction: "ltr" }
  | { readonly type: "rectangle" | "ellipse"; readonly width: number; readonly height: number }
);

export interface TextShapesOutput384 {
  readonly blob: Blob;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly outputMime: "image/png";
  readonly layers: readonly TextShapeLayer384[];
  readonly exportPolicy: "same-rendered-png-blob";
  readonly fontPolicy: string;
  readonly vectorPolicy: "raster-only";
}

function invalid(reason: string): never {
  throw new ImageVisualError("INVALID_INPUT", reason);
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) invalid(`${label} must be an integer in ${min}..${max}`);
  return Number(value);
}

/** Validates the complete layer stack before drawing even the first layer. */
export function validateTextShapes384(layers: unknown, width: number, height: number): readonly TextShapeLayer384[] {
  integer(width, 1, 8192, "Canvas width");
  integer(height, 1, 8192, "Canvas height");
  if (width * height > MAX_PIXELS) throw new ImageVisualError("PIXEL_LIMIT", "Canvas exceeds 2 million pixels");
  if (!Array.isArray(layers) || layers.length < 1 || layers.length > MAX_LAYERS) invalid("Provide 1 to 16 layers");
  const ids = new Set<string>();
  return layers.map((entry: unknown): TextShapeLayer384 => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) invalid("Layer must be an object");
    const layer = entry as Record<string, unknown>;
    if (typeof layer.id !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/u.test(layer.id) || ids.has(layer.id)) invalid("Layer IDs must be unique and safe");
    ids.add(layer.id);
    const x = integer(layer.x, 0, width - 1, "Layer x");
    const y = integer(layer.y, 0, height - 1, "Layer y");
    if (layer.visible !== true && layer.visible !== false) invalid("Layer visibility must be explicit");
    if (typeof layer.opacity !== "number" || !Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) invalid("Opacity must be between 0 and 1");
    if (typeof layer.fill !== "string") invalid("Fill must be a hex RGB color");
    parseHexColor(layer.fill);
    const common = { id: layer.id, x, y, visible: layer.visible, opacity: layer.opacity, fill: layer.fill };
    if (layer.type === "rectangle" || layer.type === "ellipse") {
      return { ...common, type: layer.type, width: integer(layer.width, 1, 8192, "Shape width"), height: integer(layer.height, 1, 8192, "Shape height") };
    }
    if (layer.type !== "text") invalid("Only text, rectangle and ellipse layers are supported");
    if (typeof layer.text !== "string" || layer.text.length < 1 || layer.text.length > 240 || /[\u0000-\u001f\u007f]/u.test(layer.text)) invalid("Text must be one line of 1..240 characters");
    if (EMOJI.test(layer.text)) throw new ImageVisualError("UNSUPPORTED_EMOJI", "Emoji/color glyph export cannot be audited; remove emoji");
    if (layer.direction !== "ltr" || RTL.test(layer.text)) throw new ImageVisualError("UNSUPPORTED_RTL", "RTL or bidirectional layout is not yet verified");
    if (!FAMILIES.includes(layer.fontFamily as typeof FAMILIES[number])) throw new ImageVisualError("MISSING_FONT", "Only browser generic sans-serif, serif or monospace are accepted; custom font availability cannot be proven");
    return { ...common, type: "text", text: layer.text, fontSize: integer(layer.fontSize, 8, 512, "Font size"), fontFamily: layer.fontFamily as typeof FAMILIES[number], direction: "ltr" };
  });
}

export async function composeTextShapes384(input: unknown, signal?: AbortSignal, progress?: (value: ImageVisualProgress) => void): Promise<TextShapesOutput384> {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Image and layers are required");
  const value = input as Record<string, unknown>;
  const source = assertFile(value.file);
  const header = await readHeader(source, signal);
  const layers = validateTextShapes384(value.layers, header.width, header.height);
  abortIfNeeded(signal);
  const frame = await imageDataFromFile(source, signal, progress);
  if (frame.width !== header.width || frame.height !== header.height) invalid("Decoded dimensions differ from image header");
  const canvas = pixelFrameToCanvas(frame); // Copy: the original bytes and RGBA frame remain intact.
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageVisualError("UNSUPPORTED_BROWSER", "Canvas 2D is required");
  for (const layer of layers) {
    abortIfNeeded(signal);
    if (!layer.visible || layer.opacity === 0) continue;
    ctx.save();
    try {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = layer.fill;
      if (layer.type === "rectangle") ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      else if (layer.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(layer.x + layer.width / 2, layer.y + layer.height / 2, layer.width / 2, layer.height / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
        ctx.direction = "ltr";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(layer.text, layer.x, layer.y);
      }
    } finally {
      ctx.restore();
    }
  }
  const blob = await outputBlob(canvas, "image/png", undefined, frame.width, frame.height, signal, progress);
  return {
    blob, filename: `${normalizeName(source.name)}-text-shapes.png`, width: frame.width, height: frame.height,
    outputMime: "image/png", layers, exportPolicy: "same-rendered-png-blob", vectorPolicy: "raster-only",
    fontPolicy: "Only generic browser fonts. No custom fonts, emoji or RTL; raster PNG embeds pixels, not fonts or vector shapes.",
  };
}
