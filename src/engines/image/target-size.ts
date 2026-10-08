import { ImageVisualError, abortIfNeeded } from "./visual";
import type { OutputMime } from "./operations";

/** Bounded, measured search. Browser encoders are not assumed to be monotonic. */
export interface ImageTargetTrial {
  readonly scale: number;
  readonly quality: number;
  readonly blob: Blob;
}

export interface ImageTargetSearchResult extends ImageTargetTrial {
  readonly targetBytes: number;
  readonly meetsTarget: boolean;
  readonly attempts: number;
  readonly reason: "met" | "quality-floor" | "png-no-quality-control";
}

export function parseImageTarget(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 40960) {
    throw new ImageVisualError("INVALID_INPUT", "La dimensione obiettivo deve essere tra 1 e 40960 KiB");
  }
  const bytes = Math.floor(value * 1024);
  if (!Number.isSafeInteger(bytes)) throw new ImageVisualError("INVALID_INPUT", "Dimensione obiettivo non valida");
  return bytes;
}

/**
 * Iterates in descending resolution/quality. Every success is based on real
 * Blob bytes; unsuccessful trials never become a false success claim.
 * The encoder owns one canvas at a time and must release it between scales.
 */
export async function findImageTargetSize(
  options: {
    readonly mime: OutputMime;
    readonly targetKiB: number;
    readonly minQuality?: number;
    readonly allowResize?: boolean;
  },
  encode: (scale: number, quality: number) => Promise<Blob>,
  signal?: AbortSignal,
): Promise<ImageTargetSearchResult> {
  const targetBytes = parseImageTarget(options.targetKiB);
  const minQuality = options.minQuality ?? 0.45;
  if (!Number.isFinite(minQuality) || minQuality < 0.1 || minQuality > 0.92) {
    throw new ImageVisualError("INVALID_INPUT", "La qualità minima deve essere tra 0,1 e 0,92");
  }
  if (options.allowResize !== undefined && typeof options.allowResize !== "boolean") {
    throw new ImageVisualError("INVALID_INPUT", "Riduzione dimensioni non valida");
  }
  const qualities = options.mime === "image/png"
    ? [0.92]
    : [...new Set([0.92, 0.82, 0.72, 0.62, 0.52, minQuality].filter((quality) => quality >= minQuality).sort((a, b) => b - a))];
  const scales = options.allowResize === true ? [1, 0.85, 0.7, 0.55] : [1];
  let smallest: ImageTargetTrial | undefined;
  let attempts = 0;
  for (const scale of scales) {
    for (const quality of qualities) {
      abortIfNeeded(signal);
      const blob = await encode(scale, quality);
      abortIfNeeded(signal);
      if (blob.type !== options.mime || blob.size < 1) {
        throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Il browser non ha codificato il formato richiesto");
      }
      attempts++;
      const trial: ImageTargetTrial = { scale, quality, blob };
      if (smallest === undefined || blob.size < smallest.blob.size) smallest = trial;
      if (blob.size <= targetBytes) {
        return { ...trial, targetBytes, meetsTarget: true, attempts, reason: "met" };
      }
    }
  }
  if (smallest === undefined) throw new ImageVisualError("ENCODE_FAILED", "Il browser non ha prodotto un'immagine");
  return {
    ...smallest, targetBytes, meetsTarget: false, attempts,
    reason: options.mime === "image/png" ? "png-no-quality-control" : "quality-floor",
  };
}
