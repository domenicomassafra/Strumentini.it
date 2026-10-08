import { inspectImageHeader } from "../image/format";

export const FILE_PRIVACY_ENGINE_VERSION = "file-privacy-v2";

export const FILE_PRIVACY_LIMITS = {
  maxFiles: 2_000,
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
  maxTextBytes: 2 * 1024 * 1024,
  maxZipBytes: 100 * 1024 * 1024,
  maxZipEntries: 10_000,
  maxZipUncompressedBytes: 200 * 1024 * 1024,
  maxZipEntryNameBytes: 64 * 1024,
  maxFilenameLength: 180,
  maxManifestBytes: 2 * 1024 * 1024,
  maxMetadataScanBytes: 512 * 1024,
  maxPdfMetadataScanBytes: 4 * 1024 * 1024,
} as const;

/** A rename pattern is a bounded template, never a payload. */
const MAX_RENAME_PATTERN_LENGTH = 512;

export type FilePrivacyOperation =
  | "file-hash"
  | "batch-checksum-manifest"
  | "checksum-verifier"
  | "file-signature-detector"
  | "file-size-analyzer"
  | "ai-code-fence-bundle"
  | "folder-inventory"
  | "folder-size-type-summary"
  | "duplicate-file-finder"
  | "filename-sanitizer"
  | "batch-rename-preview"
  | "zip-contents-inspector"
  | "zip-creator"
  | "clean-zip-creator"
  | "archive-checksum-manifest"
  | "metadata-risk-inspector"
  | "secret-token-pattern-scanner"
  | "safe-share-checklist"
  | "client-handoff-index-generator"
  | "file-list-diff"
  | "folder-compare"
  | "zero-byte-orphan-finder";

export type FilePrivacyErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_INPUT"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "TEXT_TOO_LARGE"
  | "CORRUPT_ARCHIVE"
  | "UNSUPPORTED_ARCHIVE"
  | "ARCHIVE_TOO_LARGE"
  | "UNSAFE_ARCHIVE_PATH"
  | "HASH_FAILED"
  | "IO_FAILED"
  | "CANCELLED";

export class FilePrivacyError extends Error {
  constructor(readonly code: FilePrivacyErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "FilePrivacyError";
  }
}

export interface FilePrivacyResult {
  readonly operation: FilePrivacyOperation;
  readonly [key: string]: unknown;
}

export interface FileRecord {
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly type: string;
  readonly extension: string;
  readonly empty: boolean;
  readonly lastModified: number;
}

export interface FileDigestRecord extends FileRecord {
  readonly sha256: string;
}

export interface ZipEntryRecord {
  readonly path: string;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly method: number;
  readonly crc32: number;
  readonly encrypted: boolean;
  readonly pathTraversal: boolean;
}

export interface SecretFinding {
  readonly file: string;
  readonly line: number;
  readonly columnStart: number;
  readonly columnEnd: number;
  readonly kind: string;
  readonly evidenceCategory: "potential-secret-pattern";
  readonly classification: "potential";
  readonly preview: string;
}

export interface MetadataRiskFinding {
  readonly category:
    | "metadata-marker"
    | "path-like-text"
    | "email-like-text"
    | "secret-like-text"
    | "temporary-backup-name"
    | "empty-file"
    | "unverified-signature"
    | "encrypted-container"
    | "location-metadata"
    | "embedded-metadata";
  readonly evidence: string;
  readonly line?: number;
  readonly columnStart?: number;
  readonly columnEnd?: number;
}

const textDecoder = new TextDecoder("utf-8");
const textEncoder = new TextEncoder();

function fail(code: FilePrivacyErrorCode, message: string): never {
  throw new FilePrivacyError(code, message);
}

function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail("INVALID_INPUT", "Expected an input object");
  return value as Record<string, unknown>;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) fail("CANCELLED", "Operation cancelled");
}

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function pathOf(file: File): string {
  const relative = (file as File & { webkitRelativePath?: unknown }).webkitRelativePath;
  return typeof relative === "string" && relative.length > 0 ? relative : file.name;
}

function extensionOf(path: string): string {
  const base = path.split(/[\\/]/u).at(-1) ?? path;
  const dot = base.lastIndexOf(".");
  return dot > 0 && dot < base.length - 1 ? base.slice(dot).toLocaleLowerCase("en-US") : "";
}

function safeSegment(value: string): string {
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/gu, "");
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
  const stemExtension = normalized.match(/^(.*?)(\.[^.]*)?$/u);
  const stem = (stemExtension?.[1] ?? normalized).replace(/[\\/:*?"<>|]+/gu, "-");
  const extension = stemExtension?.[2] ?? "";
  const trimmed = `${stem}${extension}`.replace(/[. ]+$/u, "").trim();
  const prefixed = reserved.test(trimmed) ? `_${trimmed}` : trimmed;
  return prefixed.slice(0, FILE_PRIVACY_LIMITS.maxFilenameLength) || "file";
}

export function sanitizeRelativePath(value: string): string {
  if (typeof value !== "string" || value.length === 0) fail("INVALID_INPUT", "A file path is required");
  const normalized = value.trim().replace(/\\/gu, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//u.test(normalized) || normalized.includes("\u0000")) {
    fail("UNSAFE_ARCHIVE_PATH", "Absolute and NUL-containing paths are not allowed");
  }
  const segments = normalized.split("/").filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.some((segment) => segment === "..")) fail("UNSAFE_ARCHIVE_PATH", "Parent-directory path segments are not allowed");
  const safe = segments.map(safeSegment).filter(Boolean);
  if (safe.length === 0) fail("INVALID_INPUT", "Path did not contain a usable file name");
  return safe.join("/");
}

function fileList(value: unknown, key = "files"): File[] {
  if (!Array.isArray(value)) fail("INVALID_INPUT", `${key} must be an array of files`);
  if (value.length === 0) fail("INVALID_INPUT", "Choose at least one file");
  if (value.length > FILE_PRIVACY_LIMITS.maxFiles) fail("TOO_MANY_FILES", `At most ${FILE_PRIVACY_LIMITS.maxFiles} files are supported`);
  const files = value.map((candidate) => {
    if (!isFile(candidate)) fail("INVALID_INPUT", `${key} must contain File objects`);
    if (!Number.isSafeInteger(candidate.size) || candidate.size < 0) fail("INVALID_INPUT", "File size is invalid");
    return candidate;
  });
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > FILE_PRIVACY_LIMITS.maxTotalBytes) fail("FILE_TOO_LARGE", "The selected files exceed the local total-size limit");
  return files;
}

function optionalFileList(value: unknown, key: string): File[] {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return [];
  return fileList(value, key);
}

function recordsFor(files: readonly File[]): FileRecord[] {
  return files.map((file) => {
    const path = pathOf(file);
    const safePath = sanitizeRelativePath(path);
    return {
      name: file.name,
      path: safePath,
      size: file.size,
      type: file.type || "application/octet-stream",
      extension: extensionOf(file.name),
      empty: file.size === 0,
      lastModified: Number.isFinite(file.lastModified) ? file.lastModified : 0,
    };
  });
}

async function readBytes(file: File, signal?: AbortSignal, maxBytes = FILE_PRIVACY_LIMITS.maxFileBytes): Promise<Uint8Array> {
  throwIfAborted(signal);
  if (file.size > maxBytes) fail("FILE_TOO_LARGE", `File exceeds the ${maxBytes}-byte local limit`);
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    fail("IO_FAILED", "The selected file could not be read");
  }
  throwIfAborted(signal);
  if (buffer.byteLength > maxBytes) fail("FILE_TOO_LARGE", "Read data exceeded the local limit");
  return new Uint8Array(buffer);
}

async function readPrefix(file: File, length: number): Promise<Uint8Array> {
  if (file.size === 0) return new Uint8Array(0);
  const buffer = await file.slice(0, Math.min(length, file.size)).arrayBuffer();
  return new Uint8Array(buffer);
}

function extensionMatches(path: string, mime: string): boolean {
  const extension = extensionOf(path);
  const expected: Record<string, readonly string[]> = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
    "application/pdf": [".pdf"],
    "application/zip": [".zip"],
    "application/gzip": [".gz"],
    "audio/mpeg": [".mp3"],
    "audio/wav": [".wav", ".wave"],
    "video/mp4": [".mp4"],
    "text/plain": [".txt", ".md", ".csv", ".json", ".log"],
    "text/xml": [".xml", ".svg"],
  };
  return expected[mime]?.includes(extension) ?? true;
}

