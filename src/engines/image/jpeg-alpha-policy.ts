/** Shared browser JPEG alpha policy for conversion and #047 compression. */
import { ImageVisualError, parseHexColor, rgbToHex } from "./visual";
import { bitmapCanvas, get2d, makeCanvas, type OutputMime } from "./operations";

function canvasTransparency(canvas: HTMLCanvasElement): boolean {
  const pixels = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if ((pixels[index] ?? 255) < 255) return true;
  }
  return false;
}

export function conversionCanvas(bitmap: ImageBitmap, mime: OutputMime, background: unknown): {
  readonly canvas: HTMLCanvasElement;
  readonly sourceHadAlpha: boolean;
  readonly background: string | null;
  readonly alphaPolicy: "preserved" | "opaque-source" | "flattened-on-background";
} {
  const sourceCanvas = bitmapCanvas(bitmap);
  const sourceHadAlpha = canvasTransparency(sourceCanvas);
  if (mime !== "image/jpeg") {
    return { canvas: sourceCanvas, sourceHadAlpha, background: null, alphaPolicy: sourceHadAlpha ? "preserved" : "opaque-source" };
  }
  if (!sourceHadAlpha) {
    return { canvas: sourceCanvas, sourceHadAlpha, background: null, alphaPolicy: "opaque-source" };
  }
  if (typeof background !== "string" || background.trim() === "") {
    throw new ImageVisualError("JPEG_ALPHA_BACKGROUND_REQUIRED", "Transparent pixels require an explicit JPEG background color");
  }
  const color = parseHexColor(background);
  const backgroundHex = rgbToHex(color.r, color.g, color.b);
  const canvas = makeCanvas(bitmap.width, bitmap.height);
  const context = get2d(canvas);
  context.fillStyle = backgroundHex;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  return { canvas, sourceHadAlpha, background: backgroundHex, alphaPolicy: "flattened-on-background" };
}

/** Compression has no background picker: prevent silent Canvas alpha loss. */
export function refuseTransparentJpeg(bitmap: ImageBitmap): void {
  const canvas = bitmapCanvas(bitmap);
  try {
    if (canvasTransparency(canvas)) {
      throw new ImageVisualError("JPEG_ALPHA_BACKGROUND_REQUIRED", "JPEG non conserva la trasparenza: usa la conversione formato con uno sfondo esplicito");
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
