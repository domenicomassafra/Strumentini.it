import { createSHA256 } from "hash-wasm";

export const SUPPORTED_HASH_ALGORITHMS = ["SHA-256"] as const;
export type SupportedHashAlgorithm = (typeof SUPPORTED_HASH_ALGORITHMS)[number];

export type FileHashErrorCode =
  | "UNSUPPORTED_ALGORITHM"
  | "MALFORMED_CHECKSUM"
  | "READ_FAILURE"
  | "WORKER_FAILURE"
  | "ORACLE_TOO_LARGE";

export class FileHashError extends Error {
  constructor(readonly code: FileHashErrorCode, message: string) {
    super(message);
    this.name = "FileHashError";
  }
}

export interface HashProgress {
  bytesHashed: number;
  totalBytes: number;
  fraction: number;
}

export interface HashResult {
  algorithm: SupportedHashAlgorithm;
  digestHex: string;
  bytesHashed: number;
}

export interface IncrementalHashOptions {
  algorithm?: string;
  chunkSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: HashProgress) => void;
}

const DEFAULT_CHUNK_SIZE = 1024 * 1024;

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
}

function normalizeAlgorithm(algorithm: string | undefined): SupportedHashAlgorithm {
  const value = algorithm ?? "SHA-256";
  if (value !== "SHA-256") {
    throw new FileHashError("UNSUPPORTED_ALGORITHM", `Unsupported hash algorithm: ${value}`);
  }
  return value;
}

export function parseExpectedChecksum(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(normalized)) {
    throw new FileHashError(
      "MALFORMED_CHECKSUM",
      "Expected checksum must be exactly 64 hexadecimal characters for SHA-256.",
    );
  }
  return normalized;
}

export function checksumMatches(digestHex: string, expectedChecksum: string): boolean {
  return digestHex.toLowerCase() === parseExpectedChecksum(expectedChecksum);
}

export async function hashBlobIncremental(
  blob: Blob,
  options: IncrementalHashOptions = {},
): Promise<HashResult> {
  const algorithm = normalizeAlgorithm(options.algorithm);
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new FileHashError("READ_FAILURE", "Invalid internal chunk size.");
  }

  abortIfNeeded(options.signal);
  const hasher = await createSHA256();
  hasher.init();

  let offset = 0;
  while (offset < blob.size) {
    abortIfNeeded(options.signal);
    const end = Math.min(offset + chunkSize, blob.size);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
    } catch (error) {
      throw new FileHashError(
        "READ_FAILURE",
        error instanceof Error ? `Unable to read file chunk: ${error.message}` : "Unable to read file chunk.",
      );
    }
    abortIfNeeded(options.signal);
    hasher.update(bytes);
    offset = end;
    options.onProgress?.({
      bytesHashed: offset,
      totalBytes: blob.size,
      fraction: blob.size === 0 ? 1 : offset / blob.size,
    });
  }

  abortIfNeeded(options.signal);
  const digestHex = hasher.digest("hex");
  if (blob.size === 0) {
    options.onProgress?.({ bytesHashed: 0, totalBytes: 0, fraction: 1 });
  }
  return { algorithm, digestHex, bytesHashed: blob.size };
}

export async function hashBlobWithWebCrypto(
  blob: Blob,
  options: { algorithm?: string; maxBytes?: number } = {},
): Promise<string> {
  const algorithm = normalizeAlgorithm(options.algorithm);
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  if (blob.size > maxBytes) {
    throw new FileHashError(
      "ORACLE_TOO_LARGE",
      `Web Crypto oracle is limited to ${maxBytes} bytes; received ${blob.size}.`,
    );
  }
  let bytes: ArrayBuffer;
  try {
    bytes = await blob.arrayBuffer();
  } catch (error) {
    throw new FileHashError(
      "READ_FAILURE",
      error instanceof Error ? `Unable to read oracle input: ${error.message}` : "Unable to read oracle input.",
    );
  }
  const digest = await globalThis.crypto.subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
