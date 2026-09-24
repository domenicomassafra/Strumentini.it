export const CSV_SOFT_FILE_BYTES = 10 * 1024 * 1024;
export const CSV_HARD_FILE_BYTES = 50 * 1024 * 1024;

export class CsvCleanerError extends Error {
  constructor(readonly code: "PARSE_ERROR" | "FILE_TOO_LARGE" | "SEMANTIC_MISMATCH" | "CANCELLED", message: string) {
    super(message);
    this.name = "CsvCleanerError";
  }
}

export async function readBlobText(
  blob: Blob,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  if (blob.size > CSV_HARD_FILE_BYTES) throw new CsvCleanerError("FILE_TOO_LARGE", "File exceeds the 50 MiB hard limit.");
  if (signal?.aborted) throw new CsvCleanerError("CANCELLED", "Operation cancelled");
  const reader = blob.stream().getReader();
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  let read = 0;
  let output = "";
  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new CsvCleanerError("CANCELLED", "Operation cancelled");
      }
      const chunk = await reader.read();
      if (chunk.done) break;
      read += chunk.value.byteLength;
      output += decoder.decode(chunk.value, { stream: true });
      onProgress?.(blob.size === 0 ? 1 : Math.min(1, read / blob.size));
    }
    output += decoder.decode();
    onProgress?.(1);
    return output;
  } finally {
    reader.releaseLock();
  }
}

export async function readTableBlobBytes(
  blob: Blob,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  if (blob.size > CSV_HARD_FILE_BYTES) throw new CsvCleanerError("FILE_TOO_LARGE", "File exceeds the 50 MiB hard limit.");
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const buffer = await blob.arrayBuffer();
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  onProgress?.(1);
  return new Uint8Array(buffer);
}
