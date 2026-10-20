import { Gunzip, gzipSync, zipSync } from "fflate";
import {
  ARCHIVE_416_LIMITS, Archive416Error, cancelled416, crc416, extractZip416,
  refuseNested416, safeArchivePath416, type Extracted416,
} from "./zip-416";

export { ARCHIVE_416_LIMITS, Archive416Error, extractZip416 } from "./zip-416";
export type Archive416Action = "create-zip" | "create-gzip" | "extract";
export interface Archive416Row {
  readonly name: string;
  readonly status: "success";
  readonly sourceBytes: number;
  readonly resultBytes: number;
  readonly method: "deflate" | "gzip" | "store";
}
export interface Archive416Output {
  readonly name: string;
  readonly path: string;
  readonly blob: Blob;
  readonly bytes: number;
}
export interface Archive416Result {
  readonly format: "zip" | "gzip";
  readonly action: Archive416Action;
  readonly entries: readonly Archive416Row[];
  readonly outputs: readonly Archive416Output[];
}

function reject(code: Archive416Error["code"], reason: string): never {
  throw new Archive416Error(code, reason);
}
function nameOf(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return typeof relative === "string" && relative !== "" ? relative : file.name;
}
function gzipOutputName(name: string): string {
  return name.replace(/\.gz$/iu, "") || "estratto";
}

/** GZIP: streaming inflation, early output cap, then independently check trailer CRC/ISIZE. */
export function extractGzip416(bytes: Uint8Array, name: string, signal?: AbortSignal): Extracted416 {
  cancelled416(signal);
  if (bytes.length < 20 || bytes.length > ARCHIVE_416_LIMITS.maxInputBytes ||
      bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8 ||
      (bytes[3]! & 0xe0) !== 0) reject("CORRUPT_ARCHIVE", "Header GZIP assente o non supportato");
  const basename = safeArchivePath416(gzipOutputName(name));
  const trailer = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 8, 8);
  const expectedCrc = trailer.getUint32(0, true), expectedSize = trailer.getUint32(4, true);
  if (expectedSize > ARCHIVE_416_LIMITS.maxFileBytes ||
      expectedSize > bytes.length * ARCHIVE_416_LIMITS.maxExpansionRatio) {
    reject("ARCHIVE_TOO_LARGE", "Possibile GZIP bomb");
  }
  let expanded = 0, crc = 0xffffffff;
  const chunks: Uint8Array[] = [];
  const accept = (chunk: Uint8Array): void => {
    cancelled416(signal);
    expanded += chunk.byteLength;
    if (expanded > ARCHIVE_416_LIMITS.maxFileBytes || expanded > expectedSize) {
      reject("ARCHIVE_TOO_LARGE", "Inflazione GZIP fuori dai limiti");
    }
    crc = crc416(crc, chunk);
    chunks.push(chunk.slice());
  };
  try {
    const decoder = new Gunzip((data) => accept(data));
    for (let at = 0; at < bytes.length; at += 256) {
      decoder.push(bytes.subarray(at, at + 256), at + 256 >= bytes.length);
    }
  } catch (error) {
    if (error instanceof Archive416Error) throw error;
    reject("CORRUPT_ARCHIVE", "Stream GZIP corrotto");
  }
  if (expanded !== expectedSize || ((crc ^ 0xffffffff) >>> 0) !== expectedCrc) {
    reject("CORRUPT_ARCHIVE", "GZIP CRC32 o ISIZE non validi");
  }
  const result = new Uint8Array(expanded);
  let cursor = 0;
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.byteLength; }
  refuseNested416(result);
  return { path: basename, bytes: result, packedBytes: bytes.length, method: "gzip" };
}

function uniqueDownloadNames(entries: readonly Extracted416[]): string[] {
  const used = new Set<string>();
  return entries.map(({ path }) => {
    // Downloads never write to user-provided paths. Flatten names and
    // refuse collisions on case-insensitive systems.
    const downloadName = path.replaceAll("/", "__");
    const key = downloadName.normalize("NFKC").toLocaleLowerCase("en-US");
    if (used.has(key)) reject("UNSAFE_ARCHIVE_PATH", "Nomi di download in collisione");
    used.add(key);
    return downloadName;
  });
}

async function readFiles(files: readonly File[], signal?: AbortSignal): Promise<readonly { path: string; bytes: Uint8Array }[]> {
  if (!Array.isArray(files) || files.length < 1 || files.length > ARCHIVE_416_LIMITS.maxFiles ||
    files.some((file) => !(file instanceof File))) reject("INVALID_INPUT", "Seleziona da 1 a 32 file");
  let total = 0;
  const seen = new Set<string>();
  const output: Array<{ path: string; bytes: Uint8Array }> = [];
  for (const file of files) {
    cancelled416(signal);
    if (file.size > ARCHIVE_416_LIMITS.maxFileBytes ||
        file.size > ARCHIVE_416_LIMITS.maxTotalBytes - total) reject("ARCHIVE_TOO_LARGE", "Limite 8 MiB/file o 24 MiB totali");
    total += file.size;
    const path = safeArchivePath416(nameOf(file));
    const key = path.normalize("NFKC").toLocaleLowerCase("en-US");
    if (seen.has(key)) reject("UNSAFE_ARCHIVE_PATH", "Nomi duplicati nella selezione");
    seen.add(key);
    const bytes = new Uint8Array(await file.arrayBuffer());
    cancelled416(signal);
    if (bytes.byteLength !== file.size) reject("CORRUPT_ARCHIVE", "Lettura del file incompleta");
    refuseNested416(bytes);
    output.push({ path, bytes });
  }
  return output;
}