export async function detectFileSignature(file: File, signal?: AbortSignal): Promise<Record<string, unknown>> {
  throwIfAborted(signal);
  const bytes = await readPrefix(file, 64);
  const hex = [...bytes.slice(0, 12)].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
  let detectedMime = "application/octet-stream";
  let label = "Unknown binary signature";
  let confidence = "low";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    detectedMime = "image/png";
    label = "PNG signature";
    confidence = "high";
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    detectedMime = "image/jpeg";
    label = "JPEG SOI signature";
    confidence = "high";
  } else if (bytes.length >= 6 && textDecoder.decode(bytes.slice(0, 6)).startsWith("GIF8")) {
    detectedMime = "image/gif";
    label = "GIF signature";
    confidence = "high";
  } else if (bytes.length >= 12 && textDecoder.decode(bytes.slice(0, 4)) === "RIFF" && textDecoder.decode(bytes.slice(8, 12)) === "WEBP") {
    detectedMime = "image/webp";
    label = "WebP RIFF signature";
    confidence = "high";
  } else if (bytes.length >= 4 && textDecoder.decode(bytes.slice(0, 4)) === "%PDF") {
    detectedMime = "application/pdf";
    label = "PDF header";
    confidence = "high";
  } else if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5 || bytes[2] === 7)) {
    detectedMime = "application/zip";
    label = "ZIP local or central-directory signature";
    confidence = "high";
  } else if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    detectedMime = "application/gzip";
    label = "GZIP signature";
    confidence = "high";
  } else if (bytes.length >= 12 && textDecoder.decode(bytes.slice(4, 8)) === "ftyp") {
    detectedMime = "video/mp4";
    label = "ISO-BMFF ftyp box";
    confidence = "medium";
  } else if (bytes.length >= 12 && textDecoder.decode(bytes.slice(0, 4)) === "RIFF" && textDecoder.decode(bytes.slice(8, 12)) === "WAVE") {
    detectedMime = "audio/wav";
    label = "RIFF PCM WAVE candidate";
    confidence = "medium";
  }
  const declared = file.type || "application/octet-stream";
  return {
    file: pathOf(file),
    detectedMime,
    label,
    confidence,
    firstBytesHex: hex,
    declaredType: declared,
    extension: extensionOf(file.name),
    extensionMatches: extensionMatches(file.name, detectedMime),
    note: detectedMime === "application/octet-stream" ? "No bounded signature matched; the extension is not proof of content." : "Signature check is bounded to the first bytes and does not validate the entire file.",
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || crypto.subtle === undefined) fail("HASH_FAILED", "Web Crypto is unavailable");
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  try {
    const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return fail("HASH_FAILED", "SHA-256 calculation failed");
  }
}

async function digestFile(file: File, signal?: AbortSignal, maxBytes = FILE_PRIVACY_LIMITS.maxFileBytes): Promise<string> {
  const bytes = await readBytes(file, signal, maxBytes);
  return sha256Hex(bytes);
}

function checksum(value: string): string {
  const normalized = value.trim();
  if (!/^[0-9a-f]{64}$/iu.test(normalized)) fail("INVALID_INPUT", "Expected a 64-character hexadecimal SHA-256 value");
  return normalized.toLocaleLowerCase("en-US");
}

function parseExpectedChecksums(value: unknown): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof value === "string") {
    for (const line of value.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      const match = /^([0-9a-f]{64})\s+[*]?(.+)$/iu.exec(trimmed);
      if (match === null) fail("INVALID_INPUT", "Expected checksum lines must be a SHA-256 digest and path");
      const digest = match[1];
      const path = match[2];
      if (digest === undefined || path === undefined) fail("INVALID_INPUT", "Expected checksum line is incomplete");
      result.set(sanitizeRelativePath(path), checksum(digest));
    }
    if (result.size === 0) fail("INVALID_INPUT", "Enter at least one expected checksum");
    return result;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [path, digest] of Object.entries(value as Record<string, unknown>)) {
      if (typeof digest !== "string") fail("INVALID_INPUT", "Expected checksums must map paths to strings");
      result.set(sanitizeRelativePath(path), checksum(digest));
    }
    if (result.size === 0) fail("INVALID_INPUT", "Enter at least one expected checksum");
  }
  return result;
}

async function fileDigests(files: readonly File[], signal?: AbortSignal): Promise<FileDigestRecord[]> {
  const records = recordsFor(files);
  const digests: FileDigestRecord[] = [];
  for (const [index, file] of files.entries()) {
    throwIfAborted(signal);
    const record = records[index];
    if (record === undefined) fail("IO_FAILED", "File record could not be prepared");
    digests.push({ ...record, sha256: await digestFile(file, signal) });
  }
  return digests;
}

export async function batchChecksumManifest(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const files = fileList(recordOf(input).files);
  const entries = await fileDigests(files, signal);
  const manifest = `${entries.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n")}\n`;
  if (textEncoder.encode(manifest).byteLength > FILE_PRIVACY_LIMITS.maxManifestBytes) fail("FILE_TOO_LARGE", "The checksum manifest exceeds the local output limit");
  return { operation: "batch-checksum-manifest", algorithm: "SHA-256", entries, manifest, count: entries.length, totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0) };
}

export async function verifyChecksums(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const files = fileList(source.files);
  const expected = parseExpectedChecksums(source.expected ?? source.expectedChecksums);
  const entries = await fileDigests(files, signal);
  const checks = entries.map((entry) => {
    const expectedDigest = expected.get(entry.path) ?? expected.get(entry.name);
    return { path: entry.path, size: entry.size, actual: entry.sha256, expected: expectedDigest ?? null, status: expectedDigest === undefined ? "missing" : expectedDigest === entry.sha256 ? "match" : "mismatch" };
  });
  return { operation: "checksum-verifier", algorithm: "SHA-256", checks, matchCount: checks.filter((check) => check.status === "match").length, mismatchCount: checks.filter((check) => check.status === "mismatch").length, missingCount: checks.filter((check) => check.status === "missing").length, allMatch: checks.length > 0 && checks.every((check) => check.status === "match") };
}

export function folderInventory(input: unknown): FilePrivacyResult {
  const files = fileList(recordOf(input).files);
  const records = recordsFor(files).toSorted((left, right) => left.path.localeCompare(right.path));
  return { operation: "folder-inventory", files: records, count: records.length, totalBytes: records.reduce((sum, record) => sum + record.size, 0), emptyCount: records.filter((record) => record.empty).length };
}

export function folderSizeTypeSummary(input: unknown): FilePrivacyResult {
  const files = fileList(recordOf(input).files);
  const records = recordsFor(files);
  const groups = new Map<string, { extension: string; type: string; count: number; bytes: number }>();
  for (const record of records) {
    const key = `${record.extension || "(none)"}\u0000${record.type}`;
    const current = groups.get(key) ?? { extension: record.extension || "(none)", type: record.type, count: 0, bytes: 0 };
    current.count += 1;
    current.bytes += record.size;
    groups.set(key, current);
  }
  const byType = [...groups.values()].toSorted((left, right) => right.bytes - left.bytes || left.type.localeCompare(right.type));
  return { operation: "folder-size-type-summary", count: records.length, totalBytes: records.reduce((sum, record) => sum + record.size, 0), groups: byType, largest: records.toSorted((left, right) => right.size - left.size || left.path.localeCompare(right.path))[0] ?? null };
}

export async function duplicateFileFinder(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const files = fileList(recordOf(input).files);
  const records = recordsFor(files);
  const candidates = new Map<number, number[]>();
  records.forEach((record, index) => {
    const current = candidates.get(record.size) ?? [];
    current.push(index);
    candidates.set(record.size, current);
  });
  const groupsByDigest = new Map<string, { size: number; paths: string[] }>();
  for (const indices of candidates.values()) {
    if (indices.length < 2) continue;
    for (const index of indices) {
      throwIfAborted(signal);
      const file = files[index];
      const record = records[index];
      if (file === undefined || record === undefined) continue;
      const digest = await digestFile(file, signal);
      const group = groupsByDigest.get(digest) ?? { size: file.size, paths: [] };
      group.paths.push(record.path);
      groupsByDigest.set(digest, group);
    }
  }
  const duplicateGroups = [...groupsByDigest.entries()]
    .filter(([, group]) => group.paths.length > 1)
    .map(([sha256, group]) => ({ ...group, paths: group.paths.toSorted((left, right) => left.localeCompare(right)), sha256 }))
    .toSorted((left, right) => right.paths.length - left.paths.length || (left.paths[0]?.localeCompare(right.paths[0] ?? "") ?? 0));
  return { operation: "duplicate-file-finder", algorithm: "SHA-256", duplicateGroups, duplicateFileCount: duplicateGroups.reduce((sum, group) => sum + group.paths.length, 0), inspectedCount: files.length };
}

