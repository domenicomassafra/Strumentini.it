/**
 * #410 — bounded local text → real .gz files using the already installed fflate.
 * Runs one file at a time and never submits input or output to a server.
 * Scope is explicitly UTF-8 text, CSV, JSON, Markdown and .log; not arbitrary
 * PDF/image/video transcoding or a universal compression pipeline.
 */
import { gunzipSync, gzipSync } from "fflate";

export const BATCH_410_MAX_FILES = 8;
export const BATCH_410_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const BATCH_410_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = BATCH_410_MAX_FILE_BYTES + 64 * 1024;
const TEXT_TYPES = new Set(["", "text/plain", "text/csv", "text/markdown", "application/json"]);
const TEXT_EXTENSIONS = /\.(?:txt|csv|json|md|log)$/iu;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

export type Batch410Status = "success" | "unsupported" | "error" | "cancelled";
export interface Batch410Item {
  readonly sourceIndex: number;
  readonly sourceName: string;
  readonly status: Batch410Status;
  readonly reason?: "UNSUPPORTED_TYPE" | "UNSUPPORTED_ENCODING" | "EMPTY_FILE" |
    "FILE_TOO_LARGE" | "TOTAL_BYTES_LIMIT" | "READ_OR_COMPRESSION_ERROR" | "CANCELLED";
  readonly output?: { readonly name: string; readonly blob: Blob; readonly bytes: number };
}

const isCancelled = (signal?: AbortSignal) => signal?.aborted === true;

function safeBaseName(input: string, index: number): string {
  let name = input.normalize("NFC").replace(/[/\\\u0000-\u001f\u007f<>:"|?*\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu, "_")
    .trim().replace(/^\.+|\.+$/gu, "").slice(0, 90).trim().replace(/[. ]+$/u, "");
  if (!name) name = "file-" + String(index + 1).padStart(2, "0") + ".txt";
  // Windows device names remain reserved even with an extension.
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)) name = "_" + name;
  return name;
}

function assignedNames(files: readonly File[]): string[] {
  const used = new Set<string>();
  return files.map((file, index) => {
    const base = safeBaseName(file.name, index);
    let sequence = 1;
    let name = base + ".gz";
    while (used.has(name.toLocaleLowerCase("en-US"))) {
      sequence += 1;
      name = base + " (" + String(sequence) + ").gz";
    }
    used.add(name.toLocaleLowerCase("en-US"));
    return name;
  });
}

function isTextFile(file: File): boolean {
  return TEXT_TYPES.has(file.type.toLowerCase()) && TEXT_EXTENSIONS.test(file.name);
}

function validatesText(bytes: Uint8Array): boolean {
  try {
    const text = UTF8_DECODER.decode(bytes);
    // No untrusted binary masquerading as text; allow common newlines and tabs.
    return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text);
  } catch {
    return false;
  }
}

/**
 * Returns one item per file, in input order. Cancelled/failed items carry no
 * artifact; earlier successful Blob objects are retained for downloading.
 */
export async function runBatchTextGzip410(
  files: readonly File[],
  options: { signal?: AbortSignal; onItem?: (item: Batch410Item) => void } = {},
): Promise<readonly Batch410Item[]> {
  if (!Array.isArray(files) || files.length < 1 || files.length > BATCH_410_MAX_FILES ||
      files.some((file) => !(file instanceof File))) {
    throw new TypeError("BATCH_COUNT: choose 1–8 local files");
  }
  const names = assignedNames(files);
  const results: Batch410Item[] = [];
  let acceptedBytes = 0;
  for (const [sourceIndex, file] of files.entries()) {
    let item: Batch410Item = {
      sourceIndex, sourceName: file.name, status: "cancelled", reason: "CANCELLED",
    };
    if (!isCancelled(options.signal)) {
      if (!isTextFile(file)) {
        item = { sourceIndex, sourceName: file.name, status: "unsupported", reason: "UNSUPPORTED_TYPE" };
      } else if (file.size === 0) {
        item = { sourceIndex, sourceName: file.name, status: "unsupported", reason: "EMPTY_FILE" };
      } else if (file.size > BATCH_410_MAX_FILE_BYTES) {
        item = { sourceIndex, sourceName: file.name, status: "unsupported", reason: "FILE_TOO_LARGE" };
      } else if (acceptedBytes + file.size > BATCH_410_MAX_TOTAL_BYTES) {
        item = { sourceIndex, sourceName: file.name, status: "unsupported", reason: "TOTAL_BYTES_LIMIT" };
      } else {
        acceptedBytes += file.size;
        try {
          const input = new Uint8Array(await file.arrayBuffer());
          if (isCancelled(options.signal)) {
            item = { sourceIndex, sourceName: file.name, status: "cancelled", reason: "CANCELLED" };
          } else if (input.byteLength !== file.size || !validatesText(input)) {
            item = { sourceIndex, sourceName: file.name, status: "unsupported", reason: "UNSUPPORTED_ENCODING" };
          } else {
            const compressed = gzipSync(input, { level: 6, mtime: 0 });
            if (isCancelled(options.signal)) {
              item = { sourceIndex, sourceName: file.name, status: "cancelled", reason: "CANCELLED" };
            } else if (compressed.byteLength > MAX_COMPRESSED_BYTES) {
              item = { sourceIndex, sourceName: file.name, status: "error", reason: "READ_OR_COMPRESSION_ERROR" };
            } else {
              const decoded = gunzipSync(compressed);
              if (decoded.byteLength !== input.byteLength || decoded.some((byte, pos) => byte !== input[pos])) {
                item = { sourceIndex, sourceName: file.name, status: "error", reason: "READ_OR_COMPRESSION_ERROR" };
              } else {
                item = {
                  sourceIndex, sourceName: file.name, status: "success",
                  output: {
                    name: names[sourceIndex]!,
                    blob: new Blob([new Uint8Array(compressed)], { type: "application/gzip" }),
                    bytes: compressed.byteLength,
                  },
                };
              }
            }
          }
        } catch {
          item = { sourceIndex, sourceName: file.name,
            status: isCancelled(options.signal) ? "cancelled" : "error",
            reason: isCancelled(options.signal) ? "CANCELLED" : "READ_OR_COMPRESSION_ERROR" };
        }
      }
    }
    results.push(item);
    options.onItem?.(item);
    // Allow the UI to paint progress and invoke AbortController between files.
    if (sourceIndex < files.length - 1) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return results;
}
