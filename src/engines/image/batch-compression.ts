import { createZip, inspectZip } from "../file-privacy";
import { inspectImageHeader } from "./format";
import { assertFiles, abortIfNeeded, ImageVisualError } from "./visual";
import { compressImageLocal, type ImageCompressionOutput } from "./visual-tools";

export interface ImageCompressionBatchItem extends ImageCompressionOutput {
  readonly sourceIndex: number;
  readonly originalBytes: number;
}

export interface ImageCompressionBatchFailure {
  readonly sourceIndex: number;
  readonly name: string;
  readonly originalBytes: number;
  readonly message: string;
}

export interface ImageCompressionBatchResult {
  readonly items: readonly ImageCompressionBatchItem[];
  readonly failures: readonly ImageCompressionBatchFailure[];
  readonly originalBytes: number;
  readonly successfulOriginalBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly savedPercent: number;
  readonly processedCount: number;
  readonly zipBlob: Blob | null;
  readonly zipFilename: string | null;
  readonly countMissingTarget: number;
  readonly maxConcurrent: 1;
}

export async function runImageCompressionQueue(
  files: readonly File[],
  convert: (file: File, index: number) => Promise<ImageCompressionOutput>,
  signal?: AbortSignal,
): Promise<ImageCompressionBatchResult> {
  if (files.length < 1 || files.length > 8) {
    throw new ImageVisualError("INVALID_INPUT", "La coda accetta da 1 a 8 immagini");
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > 80 * 1024 * 1024) {
    throw new ImageVisualError("FILE_TOO_LARGE", "La coda supera il limite locale di 80 MiB");
  }
  const items: ImageCompressionBatchItem[] = [];
  const failures: ImageCompressionBatchFailure[] = [];
  for (const [index, file] of files.entries()) {
    abortIfNeeded(signal);
    try {
      const output = await convert(file, index);
      abortIfNeeded(signal);
      if (!(output.blob instanceof Blob) || output.blob.size < 1 || output.blob.type !== output.outputMime) {
        throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Formato risultato non verificato");
      }
      items.push({
        ...output,
        filename: `${String(index + 1).padStart(2, "0")}-${output.filename}`,
        sourceIndex: index,
        originalBytes: file.size,
      });
    } catch (error) {
      abortIfNeeded(signal);
      failures.push({
        sourceIndex: index, name: file.name, originalBytes: file.size,
        message: error instanceof Error ? error.message : "Elaborazione non riuscita",
      });
    }
  }
  const outputBytes = items.reduce((sum, item) => sum + item.blob.size, 0);
  const successfulOriginalBytes = items.reduce((sum, item) => sum + item.originalBytes, 0);
  const savedBytes = successfulOriginalBytes - outputBytes;
  const filesForZip = items.map((item) => new File([item.blob], item.filename, { type: item.outputMime }));
  let zipBlob: Blob | null = null;
  if (filesForZip.length > 0) {
    abortIfNeeded(signal);
    const zip = await createZip({ files: filesForZip }, signal);
    if (!(zip.blob instanceof Blob) || zip.blob.type !== "application/zip") {
      throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Archivio ZIP non disponibile");
    }
    const inspected = await inspectZip({ files: [new File([zip.blob], "compresse.zip", { type: "application/zip" })] }, signal);
    if (!Array.isArray(inspected.entries) || inspected.entries.length !== filesForZip.length
      || inspected.entries.some((entry, index) => {
        const record = entry as { path?: unknown; uncompressedSize?: unknown; encrypted?: unknown; pathTraversal?: unknown };
        return record.path !== filesForZip[index]?.name || record.uncompressedSize !== filesForZip[index]?.size || record.encrypted === true || record.pathTraversal === true;
      })) {
      throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Il contenuto dell'archivio ZIP non coincide con i risultati");
    }
    zipBlob = zip.blob;
  }
  return {
    items, failures, originalBytes: totalBytes, successfulOriginalBytes, outputBytes, savedBytes,
    savedPercent: successfulOriginalBytes === 0 ? 0 : Number((100 * savedBytes / successfulOriginalBytes).toFixed(2)),
    processedCount: files.length, zipBlob, zipFilename: zipBlob === null ? null : "immagini-compresse.zip",
    countMissingTarget: items.filter((item) => item.targetMet === false).length,
    maxConcurrent: 1,
  };
}

export async function compressImageBatchLocal(input: unknown, signal?: AbortSignal): Promise<ImageCompressionBatchResult> {
  if (typeof input !== "object" || input === null) throw new ImageVisualError("INVALID_INPUT", "Seleziona delle immagini");
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.files) || !value.files.every((file) => file instanceof File)) {
    throw new ImageVisualError("INVALID_INPUT", "Seleziona file immagine validi");
  }
  const files = value.files as File[];
  assertFiles(files, 8);
  return runImageCompressionQueue(files, async (file) => {
    abortIfNeeded(signal);
    const header = inspectImageHeader(new Uint8Array(await file.slice(0, 2 * 1024 * 1024).arrayBuffer()));
    abortIfNeeded(signal);
    return compressImageLocal({
      file,
      mime: header.mime,
      quality: value.quality ?? 0.85,
      ...(value.targetKiB === undefined ? {} : {
        targetKiB: value.targetKiB, minQuality: value.minQuality, allowResize: value.allowResize,
      }),
    }, signal);
  }, signal);
}
