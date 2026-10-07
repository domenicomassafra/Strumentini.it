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
  scanImageMetadata,
  type MetadataGroup,
  type MetadataInventory,
  type MetadataSegment,
} from "./metadata";

/** Bound on how much of the input is read for the inventory pass. */
export const METADATA_SCAN_LIMIT_BYTES = 8 * 1024 * 1024;

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

export const METADATA_STRIPPER_VERSION = "image-metadata-strip-v1";

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, METADATA_SCAN_LIMIT_BYTES).arrayBuffer());
}

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

  const inputBytes = await bytesOf(file.blob);
  const inputInventory = scanImageMetadata(inputBytes);

  progress?.({ phase: "decode", label: "Decodifica locale" });
  const decoded = await decodeImage(file, signal, progress);
  try {
    const canvas = bitmapCanvas(decoded.bitmap);
    const sourcePixels = get2d(canvas).getImageData(0, 0, decoded.width, decoded.height).data;
    const blob = await outputBlob(canvas, mime, undefined, decoded.width, decoded.height, signal, progress);
    const outputBytes = await bytesOf(blob);
    const outputInventory = scanImageMetadata(outputBytes);
    if (outputInventory.privacySegmentCount > 0) {
      throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "The produced file still carries identifying metadata");
    }
    if (outputInventory.format !== "png") {
      throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", `The produced file is ${outputInventory.format}, expected png`);
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
      policyIt: "I pixel vengono ricodificati dal browser in PNG, che non scrive metadati; il file prodotto viene poi analizzato byte per byte e il risultato è dichiarato solo se non contiene più Exif, XMP, IPTC o commenti.",
      metadataGroups,
      fidelity: {
        outputFormat: "image/png",
        dimensionsPreserved: true,
        decodedRgbaExact: true,
        verification: "browser-decoded RGBA before vs reopened PNG RGBA",
        limitation: "The claim is exact for the browser-decoded RGBA raster. Original container bytes, metadata, ICC/profile semantics and pre-decode codec history are not preserved.",
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
  return scanImageMetadata(await bytesOf(file.blob));
}

export function summarizeMetadataRemoval(inventory: MetadataInventory): string {
  return describeMetadataIt(inventory);
}