export function filenameSanitizer(input: unknown): FilePrivacyResult {
  const source = recordOf(input);
  const rawNames = Array.isArray(source.names) ? source.names : source.files === undefined ? undefined : recordsFor(fileList(source.files)).map((record) => record.path);
  if (!Array.isArray(rawNames) || rawNames.length === 0) fail("INVALID_INPUT", "names must be a non-empty array");
  const entries: Array<{ original: string; sanitized: string; changed: boolean; collision: boolean }> = [];
  const seen = new Set<string>();
  for (const rawName of rawNames) {
    if (typeof rawName !== "string") fail("INVALID_INPUT", "Every name must be text");
    const sanitized = sanitizeRelativePath(rawName);
    const key = sanitized.toLocaleLowerCase("en-US");
    const collision = seen.has(key);
    seen.add(key);
    entries.push({ original: rawName, sanitized, changed: sanitized !== rawName, collision });
  }
  return { operation: "filename-sanitizer", entries, changedCount: entries.filter((entry) => entry.changed).length, collisionCount: entries.filter((entry) => entry.collision).length };
}

/**
 * A rename preview produces file *names*, never directory trees: a pasted or
 * selected `docs/fattura.pdf` must be previewed as one name, so path separators
 * are folded into `-` before the reserved-name and length policy applies.
 */
function safeFileName(value: string): string {
  const flattened = value.replace(/[\\/]+/gu, "-");
  return safeSegment(flattened);
}

function renderRenamePattern(pattern: string, index: number, name: string): string {
  const extension = extensionOf(name);
  const stem = name.slice(0, name.length - extension.length);
  return pattern.replaceAll("{index}", String(index + 1)).replaceAll("{name}", stem).replaceAll("{ext}", extension);
}

export function batchRenamePreview(input: unknown): FilePrivacyResult {
  const source = recordOf(input);
  const rawNames = Array.isArray(source.names) ? source.names : source.files === undefined ? undefined : recordsFor(fileList(source.files)).map((record) => record.name);
  if (!Array.isArray(rawNames) || rawNames.length === 0) fail("INVALID_INPUT", "names must be a non-empty array");
  // The default keeps the extension: a preview that silently renames
  // `a.txt` to `a` is not a rename.
  const pattern = source.pattern === undefined ? "{name}{ext}" : source.pattern;
  if (typeof pattern !== "string" || pattern.length === 0) fail("INVALID_INPUT", "pattern must be non-empty text");
  if (pattern.length > MAX_RENAME_PATTERN_LENGTH) fail("INVALID_INPUT", `pattern must be at most ${MAX_RENAME_PATTERN_LENGTH} characters`);
  const used = new Set<string>();
  let collisionCount = 0;
  const entries = rawNames.map((rawName, index) => {
    if (typeof rawName !== "string") fail("INVALID_INPUT", "Every name must be text");
    const candidate = safeFileName(renderRenamePattern(pattern, index, rawName));
    if (candidate === "") fail("INVALID_INPUT", `The pattern produced an empty name for entry ${index + 1}`);
    let sanitized = candidate;
    let collided = false;
    if (used.has(candidate.toLocaleLowerCase("en-US"))) {
      collided = true;
      // The stem is taken from the candidate once: recomputing it from the
      // partially suffixed name would compound the suffix (-2 then -2-3).
      const extension = extensionOf(candidate);
      const stem = candidate.slice(0, candidate.length - extension.length);
      let suffix = 2;
      let next = `${stem}-${suffix}${extension}`;
      while (used.has(next.toLocaleLowerCase("en-US"))) {
        suffix += 1;
        if (suffix > rawNames.length + 1) fail("INVALID_INPUT", "The rename pattern cannot produce a unique name for every entry");
        next = `${stem}-${suffix}${extension}`;
      }
      sanitized = next;
    }
    if (collided) collisionCount += 1;
    used.add(sanitized.toLocaleLowerCase("en-US"));
    return { original: rawName, renamed: sanitized, changed: sanitized !== rawName };
  });
  return { operation: "batch-rename-preview", pattern, entries, changedCount: entries.filter((entry) => entry.changed).length, collisionCount };
}

function littleEndian16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function littleEndian32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = 22;
  if (bytes.length < minimum) fail("CORRUPT_ARCHIVE", "The archive is too short to contain a ZIP directory");
  const start = Math.max(0, bytes.length - minimum - 65_557);
  for (let offset = bytes.length - minimum; offset >= start; offset -= 1) {
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) return offset;
  }
  fail("CORRUPT_ARCHIVE", "ZIP end-of-directory record was not found");
}

function zipEntryPath(name: string): { path: string; pathTraversal: boolean } {
  const normalized = name.replace(/\\/gu, "/");
  const decodedForTraversal = normalized.replace(/%2e/giu, ".");
  const pathTraversal = normalized.includes("\u0000") || normalized.startsWith("/") || /^[A-Za-z]:\//u.test(normalized) || decodedForTraversal.split("/").some((part) => part === "..");
  return { path: normalized, pathTraversal };
}

export async function inspectZip(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const files = fileList(source.files);
  if (files.length !== 1) fail("INVALID_INPUT", "ZIP inspector accepts exactly one archive file");
  const file = files[0];
  if (file === undefined) fail("INVALID_INPUT", "ZIP archive is required");
  if (file.size > FILE_PRIVACY_LIMITS.maxZipBytes) fail("ARCHIVE_TOO_LARGE", "The ZIP archive exceeds the local size limit");
  const bytes = await readBytes(file, signal, FILE_PRIVACY_LIMITS.maxZipBytes);
  const eocd = findEndOfCentralDirectory(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = littleEndian16(view, eocd + 10);
  const directorySize = littleEndian32(view, eocd + 12);
  const directoryOffset = littleEndian32(view, eocd + 16);
  if (count > FILE_PRIVACY_LIMITS.maxZipEntries || directoryOffset > bytes.length || directorySize > bytes.length - directoryOffset) fail("CORRUPT_ARCHIVE", "ZIP central-directory bounds are invalid");
  if (count > 0 && littleEndian32(view, directoryOffset) !== 0x02014b50) fail("CORRUPT_ARCHIVE", "ZIP central-directory signature is invalid");
  const entries: ZipEntryRecord[] = [];
  let totalUncompressedBytes = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || littleEndian32(view, cursor) !== 0x02014b50) fail("CORRUPT_ARCHIVE", `Invalid central-directory entry ${index + 1}`);
    const flags = littleEndian16(view, cursor + 8);
    const method = littleEndian16(view, cursor + 10);
    const crc32 = littleEndian32(view, cursor + 16);
    const compressedSize = littleEndian32(view, cursor + 20);
    const uncompressedSize = littleEndian32(view, cursor + 24);
    const nameLength = littleEndian16(view, cursor + 28);
    const extraLength = littleEndian16(view, cursor + 30);
    const commentLength = littleEndian16(view, cursor + 32);
    const start = cursor + 46;
    const end = start + nameLength;
    if (end > bytes.length) fail("CORRUPT_ARCHIVE", "ZIP entry name exceeds the archive bounds");
    if (nameLength > FILE_PRIVACY_LIMITS.maxZipEntryNameBytes) fail("ARCHIVE_TOO_LARGE", "ZIP entry name exceeds the local limit");
    if (uncompressedSize > FILE_PRIVACY_LIMITS.maxZipUncompressedBytes - totalUncompressedBytes) fail("ARCHIVE_TOO_LARGE", "ZIP uncompressed content exceeds the local limit");
    const name = textDecoder.decode(bytes.slice(start, end));
    const parsed = zipEntryPath(name);
    entries.push({ path: parsed.path, compressedSize, uncompressedSize, method, crc32, encrypted: (flags & 1) === 1, pathTraversal: parsed.pathTraversal });
    totalUncompressedBytes += uncompressedSize;
    cursor = end + extraLength + commentLength;
    if (cursor > bytes.length) fail("CORRUPT_ARCHIVE", "ZIP entry metadata exceeds the archive bounds");
  }
  return { operation: "zip-contents-inspector", archive: pathOf(file), entryCount: entries.length, entries, totalUncompressedBytes: entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0), hasPathTraversal: entries.some((entry) => entry.pathTraversal), hasEncryptedEntries: entries.some((entry) => entry.encrypted), methodNote: "Central-directory inspection only; file contents are not decompressed." };
}

