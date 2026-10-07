/*
 * Local file output for the marketing/media tools.
 *
 * Two rules hold everywhere in this file:
 *  - nothing leaves the device; a "download" is a Blob built from bytes the
 *    engine already produced, handed to the browser's own download flow;
 *  - a QR symbol is always drawn black on white, in every theme. That is a
 *    scannability requirement, not a styling choice, so it deliberately does
 *    not follow the light/dark canvas.
 */

export const QR_INK = "#000000";
export const QR_PAPER = "#ffffff";

function trigger(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadBlob(blob: Blob, filename: string): void {
  trigger(blob, filename);
}

export function svgBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

/** Strips a path and keeps only safe characters, so a filename can be anything. */
export function safeFilename(value: string, fallback: string, extension: string): string {
  const stem = value
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/gu, "")
    .replaceAll(/[^A-Za-z0-9._-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
    .slice(0, 48);
  return `${stem === "" ? fallback : stem}.${extension}`;
}

/**
 * Draws a QR matrix on a canvas and encodes PNG. `rows` are "0"/"1" strings;
 * the quiet zone is drawn at the same scale as the modules because a symbol
 * without it is not reliably scannable.
 */
export async function qrPngBlob(rows: readonly string[], quietZone: number, targetPixels = 1024): Promise<Blob> {
  const size = rows.length;
  const modules = size + quietZone * 2;
  const scale = Math.max(1, Math.floor(targetPixels / modules));
  const canvas = document.createElement("canvas");
  canvas.width = modules * scale;
  canvas.height = modules * scale;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("QR_PNG_EXPORT_UNAVAILABLE");
  context.fillStyle = QR_PAPER;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = QR_INK;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (rows[row]?.[column] !== "1") continue;
      context.fillRect((column + quietZone) * scale, (row + quietZone) * scale, scale, scale);
    }
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob === null) throw new Error("QR_PNG_EXPORT_UNAVAILABLE");
  return blob;
}

/** Draws a one-dimensional module string as black bars on white and exports PNG. */
export async function barcodePngBlob(
  bits: string,
  quietZoneModules: number,
  humanReadableText?: string,
  targetModulePixels = 3,
  barHeightModules = 60,
): Promise<Blob> {
  if (!/^[01]+$/u.test(bits)) throw new Error("BARCODE_PNG_INVALID_MODULES");
  const modulePixels = Math.max(1, Math.min(8, Math.floor(targetModulePixels)));
  const textPixels = humanReadableText === undefined ? 0 : 32;
  const canvas = document.createElement("canvas");
  canvas.width = (bits.length + quietZoneModules * 2) * modulePixels;
  canvas.height = barHeightModules * modulePixels + textPixels;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("BARCODE_PNG_EXPORT_UNAVAILABLE");
  context.fillStyle = QR_PAPER;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = QR_INK;
  for (let index = 0; index < bits.length; index += 1) {
    if (bits[index] !== "1") continue;
    context.fillRect((index + quietZoneModules) * modulePixels, 0, modulePixels, barHeightModules * modulePixels);
  }
  if (humanReadableText !== undefined) {
    context.font = "20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(humanReadableText, canvas.width / 2, barHeightModules * modulePixels + textPixels / 2);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob === null) throw new Error("BARCODE_PNG_EXPORT_UNAVAILABLE");
  return blob;
}

/**
 * Reads a local image file into RGBA pixels. No platform decoder is involved
 * beyond "draw this image on a canvas", which every supported browser can do.
 */
export async function imagePixelsFrom(file: File): Promise<{ readonly width: number; readonly height: number; readonly data: Uint8ClampedArray }> {
  const bitmap = await decodeImageElement(file);
  const width = "width" in bitmap ? bitmap.width : 0;
  const height = "height" in bitmap ? bitmap.height : 0;
  const source = bitmap as CanvasImageSource;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) throw new Error("QR_IMAGE_DECODER_UNAVAILABLE");
  context.drawImage(source, 0, 0);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  return { width, height, data: context.getImageData(0, 0, width, height).data };
}

async function decodeImageElement(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Some engines refuse the bitmap path for a given file but still decode
      // it as an <img>; fall through rather than failing the tool.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "sync";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
