export const IMAGE_LIMITS = {
  maxInputBytes: 40 * 1024 * 1024,
  maxSourcePixels: 16_000_000,
  maxOutputPixels: 16_000_000,
  maxDimension: 8_192,
  maxEstimatedDecodedBytes: 96 * 1024 * 1024,
} as const;

export type ImageResizeErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_TYPE"
  | "CORRUPT_IMAGE"
  | "TRUNCATED_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "OUTPUT_TOO_LARGE"
  | "MEMORY_LIMIT"
  | "UNSUPPORTED_BROWSER"
  | "ENCODE_FAILED"
  | "OUTPUT_VALIDATION_FAILED";

export class ImageResizeError extends Error {
  constructor(readonly code: ImageResizeErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "ImageResizeError";
  }
}

export interface ResizePlan {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
}

function assertDimension(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > IMAGE_LIMITS.maxDimension) {
    throw new ImageResizeError(
      "INVALID_INPUT",
      `${label} must be an integer from 1 to ${IMAGE_LIMITS.maxDimension}`,
    );
  }
  return value;
}

export function computeResizePlan(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: "contain" | "cover",
): ResizePlan {
  assertDimension(sourceWidth, "Source width");
  assertDimension(sourceHeight, "Source height");
  assertDimension(targetWidth, "Target width");
  assertDimension(targetHeight, "Target height");

  if (fit === "contain") {
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    return {
      sourceX: 0,
      sourceY: 0,
      sourceWidth,
      sourceHeight,
      outputWidth: Math.max(1, Math.round(sourceWidth * scale)),
      outputHeight: Math.max(1, Math.round(sourceHeight * scale)),
    };
  }

  if (fit !== "cover") {
    throw new ImageResizeError("INVALID_INPUT", "Fit must be contain or cover");
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;
  if (sourceAspect > targetAspect) {
    const cropWidth = sourceHeight * targetAspect;
    return {
      sourceX: (sourceWidth - cropWidth) / 2,
      sourceY: 0,
      sourceWidth: cropWidth,
      sourceHeight,
      outputWidth: targetWidth,
      outputHeight: targetHeight,
    };
  }

  const cropHeight = sourceWidth / targetAspect;
  return {
    sourceX: 0,
    sourceY: (sourceHeight - cropHeight) / 2,
    sourceWidth,
    sourceHeight: cropHeight,
    outputWidth: targetWidth,
    outputHeight: targetHeight,
  };
}

export function estimateDecodedBytes(sourcePixels: number, outputPixels: number): number {
  // Source bitmap + destination canvas + independent verification decode + allocator headroom.
  return Math.ceil((sourcePixels + outputPixels * 2) * 4 * 1.25);
}

export function preflightAllocation(
  fileBytes: number,
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
) {
  if (!Number.isFinite(fileBytes) || fileBytes < 1) {
    throw new ImageResizeError("CORRUPT_IMAGE", "Image file is empty");
  }
  if (fileBytes > IMAGE_LIMITS.maxInputBytes) {
    throw new ImageResizeError(
      "IMAGE_TOO_LARGE",
      `Compressed input exceeds ${IMAGE_LIMITS.maxInputBytes} bytes`,
    );
  }

  if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight) || sourceWidth < 1 || sourceHeight < 1) {
    throw new ImageResizeError("CORRUPT_IMAGE", "Decoded source dimensions are invalid");
  }
  if (sourceWidth > IMAGE_LIMITS.maxDimension || sourceHeight > IMAGE_LIMITS.maxDimension) {
    throw new ImageResizeError(
      "IMAGE_TOO_LARGE",
      `Source dimensions exceed ${IMAGE_LIMITS.maxDimension} pixels on one side`,
    );
  }
  if (!Number.isInteger(outputWidth) || !Number.isInteger(outputHeight) || outputWidth < 1 || outputHeight < 1) {
    throw new ImageResizeError("INVALID_INPUT", "Output dimensions must be positive whole numbers");
  }
  if (outputWidth > IMAGE_LIMITS.maxDimension || outputHeight > IMAGE_LIMITS.maxDimension) {
    throw new ImageResizeError(
      "OUTPUT_TOO_LARGE",
      `Output dimensions exceed ${IMAGE_LIMITS.maxDimension} pixels on one side`,
    );
  }

  const sourcePixels = sourceWidth * sourceHeight;
  const outputPixels = outputWidth * outputHeight;
  if (sourcePixels > IMAGE_LIMITS.maxSourcePixels) {
    throw new ImageResizeError(
      "IMAGE_TOO_LARGE",
      `Decoded source exceeds ${IMAGE_LIMITS.maxSourcePixels} pixels`,
    );
  }
  if (outputPixels > IMAGE_LIMITS.maxOutputPixels) {
    throw new ImageResizeError(
      "OUTPUT_TOO_LARGE",
      `Output exceeds ${IMAGE_LIMITS.maxOutputPixels} pixels`,
    );
  }

  const estimatedDecodedBytes = estimateDecodedBytes(sourcePixels, outputPixels);
  if (estimatedDecodedBytes > IMAGE_LIMITS.maxEstimatedDecodedBytes) {
    throw new ImageResizeError(
      "MEMORY_LIMIT",
      `Estimated decoded working set exceeds ${IMAGE_LIMITS.maxEstimatedDecodedBytes} bytes`,
    );
  }

  return { sourcePixels, outputPixels, estimatedDecodedBytes };
}

export function safeOutputStem(filename: string): string {
  const base = filename.split(/[\\/]/u).at(-1) ?? "image";
  const stem = base.replace(/\.[^.]*$/u, "");
  const cleaned = stem
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[.-]+|[.-]+$/gu, "")
    .slice(0, 80);
  return cleaned || "image";
}
