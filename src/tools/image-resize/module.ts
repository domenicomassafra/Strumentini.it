import { inspectImageHeader, signatureMatches } from "../../engines/image/format";
import {
  IMAGE_LIMITS,
  ImageResizeError,
  computeResizePlan,
  preflightAllocation,
  safeOutputStem,
} from "../../engines/image/policy";
import { resizeWithPica271 } from "../../engines/image/resize-pica-271";
import type { ToolModule } from "../../runtime/types";
import type {
  ImageResizeInput,
  ImageResizeOutput,
  ImageResizeProgress,
} from "./types";

const HEADER_READ_BYTES = 2 * 1024 * 1024;
const METADATA_POLICY =
  "Output is newly encoded from decoded pixels and does not intentionally copy EXIF/XMP/IPTC. " +
  "This is not a blanket guarantee that every possible metadata carrier is absent.";
const ORIENTATION_POLICY =
  "Decode requests browser 'from-image' orientation before resize; output pixels are written in that displayed orientation.";

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

function emit(
  onProgress: ((progress: ImageResizeProgress) => void) | undefined,
  phase: ImageResizeProgress["phase"],
  label: string,
) {
  onProgress?.({ phase, label });
}

function validateInput(value: unknown): ImageResizeInput {
  if (typeof value !== "object" || value === null) throw new ImageResizeError("INVALID_INPUT", "Input is required");
  const input = value as Partial<ImageResizeInput>;
  if (!(input.file instanceof Blob)) throw new ImageResizeError("INVALID_INPUT", "Choose a local image");
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height)) {
    throw new ImageResizeError("INVALID_INPUT", "Width and height must be whole numbers");
  }
  if (input.fit !== "contain" && input.fit !== "cover") {
    throw new ImageResizeError("INVALID_INPUT", "Fit must be contain or cover");
  }
  if (input.noUpscale !== undefined && typeof input.noUpscale !== "boolean") {
    throw new ImageResizeError("INVALID_INPUT", "No-upscale must be enabled or disabled");
  }
  if (input.outputMime !== "image/jpeg" && input.outputMime !== "image/webp") {
    throw new ImageResizeError("INVALID_INPUT", "Output format must be JPEG or WebP");
  }
  if (typeof input.quality !== "number" || !Number.isFinite(input.quality) || input.quality < 0.4 || input.quality > 1) {
    throw new ImageResizeError("INVALID_INPUT", "Quality must be between 0.4 and 1");
  }
  return { ...input, noUpscale: input.noUpscale ?? false } as ImageResizeInput;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: "image/jpeg" | "image/webp",
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new ImageResizeError("ENCODE_FAILED", `Browser could not encode ${mime}`));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