export async function analyzeFileSize(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const files = fileList(source.files);
  if (files.length !== 1) fail("INVALID_INPUT", "File-size analyzer accepts exactly one file");
  const file = files[0];
  if (file === undefined) fail("INVALID_INPUT", "File is required");
  const sourceSha256 = await digestFile(file, signal, Math.max(FILE_PRIVACY_LIMITS.maxFileBytes, FILE_PRIVACY_LIMITS.maxZipBytes));
  throwIfAborted(signal);
  const signature = await detectFileSignature(file, signal);
  const detectedMime = String(signature.detectedMime ?? "application/octet-stream");
  const common = {
    operation: "file-size-analyzer" as const,
    file: pathOf(file),
    bytes: file.size,
    sourceSha256,
    sourceMutation: "none" as const,
    detectedMime,
    estimatedSavingsBytes: null,
    estimatePolicy: "No savings estimate is emitted before an actual transform/compression run.",
  };

  // #266: prefer strict package/video facts to filename claims, never turn
  // unknown bitrate/FPS or a declared OOXML container into a saving estimate.
  if (detectedMime === "application/zip" && [".docx", ".pptx", ".xlsx"].includes(extensionOf(file.name))) {
    const { inspectOfficePackageSize, MAX_OFFICE_BYTES_266 } = await import("./size-adapters");
    const bytes = await readBytes(file, signal, MAX_OFFICE_BYTES_266);
    const office = inspectOfficePackageSize(bytes); // strict package signature/ZIP safety and macro refusal
    if (`.${office.format}` !== extensionOf(file.name)) fail("UNSUPPORTED_INPUT", "File extension does not match inspected Office package kind");
    return { ...common, kind: "office", office,
      evidence: [`${office.entryCount} OOXML ZIP entries`, `${office.groups.media.compressedMemberBytes} bytes media compressi`,
        `${office.groups.xml.compressedMemberBytes} bytes XML compressi`, `${office.zipOverheadBytes} bytes ZIP overhead`],
      nextActions: ["ooxml-media-compression"], recommendedOptimizer: "ooxml-media-compression",
      note: "Gruppi ricavati dai byte compressi reali della directory OOXML. Un ottimizzatore locale esiste, ma il risparmio resta sconosciuto finché non viene eseguito." };
  }

  if (detectedMime === "video/mp4") {
    const { inspectVideoContainerSize } = await import("./size-adapters");
    const video = await inspectVideoContainerSize(file, signal);
    return { ...common, kind: "video", video, nextActions: [], recommendedOptimizer: null,
      evidence: [`${video.videoTracks} video track(s), ${video.audioTracks} audio track(s) dichiarate`,
        video.durationSeconds === null ? "Durata MP4 non provata" : `${video.durationSeconds} secondi (header moov)`,
        "Bitrate flussi e FPS non misurati"],
      note: "Metadati MP4 limitati, senza leggere il payload video, senza decodifica e senza convertitore approvato: nessuna promessa di ottimizzazione." };
  }

  if (detectedMime === "audio/wav") {
    const { inspectPcmWaveSize } = await import("./size-adapters");
    const audio = await inspectPcmWaveSize(file, signal);
    return { ...common, kind: "audio", audio, nextActions: [], recommendedOptimizer: null,
      evidence: [audio.codec === "PCM" ? `PCM ${audio.sampleRateHz} Hz · ${audio.channels} canali` : "Codifica/durata non verificabili",
        audio.durationSeconds === null ? "Durata sconosciuta" : `${audio.durationSeconds} secondi da campioni PCM`],
      note: "Header PCM WAVE verificati quando supportati. Formati non PCM e ottimizzazioni audio non sono dichiarati supportati." };
  }

  if (detectedMime === "image/png" || detectedMime === "image/jpeg" || detectedMime === "image/webp") {
    const prefix = new Uint8Array(await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer());
    throwIfAborted(signal);
    const header = inspectImageHeader(prefix);
    const metadata = await inspectMetadataRisk({ files: [file] }, signal);
    const metadataFile = Array.isArray(metadata.files) ? metadata.files[0] as Record<string, unknown> | undefined : undefined;
    return {
      ...common,
      kind: "image",
      image: {
        width: header.width,
        height: header.height,
        pixels: header.width * header.height,
        encoding: header.mime,
        metadataRiskCount: typeof metadataFile?.riskCount === "number" ? metadataFile.riskCount : 0,
        metadataFields: Array.isArray(metadataFile?.metadataFields) ? metadataFile.metadataFields : [],
      },
      evidence: [
        `${header.width}×${header.height} pixels`,
        `container/signature: ${header.mime}`,
        `${file.size} source bytes`,
      ],
      nextActions: ["image-metadata-viewer", "image-resize", "image-compression"],
      note: "Dimensioni, encoding e metadati osservabili spiegano il file sorgente; nessuna riduzione viene promessa prima di eseguire un'operazione separata e misurarne l'output.",
    };
  }

  if (detectedMime === "application/zip") {
    const inspected = await inspectZip({ files: [file] }, signal);
    const entries = Array.isArray(inspected.entries) ? inspected.entries as ZipEntryRecord[] : [];
    const largestEntries = [...entries]
      .sort((left, right) => right.uncompressedSize - left.uncompressedSize || right.compressedSize - left.compressedSize || left.path.localeCompare(right.path))
      .slice(0, 10)
      .map((entry) => ({ path: entry.path, compressedSize: entry.compressedSize, uncompressedSize: entry.uncompressedSize, method: entry.method }));
    const methodCounts = Object.fromEntries([...new Set(entries.map((entry) => entry.method))].sort((a, b) => a - b).map((method) => [String(method), entries.filter((entry) => entry.method === method).length]));
    const totalCompressedEntryBytes = entries.reduce((sum, entry) => sum + entry.compressedSize, 0);
    const totalUncompressedBytes = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
    return {
      ...common,
      kind: "zip",
      zip: {
        entryCount: entries.length,
        totalCompressedEntryBytes,
        totalUncompressedBytes,
        methodCounts,
        largestEntries,
        hasPathTraversal: inspected.hasPathTraversal === true,
        hasEncryptedEntries: inspected.hasEncryptedEntries === true,
      },
      evidence: [
        `${entries.length} central-directory entries`,
        `${totalCompressedEntryBytes} compressed entry bytes`,
        `${totalUncompressedBytes} declared uncompressed bytes`,
      ],
      nextActions: ["zip-contents-inspector", "archive-checksum-manifest"],
      note: "Il report legge soltanto la directory ZIP: indica quali voci pesano di più ma non stima risparmi futuri e non decomprime contenuti.",
    };
  }

  return {
    ...common,
    kind: "unknown",
    evidence: [`${file.size} source bytes`, `bounded signature: ${String(signature.label ?? "unknown")}`],
    nextActions: ["file-signature-detector"],
    note: "Il contenuto non rientra negli adattatori immagine/ZIP supportati: la causa della dimensione resta sconosciuta invece di essere stimata.",
  };
}

const CODE_FENCE_LANGUAGE_EXTENSION: Readonly<Record<string, string>> = {
  javascript: ".js",
  js: ".js",
  typescript: ".ts",
  ts: ".ts",
  tsx: ".tsx",
  jsx: ".jsx",
  json: ".json",
  html: ".html",
  css: ".css",
  python: ".py",
  py: ".py",
  bash: ".sh",
  sh: ".sh",
  shell: ".sh",
  sql: ".sql",
  yaml: ".yaml",
  yml: ".yml",
  xml: ".xml",
  markdown: ".md",
  md: ".md",
  text: ".txt",
  txt: ".txt",
};

export interface ParsedCodeFenceFile {
  readonly path: string;
  readonly language: string;
  readonly content: string;
  readonly byteLength: number;
  readonly sourceStartLine: number;
  readonly sourceEndLine: number;
  readonly naming: "explicit" | "generated";
}

