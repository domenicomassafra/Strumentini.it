/*
 * Image metadata removal with a verifiable result.
 *
 * The job is "give me the same picture without the identifying data". The
 * output is therefore produced by re-encoding the decoded pixels, which cannot
 * carry over any container metadata, and then **the produced bytes are parsed
 * again** with the same segment scanner used on the input. The tool only
 * reports success when that second pass finds nothing to remove; otherwise it
 * fails closed instead of claiming a clean file it cannot prove.
 */

import {
  ImageVisualError,
  assertFile,
  formatBytes,
  normalizeName,
  type ImageVisualFile,
  type ImageVisualProgress,
} from "./visual";
import {
  bitmapCanvas,
  decodeImage,
  extensionForMime,
  get2d,
  imageDataFromBitmap,
  outputBlob,
  validateObject,
  type OutputMime,
} from "./operations";
import {
  describeMetadataIt,
  diffImageMetadata,
  scanImageMetadataBlob,
  type MetadataGroup,
  type MetadataInventory,
  type MetadataSegment,
} from "./metadata";

export interface StripMetadataResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly inputMime: string;
  readonly outputMime: OutputMime;
  readonly width: number;
  readonly height: number;
  readonly dimensionsPreserved: true;
  readonly inputInventory: MetadataInventory;
  readonly outputInventory: MetadataInventory;
  readonly removed: readonly MetadataSegment[];
  readonly privacySegmentCount: number;
  readonly privacyBytes: number;
  readonly inputSizeLabel: string;
  readonly outputSizeLabel: string;
  /** Proven for the produced bytes, not assumed from the encoder. */
  readonly metadataFree: true;
  readonly policyIt: string;
  readonly metadataGroups: {
    readonly before: readonly MetadataGroup[];
    readonly after: readonly MetadataGroup[];
    readonly removed: readonly MetadataGroup[];
    readonly retained: readonly MetadataGroup[];
  };
  readonly fidelity: {
    readonly outputFormat: "image/png";
    readonly dimensionsPreserved: true;
    readonly decodedRgbaExact: true;
    readonly verification: "browser-decoded RGBA before vs reopened PNG RGBA";
    readonly limitation: string;
  };
  readonly engineVersion: string;
}

export const METADATA_STRIPPER_VERSION = "image-metadata-strip-v2";

export async function stripImageMetadataLocal(
  input: unknown,
  signal?: AbortSignal,
  progress?: (value: ImageVisualProgress) => void,
): Promise<StripMetadataResult> {
  const value = validateObject(input);
  // `assertFile` is the one place a caller-supplied File becomes the engine's
  // own record, and it is also where the size limits are enforced.
  const file = assertFile(value.file, "image");
  const mime = "image/png" as const;

  const inputInventory = await scanImageMetadataBlob(file.blob, signal);

  progress?.({ phase: "decode", label: "Decodifica locale" });
  const decoded = await decodeImage(file, signal, progress);
  try {
    const canvas = bitmapCanvas(decoded.bitmap);
    const sourcePixels = get2d(canvas).getImageData(0, 0, decoded.width, decoded.height).data;
    const blob = await outputBlob(canvas, mime, undefined, decoded.width, decoded.height, signal, progress);
    const outputInventory = await scanImageMetadataBlob(blob, signal);
    if (outputInventory.format !== "png" || !outputInventory.complete || outputInventory.segments.length > 0) {
      throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Full output PNG inventory is incomplete or contains metadata chunks");
    }
    const outputDecoded = await decodeImage({
      name: "metadata-stripped.png",
      size: blob.size,
      type: mime,
      blob,
    }, signal, progress);
    try {
      const reopened = await imageDataFromBitmap(outputDecoded.bitmap, signal);
      if (reopened.width !== decoded.width || reopened.height !== decoded.height || reopened.data.length !== sourcePixels.length) {
        throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Reopened PNG dimensions do not match the browser-decoded source pixels");
      }
      for (let index = 0; index < sourcePixels.length; index += 1) {
        if ((index & 0xffff) === 0 && signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
        if (sourcePixels[index] !== reopened.data[index]) {
          throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", `Reopened PNG pixel mismatch at RGBA byte ${index}`);
        }
      }
    } finally {
      outputDecoded.bitmap.close();
    }
    const removed = inputInventory.segments;
    const metadataGroups = diffImageMetadata(inputInventory, outputInventory);
    return {
      blob,
      filename: `${normalizeName(file.name)}-senza-metadati.${extensionForMime(mime)}`,
      inputMime: inputInventory.format === "unknown" ? "image/*" : `image/${inputInventory.format}`,
      outputMime: mime,
      width: decoded.width,
      height: decoded.height,
      dimensionsPreserved: true,
      inputInventory,
      outputInventory,
      removed,
      privacySegmentCount: inputInventory.privacySegmentCount,
      privacyBytes: inputInventory.privacyBytes,
      inputSizeLabel: formatBytes(file.size),
      outputSizeLabel: formatBytes(blob.size),
      metadataFree: true,
      policyIt: `L'immagine viene ricodificata localmente dai pixel in PNG. L'intero file prodotto viene ispezionato fino alla fine: nessun chunk di metadati, inclusi testo, profili, Exif, XMP e chunk sconosciuti. ${inputInventory.complete ? "Inventario sorgente completo." : "Inventario sorgente parziale: solo i segmenti rilevati sono documentati."} Gli eventuali thumbnail Exif non sono inventariati separatamente; l'intero contenitore Exif originale viene escluso dalla nuova immagine.`,
      metadataGroups,
      fidelity: {
        outputFormat: "image/png",
        dimensionsPreserved: true,
        decodedRgbaExact: true,
        verification: "browser-decoded RGBA before vs reopened PNG RGBA",
        limitation: "Exact only for browser-decoded RGBA. Original container, Exif embedded thumbnails, ICC/profile semantics and codec history are not preserved. Pixel steganography or identifying picture content cannot be scrubbed by metadata removal.",
      },
      engineVersion: METADATA_STRIPPER_VERSION,
    };
  } finally {
    decoded.bitmap.close();
  }
}

/** Reports what an image carries, without producing anything. */
export async function inspectImageMetadataSegments(file: ImageVisualFile, signal?: AbortSignal): Promise<MetadataInventory> {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  return scanImageMetadataBlob(file.blob, signal);
}

export function summarizeMetadataRemoval(inventory: MetadataInventory): string {
  return describeMetadataIt(inventory);
}