export async function resizeImageLocal(
  rawInput: unknown,
  signal?: AbortSignal,
  onProgress?: (progress: ImageResizeProgress) => void,
): Promise<ImageResizeOutput> {
  abortIfNeeded(signal);
  if (
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined" ||
    typeof document.createElement !== "function"
  ) {
    throw new ImageResizeError("UNSUPPORTED_BROWSER", "This browser does not expose the required local image APIs");
  }

  const input = validateInput(rawInput);
  abortIfNeeded(signal);
  emit(onProgress, "header", "Reading image header");
  const headerBytes = new Uint8Array(await input.file.slice(0, HEADER_READ_BYTES).arrayBuffer());
  abortIfNeeded(signal);
  const header = inspectImageHeader(headerBytes);

  emit(onProgress, "preflight", "Checking pixel and memory limits");
  // Fail unsafe sources before target geometry is considered. This preserves
  // the source-specific error even when no-upscale would reduce the output.
  preflightAllocation(input.file.size, header.width, header.height, 1, 1);
  const headerPlan = computeResizePlan(
    header.width,
    header.height,
    input.width,
    input.height,
    input.fit,
    input.noUpscale,
  );
  preflightAllocation(
    input.file.size,
    header.width,
    header.height,
    headerPlan.outputWidth,
    headerPlan.outputHeight,
  );
  abortIfNeeded(signal);

  emit(onProgress, "decode", "Decoding locally");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(input.file, { imageOrientation: "from-image" });
  } catch (error) {
    abortIfNeeded(signal);
    throw new ImageResizeError(
      "CORRUPT_IMAGE",
      error instanceof Error ? `Browser could not decode the image: ${error.message}` : "Browser could not decode the image",
    );
  }
  abortIfNeeded(signal);

  try {
    const plan = computeResizePlan(
      bitmap.width,
      bitmap.height,
      input.width,
      input.height,
      input.fit,
      input.noUpscale,
    );
    const allocation = preflightAllocation(
      input.file.size,
      bitmap.width,
      bitmap.height,
      plan.outputWidth,
      plan.outputHeight,
    );

    emit(onProgress, "resize", input.fit === "cover" ? "Cropping and resizing" : "Resizing");
    const canvas = document.createElement("canvas");
    canvas.width = plan.outputWidth;
    canvas.height = plan.outputHeight;
    const context = canvas.getContext("2d", { alpha: input.outputMime !== "image/jpeg" });
    if (context === null) throw new ImageResizeError("UNSUPPORTED_BROWSER", "2D canvas is unavailable");
    if (input.outputMime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const resampling = await resizeWithPica271(bitmap, plan, canvas, allocation.estimatedDecodedBytes, signal);
    if (resampling.engine === "canvas") {
      context.drawImage(
        bitmap,
        plan.sourceX,
        plan.sourceY,
        plan.sourceWidth,
        plan.sourceHeight,
        0,
        0,
        plan.outputWidth,
        plan.outputHeight,
      );
    }
    abortIfNeeded(signal);

    emit(onProgress, "encode", `Encoding ${input.outputMime === "image/jpeg" ? "JPEG" : "WebP"}`);
    const blob = await canvasToBlob(canvas, input.outputMime, input.quality);
    abortIfNeeded(signal);
    if (blob.type !== input.outputMime) {
      throw new ImageResizeError(
        "ENCODE_FAILED",
        `Browser returned ${blob.type || "an unknown MIME type"} instead of ${input.outputMime}`,
      );
    }

    emit(onProgress, "verify", "Verifying output independently");
    const outputBytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    if (!signatureMatches(outputBytes, input.outputMime)) {
      throw new ImageResizeError("OUTPUT_VALIDATION_FAILED", "Encoded output signature does not match its MIME type");
    }
    const verificationBitmap = await createImageBitmap(blob);
    try {
      if (
        verificationBitmap.width !== plan.outputWidth ||
        verificationBitmap.height !== plan.outputHeight
      ) {
        throw new ImageResizeError(
          "OUTPUT_VALIDATION_FAILED",
          `Decoded output is ${verificationBitmap.width}×${verificationBitmap.height}, expected ${plan.outputWidth}×${plan.outputHeight}`,
        );
      }
    } finally {
      verificationBitmap.close();
    }
    abortIfNeeded(signal);

    const extension = input.outputMime === "image/jpeg" ? "jpg" : "webp";
    const originalName = "name" in input.file && typeof input.file.name === "string" ? input.file.name : "image";
    return {
      blob,
      filename: `${safeOutputStem(originalName)}-${plan.outputWidth}x${plan.outputHeight}.${extension}`,
      inputMime: header.mime,
      outputMime: input.outputMime,
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
      outputWidth: plan.outputWidth,
      outputHeight: plan.outputHeight,
      estimatedDecodedBytes: allocation.estimatedDecodedBytes,
      resampling,
      metadataPolicy: METADATA_POLICY,
      orientationPolicy: ORIENTATION_POLICY,
    };
  } finally {
    bitmap.close();
  }
}

const module: ToolModule = {
  async run(input, _context, signal) {
    return resizeImageLocal(input, signal);
  },
};

export { IMAGE_LIMITS, METADATA_POLICY, ORIENTATION_POLICY };
export default module;