function filenameHintFromLine(line: string): string | null {
  const html = /^\s*<!--\s*(?:file|filename|path)\s*:\s*(.+?)\s*-->\s*$/iu.exec(line);
  if (html?.[1] !== undefined) return html[1].trim();
  const plain = /^\s*(?:#{1,6}\s*)?(?:file|filename|path)\s*:\s*(.+?)\s*$/iu.exec(line);
  return plain?.[1]?.trim() ?? null;
}

function filenameHintFromInfo(info: string): string | null {
  const match = /(?:^|\s)(?:file|filename|path)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/iu.exec(info);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || null;
}

function languageFromInfo(info: string): string {
  const token = info.trim().split(/\s+/u)[0] ?? "";
  if (token === "" || /^(?:file|filename|path)=/iu.test(token)) return "text";
  return token.replace(/[^A-Za-z0-9_+#.-]/gu, "").toLocaleLowerCase("en-US") || "text";
}

function dedupeBundlePath(path: string, used: Set<string>): string {
  const key = path.toLocaleLowerCase("en-US");
  if (!used.has(key)) {
    used.add(key);
    return path;
  }
  const slash = path.lastIndexOf("/");
  const directory = slash >= 0 ? path.slice(0, slash + 1) : "";
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : "";
  for (let index = 2; index <= 10_000; index += 1) {
    const candidate = `${directory}${stem}-${index}${extension}`;
    const candidateKey = candidate.toLocaleLowerCase("en-US");
    if (!used.has(candidateKey)) {
      used.add(candidateKey);
      return candidate;
    }
  }
  return fail("INVALID_INPUT", "Too many duplicate code-fence file names");
}

export function parseAiCodeFenceFiles(text: string): ParsedCodeFenceFile[] {
  if (typeof text !== "string" || text.trim() === "") fail("INVALID_INPUT", "Paste an AI response containing fenced code blocks");
  const bytes = textEncoder.encode(text);
  if (bytes.byteLength > FILE_PRIVACY_LIMITS.maxTextBytes) fail("TEXT_TOO_LARGE", "AI response exceeds the local text limit");
  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  const output: ParsedCodeFenceFile[] = [];
  const used = new Set<string>();
  let index = 0;
  while (index < lines.length) {
    const opening = /^(\s*)(`{3,})([^`]*)$/u.exec(lines[index] ?? "");
    if (opening === null) {
      index += 1;
      continue;
    }
    const marker = opening[2]!;
    const info = opening[3]?.trim() ?? "";
    const startLine = index + 1;
    const contentLines: string[] = [];
    index += 1;
    while (index < lines.length && !new RegExp(`^\\s*${marker}\\s*$`, "u").test(lines[index] ?? "")) {
      contentLines.push(lines[index] ?? "");
      index += 1;
    }
    if (index >= lines.length) fail("INVALID_INPUT", `Code fence opened on line ${startLine} is not closed`);
    const endLine = index + 1;
    const language = languageFromInfo(info);
    const explicitHint = filenameHintFromInfo(info) ?? (startLine >= 2 ? filenameHintFromLine(lines[startLine - 2] ?? "") : null);
    const fallbackExtension = CODE_FENCE_LANGUAGE_EXTENSION[language] ?? ".txt";
    const rawPath = explicitHint ?? `snippet-${String(output.length + 1).padStart(3, "0")}${fallbackExtension}`;
    const safePath = sanitizeRelativePath(rawPath);
    const path = dedupeBundlePath(safePath, used);
    const content = `${contentLines.join("\n")}${contentLines.length > 0 ? "\n" : ""}`;
    output.push({
      path,
      language,
      content,
      byteLength: textEncoder.encode(content).byteLength,
      sourceStartLine: startLine,
      sourceEndLine: endLine,
      naming: explicitHint === null ? "generated" : "explicit",
    });
    if (output.length > 200) fail("TOO_MANY_FILES", "At most 200 code fences are supported per bundle");
    index += 1;
  }
  if (output.length === 0) fail("INVALID_INPUT", "No fenced code blocks were found");
  const totalBytes = output.reduce((sum, item) => sum + item.byteLength, 0);
  if (totalBytes > FILE_PRIVACY_LIMITS.maxTotalBytes) fail("FILE_TOO_LARGE", "Generated code files exceed the local total-size limit");
  return output;
}

export async function createAiCodeFenceBundle(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const text = typeof source.text === "string" ? source.text : typeof source.expected === "string" ? source.expected : "";
  const preview = parseAiCodeFenceFiles(text);
  const files = preview.map((item) => {
    const generated = new File([item.content], item.path.split("/").at(-1) ?? item.path, { type: "text/plain;charset=utf-8" });
    Object.defineProperty(generated, "webkitRelativePath", { value: item.path });
    return generated;
  });
  const zip = await createZip({ files }, signal);
  return {
    ...zip,
    operation: "ai-code-fence-bundle",
    filename: "ai-code-files.zip",
    preview: preview.map(({ content: _content, ...item }) => item),
    fileCount: preview.length,
    totalContentBytes: preview.reduce((sum, item) => sum + item.byteLength, 0),
    namingPolicy: "Explicit safe path when supplied; otherwise snippet-NNN plus language-derived extension. Case-insensitive duplicates receive -2, -3, ... suffixes.",
    pathPolicy: "Absolute paths, NULs and parent-directory segments are refused before ZIP generation.",
    compression: "store",
  };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number): void { view.setUint16(offset, value, true); }
function writeUint32(view: DataView, offset: number, value: number): void { view.setUint32(offset, value >>> 0, true); }
function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

async function createZipArchive(input: unknown, clean: boolean, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const files = fileList(recordOf(input).files);
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const entries: Array<ZipEntryRecord & { offset: number }> = [];
  let localOffset = 0;
  const usedPaths = new Set<string>();
  for (const file of files) {
    throwIfAborted(signal);
    const originalPath = pathOf(file);
    const parsedPath = zipEntryPath(originalPath);
    if (parsedPath.pathTraversal) fail("UNSAFE_ARCHIVE_PATH", "Archive paths must be relative and cannot contain parent segments");
    const archivePath = clean ? sanitizeRelativePath(originalPath) : parsedPath.path;
    if (archivePath.length === 0 || archivePath.split("/").some((part) => part === "..")) fail("UNSAFE_ARCHIVE_PATH", "Archive paths must be relative and cannot contain parent segments");
    const key = archivePath.toLocaleLowerCase("en-US");
    if (usedPaths.has(key)) fail("INVALID_INPUT", "Archive paths must be unique");
    usedPaths.add(key);
    const name = textEncoder.encode(archivePath);
    const bytes = await readBytes(file, signal);
    if (bytes.byteLength > 0xffffffff || localOffset > 0xffffffff) fail("ARCHIVE_TOO_LARGE", "ZIP32 size limits were exceeded");
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + name.byteLength);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, bytes.byteLength);
    writeUint32(localView, 22, bytes.byteLength);
    writeUint16(localView, 26, name.byteLength);
    writeUint16(localView, 28, 0);
    local.set(name, 30);
    localChunks.push(local, bytes);
    const central = new Uint8Array(46 + name.byteLength);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, bytes.byteLength);
    writeUint32(centralView, 24, bytes.byteLength);
    writeUint16(centralView, 28, name.byteLength);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    central.set(name, 46);
    centralChunks.push(central);
    entries.push({ path: archivePath, compressedSize: bytes.byteLength, uncompressedSize: bytes.byteLength, method: 0, crc32: crc, encrypted: false, pathTraversal: false, offset: localOffset });
    localOffset += local.byteLength + bytes.byteLength;
  }
  const centralDirectory = concatBytes(centralChunks);
  if (centralDirectory.byteLength > 0xffffffff) fail("ARCHIVE_TOO_LARGE", "ZIP central directory exceeds the ZIP32 limit");
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralDirectory.byteLength);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);
  const projectedSize = localOffset + centralDirectory.byteLength + end.byteLength;
  if (projectedSize > FILE_PRIVACY_LIMITS.maxZipBytes) fail("ARCHIVE_TOO_LARGE", "Generated ZIP exceeds the local size limit");
  const archive = concatBytes([...localChunks, centralDirectory, end]);
  const archiveCopy = new Uint8Array(archive.byteLength);
  archiveCopy.set(archive);
  return { operation: clean ? "clean-zip-creator" : "zip-creator", filename: clean ? "local-clean.zip" : "local-files.zip", blob: new Blob([archiveCopy.buffer], { type: "application/zip" }), byteLength: archive.byteLength, entries, compression: "store", note: "ZIP is created in memory with the store method; no files are uploaded." };
}