export async function runArchive416(
  action: Archive416Action, files: readonly File[], signal?: AbortSignal,
): Promise<Archive416Result> {
  if (action !== "create-zip" && action !== "create-gzip" && action !== "extract") {
    reject("INVALID_INPUT", "Operazione archivio sconosciuta");
  }
  if (action === "extract") {
    if (!Array.isArray(files) || files.length !== 1 || !(files[0] instanceof File)) {
      reject("INVALID_INPUT", "Per estrarre seleziona un solo ZIP o GZIP");
    }
    const file = files[0]!;
    if (file.size > ARCHIVE_416_LIMITS.maxInputBytes) reject("ARCHIVE_TOO_LARGE", "Archivio superiore a 12 MiB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    cancelled416(signal);
    if (bytes.length !== file.size) reject("CORRUPT_ARCHIVE", "Lettura archivio incompleta");
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
    if ((!isZip || !/\.zip$/iu.test(file.name)) && (!isGzip || !/\.gz$/iu.test(file.name))) {
      reject("UNSUPPORTED_ARCHIVE", "Firma ed estensione ZIP/GZIP discordanti");
    }
    const entries = isZip ? extractZip416(bytes, signal) : [extractGzip416(bytes, file.name, signal)];
    const names = uniqueDownloadNames(entries);
    cancelled416(signal);
    return {
      action, format: isZip ? "zip" : "gzip",
      entries: entries.map((e) => ({ name: e.path, status: "success", sourceBytes: e.packedBytes,
        resultBytes: e.bytes.length, method: e.method })),
      outputs: entries.map((e, i) => ({ name: names[i]!, path: e.path, bytes: e.bytes.length,
        blob: new Blob([new Uint8Array(e.bytes)], { type: "application/octet-stream" }) })),
    };
  }

  const sources = await readFiles(files, signal);
  if (action === "create-zip") {
    const zip = zipSync(Object.fromEntries(sources.map((source) => [source.path, [source.bytes, { level: 6 }]])), { level: 6 });
    cancelled416(signal);
    if (zip.byteLength > ARCHIVE_416_LIMITS.maxInputBytes) reject("ARCHIVE_TOO_LARGE", "ZIP generato superiore a 12 MiB");
    const reopened = extractZip416(zip, signal);
    if (reopened.length !== sources.length || reopened.some((entry, i) =>
      entry.path !== sources[i]!.path || !equalBytes(entry.bytes, sources[i]!.bytes))) {
      reject("CORRUPT_ARCHIVE", "Verifica ZIP generato fallita");
    }
    return { action, format: "zip",
      entries: reopened.map((entry) => ({ name: entry.path, status: "success", sourceBytes: entry.bytes.length,
        resultBytes: entry.packedBytes, method: entry.method })),
      outputs: [{ name: "archivio-locale.zip", path: "archivio-locale.zip", bytes: zip.byteLength,
        blob: new Blob([new Uint8Array(zip)], { type: "application/zip" }) }],
    };
  }
  if (sources.length > 8) reject("INVALID_INPUT", "GZIP supporta al massimo 8 file per selezione");
  const entries: Archive416Row[] = [];
  const outputs: Archive416Output[] = [];
  const downloadNames = new Set<string>();
  for (const source of sources) {
    cancelled416(signal);
    const outputName = source.path.replaceAll("/", "__") + ".gz";
    const canonical = outputName.normalize("NFKC").toLocaleLowerCase("en-US");
    if (downloadNames.has(canonical)) reject("UNSAFE_ARCHIVE_PATH", "Nomi GZIP di download in collisione");
    downloadNames.add(canonical);
    const gz = gzipSync(source.bytes, { level: 6, mtime: 0 });
    if (gz.length > ARCHIVE_416_LIMITS.maxInputBytes ||
      !equalBytes(extractGzip416(gz, source.path + ".gz", signal).bytes, source.bytes)) {
      reject("CORRUPT_ARCHIVE", "Verifica GZIP generato fallita");
    }
    entries.push({ name: source.path, status: "success", sourceBytes: source.bytes.length,
      resultBytes: gz.byteLength, method: "gzip" });
    outputs.push({ name: outputName, path: source.path,
      bytes: gz.length, blob: new Blob([new Uint8Array(gz)], { type: "application/gzip" }) });
  }
  return { action, format: "gzip", entries, outputs };
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}