export function createZip(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> { return createZipArchive(input, false, signal); }
export function createCleanZip(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> { return createZipArchive(input, true, signal); }

export async function archiveChecksumManifest(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const files = fileList(source.files);
  const archive = files.length === 1 && extensionOf(files[0]?.name ?? "") === ".zip" ? files[0] : undefined;
  if (archive === undefined) {
    // A single non-ZIP file (or several) is still this tool's job: the result is
    // re-tagged so `operation` never depends on how the files arrived.
    const { operation: _operation, ...rest } = await batchChecksumManifest(input, signal);
    return { operation: "archive-checksum-manifest", ...rest };
  }
  // The archive is both hashed and inspected, so it must respect the (larger)
  // archive limit rather than the single-file limit.
  const digest = await digestFile(archive, signal, FILE_PRIVACY_LIMITS.maxZipBytes);
  const inspected = await inspectZip({ files: [archive] }, signal);
  return {
    operation: "archive-checksum-manifest",
    algorithm: "SHA-256",
    archive: pathOf(archive),
    sha256: digest,
    entries: inspected.entries,
    manifest: `${digest}  ${sanitizeRelativePath(pathOf(archive))}\n`,
    entryCount: inspected.entryCount,
    scope: "The manifest covers the archive bytes themselves; entries are listed from the ZIP central directory and are not decompressed or hashed individually.",
  };
}

function isTextPath(file: File): boolean {
  return file.type.startsWith("text/") || [".txt", ".md", ".csv", ".json", ".log", ".xml", ".svg", ".yaml", ".yml", ".env", ".js", ".ts", ".py", ".html", ".css"].includes(extensionOf(file.name));
}

async function readableText(file: File, signal?: AbortSignal): Promise<string | null> {
  if (!isTextPath(file) || file.size > FILE_PRIVACY_LIMITS.maxTextBytes) return null;
  const bytes = await readBytes(file, signal, FILE_PRIVACY_LIMITS.maxTextBytes);
  return textDecoder.decode(bytes);
}

/**
 * Bounded, structure-aware metadata inspection.
 *
 * The tool exists to warn before a file is shared, so the checks that matter
 * are the ones a byte-level text scan cannot make: the JPEG/PNG/TIFF metadata
 * containers and the PDF document information dictionary. Everything is read
 * from a bounded prefix; nothing is decompressed, nothing is rewritten, and a
 * container the tool cannot parse is reported as unknown rather than as clean.
 */
const EXIF_TAGS: ReadonlyMap<number, string> = new Map([
  [0x010e, "ImageDescription"],
  [0x010f, "Make"],
  [0x0110, "Model"],
  [0x0131, "Software"],
  [0x0132, "DateTime"],
  [0x013b, "Artist"],
  [0x8298, "Copyright"],
  [0x8769, "ExifIFD"],
  [0x8825, "GPSInfoIFD"],
]);

/** PNG text-chunk keywords that usually carry authoring or location detail. */
const PNG_SENSITIVE_KEYWORDS = new Set(["author", "comment", "description", "copyright", "creation time", "source", "disclaimer", "warning"]);
const PNG_METADATA_CHUNKS = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

function latin1(bytes: Uint8Array, start: number, end: number): string {
  let result = "";
  for (let index = start; index < end; index += 1) result += String.fromCharCode(bytes[index] ?? 0);
  return result;
}

function findAscii(bytes: Uint8Array, needle: string, from = 0): number {
  const limit = bytes.length - needle.length;
  for (let index = from; index <= limit; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle.charCodeAt(offset)) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

/** Reads the IFD0 tag names of a TIFF/Exif header, honouring its byte order marker. */
function readExifTagNames(bytes: Uint8Array, tiffStart: number): string[] {
  if (tiffStart + 8 > bytes.length) return [];
  const order = latin1(bytes, tiffStart, tiffStart + 2);
  if (order !== "II" && order !== "MM") return [];
  const littleEndian = order === "II";
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset + tiffStart, bytes.byteLength - tiffStart);
    const firstIfd = view.getUint32(4, littleEndian);
    if (firstIfd <= 0 || firstIfd + 2 > view.byteLength) return [];
    const entries = view.getUint16(firstIfd, littleEndian);
    const names: string[] = [];
    for (let index = 0; index < entries && firstIfd + 2 + (index + 1) * 12 <= view.byteLength; index += 1) {
      const name = EXIF_TAGS.get(view.getUint16(firstIfd + 2 + index * 12, littleEndian));
      if (name !== undefined) names.push(name);
    }
    return [...new Set(names)].toSorted();
  } catch {
    return [];
  }
}

interface BinaryMetadataScan {
  readonly containers: readonly string[];
  readonly fields: readonly string[];
}

function scanJpegMetadata(bytes: Uint8Array): BinaryMetadataScan {
  const fields = new Set<string>();
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { containers: [], fields: [] };
  const containers: string[] = [];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;
    const length = (bytes[offset + 2] ?? 0) * 256 + (bytes[offset + 3] ?? 0);
    if (length < 2) break;
    const segmentStart = offset + 4;
    const segmentEnd = Math.min(offset + 2 + length, bytes.length);
    const payload = bytes.slice(segmentStart, segmentEnd);
    if (marker === 0xe1 && payload.length >= 6 && latin1(payload, 0, 6) === "Exif\0\0") {
      containers.push("Exif");
      // "Exif\0\0" is six bytes, so the TIFF header starts right after it.
      for (const name of readExifTagNames(payload, 6)) fields.add(name);
    } else if (marker === 0xe1 && findAscii(payload, "http://ns.adobe.com/xap/1.0/") >= 0) {
      containers.push("XMP");
      fields.add("XMP");
    } else if (marker === 0xed && findAscii(payload, "Photoshop 3.0") >= 0) {
      containers.push("IPTC");
      fields.add("IPTC");
    } else if (marker === 0xe2 && findAscii(payload, "ICC_PROFILE") >= 0) {
      containers.push("ICC profile");
    } else if (marker === 0xeb) {
      containers.push("APP13");
      fields.add("APP13");
    }
    offset += 2 + length;
  }
  return { containers: [...new Set(containers)].toSorted(), fields: [...fields].toSorted() };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function scanPngMetadata(bytes: Uint8Array): BinaryMetadataScan {
  if (bytes.length < 8 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return { containers: [], fields: [] };
  const fields = new Set<string>();
  const containers = new Set<string>();
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = ((bytes[offset] ?? 0) * 0x1000000) + ((bytes[offset + 1] ?? 0) * 0x10000) + ((bytes[offset + 2] ?? 0) * 0x100) + (bytes[offset + 3] ?? 0);
    const type = latin1(bytes, offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (length < 0 || dataEnd > bytes.length) break;
    if (type === "IEND") break;
    if (PNG_METADATA_CHUNKS.has(type)) {
      containers.add(type);
      if (type !== "eXIf" && type !== "tIME") {
        const separator = bytes.indexOf(0, dataStart);
        if (separator >= dataStart && separator < dataEnd) {
          const keyword = latin1(bytes, dataStart, separator).toLocaleLowerCase("en-US").trim() || "senza-etichetta";
          fields.add(`${type}:${keyword}${PNG_SENSITIVE_KEYWORDS.has(keyword) ? ":sensibile" : ""}`);
        }
      } else fields.add(type);
    }
    offset = dataEnd + 4;
  }
  return { containers: [...containers].toSorted(), fields: [...fields].toSorted() };
}

const PDF_INFO_KEYS = ["/Author", "/Creator", "/Producer", "/Title", "/Subject", "/Keywords", "/CreationDate", "/ModDate"] as const;

function scanPdfMetadata(bytes: Uint8Array): BinaryMetadataScan {
  if (latin1(bytes, 0, 5) !== "%PDF-") return { containers: [], fields: [] };
  const fields = new Set<string>();
  for (const key of PDF_INFO_KEYS) {
    if (findAscii(bytes, key) >= 0) fields.add(key.slice(1));
  }
  const hasMetadata = findAscii(bytes, "/Metadata") >= 0;
  const encrypted = findAscii(bytes, "/Encrypt") >= 0;
  return {
    containers: [...(hasMetadata ? ["XMP"] : []), ...(encrypted ? ["encrypted"] : [])].toSorted(),
    fields: [...fields].toSorted(),
  };
}

function scanTiffMetadata(bytes: Uint8Array): BinaryMetadataScan {
  const order = latin1(bytes, 0, 2);
  if (order !== "II" && order !== "MM") return { containers: [], fields: [] };
  return { containers: ["TIFF"], fields: readExifTagNames(bytes, 0) };
}

async function binaryMetadata(file: File, detectedMime: string, signal?: AbortSignal): Promise<BinaryMetadataScan | null> {
  const limit = detectedMime === "application/pdf" ? FILE_PRIVACY_LIMITS.maxPdfMetadataScanBytes : FILE_PRIVACY_LIMITS.maxMetadataScanBytes;
  if (file.size > limit) return null;
  let bytes: Uint8Array;
  try {
    bytes = await readPrefix(file, limit);
  } catch {
    return null;
  }
  throwIfAborted(signal);
  if (detectedMime === "image/jpeg") return scanJpegMetadata(bytes);
  if (detectedMime === "image/png") return scanPngMetadata(bytes);
  if (detectedMime === "application/pdf") return scanPdfMetadata(bytes);
  if (detectedMime === "image/tiff") return scanTiffMetadata(bytes);
  return null;
}

const secretPatterns: ReadonlyArray<{ kind: string; pattern: RegExp }> = [
  { kind: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/iu },
  { kind: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
  { kind: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/gu },
  { kind: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/gu },
  { kind: "secret-assignment", pattern: /\b(?:api[_-]?key|secret|access[_-]?token|password|passwd)\s*[:=]\s*["']?[^\s"']{8,}/giu },
];

function redact(value: string): string {
  if (value.length <= 8) return "[redacted]";
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

export async function scanSecretPatterns(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const files = optionalFileList(source.files, "files");
  const text = typeof source.text === "string" ? source.text : null;
  const findings: SecretFinding[] = [];
  const inspectText = (fileName: string, value: string) => {
    value.split(/\r?\n/u).forEach((line, index) => {
      for (const { kind, pattern } of secretPatterns) {
        const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
        const matcher = new RegExp(pattern.source, flags);
        for (const match of line.matchAll(matcher)) {
          const start = match.index ?? 0;
          findings.push({
            file: fileName,
            line: index + 1,
            columnStart: start + 1,
            columnEnd: start + match[0].length + 1,
            kind,
            evidenceCategory: "potential-secret-pattern",
            classification: "potential",
            preview: redact(match[0]),
          });
        }
      }
    });
  };
  if (text !== null) inspectText("pasted text", text);
  for (const file of files) {
    const content = await readableText(file, signal);
    if (content !== null) inspectText(pathOf(file), content);
  }
  if (files.length === 0 && text === null) fail("INVALID_INPUT", "Choose a text file or paste text to scan");
  return { operation: "secret-token-pattern-scanner", findings, findingCount: findings.length, inspectedFiles: files.length, note: "Ogni risultato è una corrispondenza potenziale basata su pattern, non la conferma di una credenziale reale. L'evidenza resta locale e il valore completo non viene restituito." };
}

const LOCATION_METADATA_FIELDS = new Set(["GPSInfoIFD"]);

export async function inspectMetadataRisk(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const files = fileList(recordOf(input).files);
  const results: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const signature = await detectFileSignature(file, signal);
    const content = await readableText(file, signal);
    const detectedMime = String(signature.detectedMime);
    const container = await binaryMetadata(file, detectedMime, signal);
    const risks: string[] = [];
    const findings: MetadataRiskFinding[] = [];
    const textFinding = (category: MetadataRiskFinding["category"], expression: RegExp, label: string) => {
      const source = content ?? "";
      const match = expression.exec(source);
      if (match === null) return;
      const before = source.slice(0, match.index);
      const line = before.split(/\r?\n/u).length;
      const lastBreak = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"));
      const columnStart = match.index - lastBreak;
      risks.push(label);
      findings.push({ category, evidence: label, line, columnStart, columnEnd: columnStart + match[0].length });
    };
    textFinding("metadata-marker", /(?:exif|xmp|iptc|gps| latitude|longitude)/iu, "text contains a metadata-like marker");
    textFinding("path-like-text", /(?:[A-Z]:\\|\/(?:home|Users|private|var)\/)/u, "text contains an absolute path-like value");
    textFinding("email-like-text", /(?:@|mailto:)/iu, "text contains an email-like marker");
    textFinding("secret-like-text", /(?:token|secret|password|api[_-]?key)/iu, "text contains a secret-like keyword");
    if (/\.(?:tmp|log|bak|old|swp)$/iu.test(file.name)) {
      risks.push("temporary or backup extension");
      findings.push({ category: "temporary-backup-name", evidence: `filename extension ${extensionOf(file.name) || "(none)"}` });
    }
    if (file.size === 0) {
      risks.push("file is zero bytes");
      findings.push({ category: "empty-file", evidence: "size=0 bytes" });
    }
    if (detectedMime === "application/octet-stream" && content === null) {
      risks.push("content signature is not verified as a supported text format");
      findings.push({ category: "unverified-signature", evidence: "bounded signature detector returned application/octet-stream" });
    }
    const containers = container?.containers ?? [];
    const fields = container?.fields ?? [];
    if (containers.includes("encrypted")) {
      risks.push("the file is encrypted, so its metadata cannot be inspected here");
      findings.push({ category: "encrypted-container", evidence: "encrypted container marker detected" });
    }
    if (fields.some((field) => LOCATION_METADATA_FIELDS.has(field))) {
      risks.push("the file carries a GPS tag");
      findings.push({ category: "location-metadata", evidence: "GPSInfoIFD" });
    }
    if (fields.length > 0) {
      risks.push("the file carries embedded metadata fields");
      findings.push({ category: "embedded-metadata", evidence: fields.join(", ") });
    }
    const scanCoverage = container === null
      ? detectedMime === "application/octet-stream" || content !== null ? "text-markers" : "not-inspectable"
      : container.containers.length === 0 ? "container-parsed-no-metadata" : "container-parsed";
    results.push({
      file: pathOf(file),
      size: file.size,
      detectedMime,
      risks,
      riskCount: risks.length,
      inspectedText: content !== null,
      metadataContainers: containers,
      metadataFields: fields,
      findings,
      scanCoverage,
    });
  }
  return {
    operation: "metadata-risk-inspector",
    files: results,
    riskFileCount: results.filter((result) => Number(result.riskCount ?? 0) > 0).length,
    note: "Bounded local inspection: a text marker pass plus a structural pass over the JPEG, PNG, TIFF and PDF metadata containers read from a bounded prefix. Compressed or object-stream PDF metadata is not decompressed, so a clean report is not a guarantee.",
  };
}

export async function safeShareChecklist(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const files = fileList(source.files);
  const recipientConfirmed = source.recipientConfirmed === true;
  const sensitiveContentReviewed = source.sensitiveContentReviewed === true;
  const [metadata, secrets] = await Promise.all([inspectMetadataRisk({ files }, signal), scanSecretPatterns({ files }, signal)]);
  const metadataResults = metadata.files as Array<Record<string, unknown>>;
  const secretResults = secrets.findings as SecretFinding[];
  const checks = [
    { id: "no-empty-files", label: "No zero-byte files are included", passed: metadataResults.every((result) => result.size !== 0), detail: `${metadataResults.filter((result) => result.size === 0).length} empty file(s)` },
    { id: "no-secret-patterns", label: "No obvious secret/token patterns were found", passed: secretResults.length === 0, detail: `${secretResults.length} finding(s)` },
    { id: "no-metadata-markers", label: "No metadata-like text markers were found", passed: metadataResults.every((result) => Array.isArray(result.risks) && !(result.risks as string[]).some((risk) => risk.includes("metadata"))), detail: `${metadataResults.filter((result) => Array.isArray(result.risks) && (result.risks as string[]).some((risk) => risk.includes("metadata"))).length} file(s) flagged` },
    { id: "safe-names", label: "File names contain no temporary/backup markers", passed: metadataResults.every((result) => !/\.(?:tmp|log|bak|old|swp)$/iu.test(String(result.file))), detail: "Names are checked locally" },
    { id: "recipient-confirmed", label: "Recipient/audience has been explicitly confirmed", passed: recipientConfirmed, detail: recipientConfirmed ? "Confirmed by the user" : "User confirmation required" },
    { id: "sensitive-context-reviewed", label: "Sensitive-content context has been explicitly reviewed", passed: sensitiveContentReviewed, detail: sensitiveContentReviewed ? "Confirmed by the user" : "User confirmation required" },
  ];
  return { operation: "safe-share-checklist", files: files.map((file) => pathOf(file)), checks, userContext: { recipientConfirmed, sensitiveContentReviewed }, passedCount: checks.filter((check) => check.passed).length, totalChecks: checks.length, allPassed: checks.every((check) => check.passed), note: "A checklist is guidance based on detected local facts plus your explicit confirmations, not a guarantee that a file is safe to publish." };
}

export async function clientHandoffIndex(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const files = fileList(source.files);
  const includeHashes = source.includeHashes !== false;
  const entries = includeHashes ? await fileDigests(files, signal) : recordsFor(files);
  const title = typeof source.title === "string" && source.title.trim() !== "" ? source.title.trim().replace(/[\r\n]+/gu, " ").slice(0, 120) : "Client handoff";
  const json = JSON.stringify({ schema: "local-utility-handoff-index-v1", title, files: entries }, null, 2);
  const markdownLines = [
    `# ${title}`,
    "",
    `| Path | Bytes |${includeHashes ? " SHA-256 |" : ""}`,
    `| --- | ---: |${includeHashes ? " --- |" : ""}`,
    ...entries.map((entry) => includeHashes && "sha256" in entry ? `| ${entry.path} | ${entry.size} | ${entry.sha256} |` : `| ${entry.path} | ${entry.size} |`),
    "",
  ];
  const markdown = markdownLines.join("\n");
  return { operation: "client-handoff-index-generator", title, includeHashes, files: entries, json, markdown, count: entries.length };
}

/**
 * Paths are compared after sanitisation, so the maps must be keyed the same way.
 * Two selections whose names sanitise to the same path would otherwise silently
 * overwrite one another and produce a wrong diff, so the tool fails closed.
 */
function indexByPath(files: readonly File[], side: string): Map<string, { record: FileRecord; file: File }> {
  const result = new Map<string, { record: FileRecord; file: File }>();
  recordsFor(files).forEach((record, index) => {
    const file = files[index];
    if (file === undefined) fail("IO_FAILED", "File record could not be prepared");
    if (result.has(record.path)) fail("INVALID_INPUT", `${side} contains two files that resolve to the same relative path: ${record.path}`);
    result.set(record.path, { record, file });
  });
  return result;
}

function diffLists(
  before: ReadonlyMap<string, { record: FileRecord }>,
  after: ReadonlyMap<string, { record: FileRecord }>,
): Array<{ path: string; before: FileRecord | null; after: FileRecord | null; status: string }> {
  const paths = [...new Set([...before.keys(), ...after.keys()])].toSorted((left, right) => left.localeCompare(right));
  return paths.map((path) => {
    const oldValue = before.get(path);
    const newValue = after.get(path);
    const status = oldValue === undefined ? "added" : newValue === undefined ? "removed" : oldValue.record.size === newValue.record.size ? "unchanged" : "changed";
    return { path, before: oldValue?.record ?? null, after: newValue?.record ?? null, status };
  });
}

export async function fileListDiff(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const source = recordOf(input);
  const before = fileList(source.before, "before");
  const after = fileList(source.after, "after");
  const compareHashes = source.compareHashes === true;
  const beforeByPath = indexByPath(before, "before");
  const afterByPath = indexByPath(after, "after");
  const differences = await Promise.all(diffLists(beforeByPath, afterByPath).map(async (difference) => {
    if (!compareHashes || difference.status === "added" || difference.status === "removed") return difference;
    const oldFile = beforeByPath.get(difference.path)?.file;
    const newFile = afterByPath.get(difference.path)?.file;
    if (oldFile === undefined || newFile === undefined) return difference;
    const [oldHash, newHash] = await Promise.all([digestFile(oldFile, signal), digestFile(newFile, signal)]);
    return { ...difference, status: oldHash === newHash ? "unchanged" : "changed" };
  }));
  return { operation: "file-list-diff", differences, addedCount: differences.filter((difference) => difference.status === "added").length, removedCount: differences.filter((difference) => difference.status === "removed").length, changedCount: differences.filter((difference) => difference.status === "changed").length, unchangedCount: differences.filter((difference) => difference.status === "unchanged").length, comparedBytes: before.reduce((sum, file) => sum + file.size, 0) + after.reduce((sum, file) => sum + file.size, 0), compareHashes };
}

export async function folderCompare(input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  const result = await fileListDiff(input, signal);
  return { ...result, operation: "folder-compare" };
}

export function zeroByteOrphanFinder(input: unknown): FilePrivacyResult {
  const source = recordOf(input);
  const files = fileList(source.files);
  const records = recordsFor(files);
  const references = new Set<string>();
  const rawReferences = source.references;
  if (typeof rawReferences === "string") {
    for (const line of rawReferences.split(/[\r\n,]/u)) {
      const trimmed = line.trim();
      if (trimmed !== "") references.add(trimmed);
    }
  } else if (Array.isArray(rawReferences)) {
    for (const reference of rawReferences) {
      if (typeof reference !== "string" || reference.trim() === "") fail("INVALID_INPUT", "References must be non-empty strings");
      references.add(reference.trim());
    }
  } else if (rawReferences !== undefined) fail("INVALID_INPUT", "references must be text or an array");
  const known = new Set(records.map((record) => record.path));
  const orphanPaths = [...references].filter((reference) => !known.has(reference)).toSorted((left, right) => left.localeCompare(right));
  const unreferenced = records.filter((record) => !references.has(record.path));
  return { operation: "zero-byte-orphan-finder", emptyFiles: records.filter((record) => record.empty).map((record) => record.path), unreferencedFiles: unreferenced.map((record) => record.path), orphanReferences: orphanPaths, referencedCount: references.size, fileCount: records.length, note: "An orphan is a referenced path that is absent from the selected file list; browser folder selection exposes files, not directory metadata." };
}

export async function runFilePrivacyOperation(operation: FilePrivacyOperation, input: unknown, signal?: AbortSignal): Promise<FilePrivacyResult> {
  switch (operation) {
    case "file-hash": {
      const files = fileList(recordOf(input).files);
      if (files.length !== 1) fail("INVALID_INPUT", "File hash accepts exactly one file");
      const file = files[0];
      if (file === undefined) fail("INVALID_INPUT", "File is required");
      const sha256 = await digestFile(file, signal);
      return { operation, file: pathOf(file), sha256, bytes: file.size };
    }
    case "batch-checksum-manifest": return batchChecksumManifest(input, signal);
    case "checksum-verifier": return verifyChecksums(input, signal);
    case "file-signature-detector": {
      const files = fileList(recordOf(input).files);
      return { operation, files: await Promise.all(files.map((file) => detectFileSignature(file, signal))) };
    }
    case "file-size-analyzer": return analyzeFileSize(input, signal);
    case "ai-code-fence-bundle": return createAiCodeFenceBundle(input, signal);
    case "folder-inventory": return folderInventory(input);
    case "folder-size-type-summary": return folderSizeTypeSummary(input);
    case "duplicate-file-finder": return duplicateFileFinder(input, signal);
    case "filename-sanitizer": return filenameSanitizer(input);
    case "batch-rename-preview": return batchRenamePreview(input);
    case "zip-contents-inspector": return inspectZip(input, signal);
    case "zip-creator": return createZip(input, signal);
    case "clean-zip-creator": return createCleanZip(input, signal);
    case "archive-checksum-manifest": return archiveChecksumManifest(input, signal);
    case "metadata-risk-inspector": return inspectMetadataRisk(input, signal);
    case "secret-token-pattern-scanner": return scanSecretPatterns(input, signal);
    case "safe-share-checklist": return safeShareChecklist(input, signal);
    case "client-handoff-index-generator": return clientHandoffIndex(input, signal);
    case "file-list-diff": return fileListDiff(input, signal);
    case "folder-compare": return folderCompare(input, signal);
    case "zero-byte-orphan-finder": return zeroByteOrphanFinder(input);
  }
}
