import { checkZipEntryType407, checkZipPath407 } from "../../runtime/file-threat-gate-407";
import { Inflate } from "fflate";

export const OOXML_PACKAGE_LIMITS = {
  maxInputBytes: 20 * 1024 * 1024,
  maxEntries: 2_048,
  maxEntryNameBytes: 2_048,
  maxEntryUncompressedBytes: 12 * 1024 * 1024,
  maxTotalUncompressedBytes: 20 * 1024 * 1024,
  maxExpansionRatio: 100,
} as const;

export type OoxmlPackageKind = "docx" | "pptx" | "xlsx";
export type OoxmlEntryClass = "xml" | "media" | "font" | "other";

export interface OoxmlZipEntry {
  readonly path: string;
  readonly classification: OoxmlEntryClass;
  readonly compressionMethod: 0 | 8;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly crc32: number;
  readonly expansionRatio: number;
  readonly localHeaderOffset: number;
}

export interface OoxmlPackageAnalysis {
  readonly kind: OoxmlPackageKind;
  readonly entryCount: number;
  readonly entries: readonly OoxmlZipEntry[];
  readonly classCounts: Readonly<Record<OoxmlEntryClass, number>>;
  readonly totalCompressedMemberBytes: number;
  readonly totalUncompressedBytes: number;
  readonly documentCount: number;
  readonly slideCount: number;
  readonly sheetCount: number;
  readonly relationshipPartCount: number;
  readonly hasContentTypes: true;
  readonly macroPolicy: "refused";
  readonly encryptedPolicy: "refused";
  readonly externalRelationshipPolicy: "preserve-inert-never-resolve";
}

export type OoxmlPackageErrorCode =
  | "INVALID_INPUT"
  | "PACKAGE_TOO_LARGE"
  | "CORRUPT_PACKAGE"
  | "ZIP64_UNSUPPORTED"
  | "UNSUPPORTED_COMPRESSION"
  | "ENCRYPTED_PACKAGE_UNSUPPORTED"
  | "UNSAFE_PACKAGE_PATH"
  | "EXPANSION_LIMIT"
  | "MACRO_PACKAGE_UNSUPPORTED"
  | "UNSUPPORTED_PACKAGE_KIND"
  | "REBUILD_VERIFICATION_FAILED"
  | "OUTPUT_TOO_LARGE";

export class OoxmlPackageError extends Error {
  constructor(readonly code: OoxmlPackageErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "OoxmlPackageError";
  }
}

const decoder = new TextDecoder("utf-8", { fatal: true });
const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

function updateCrc32(crc: number, chunk: Uint8Array): number {
  for (const byte of chunk) crc = CRC32_TABLE[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return crc >>> 0;
}

function fail(code: OoxmlPackageErrorCode, message: string): never {
  throw new OoxmlPackageError(code, message);
}

function u16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) fail("CORRUPT_PACKAGE", "ZIP field exceeds package bounds.");
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) fail("CORRUPT_PACKAGE", "ZIP field exceeds package bounds.");
  return view.getUint32(offset, true);
}

function findEocd(bytes: Uint8Array, view: DataView): number {
  if (bytes.byteLength < 22) fail("CORRUPT_PACKAGE", "Package is too short to contain a ZIP directory.");
  const minimum = Math.max(0, bytes.byteLength - 22 - 65_535);
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (u32(view, offset) === 0x06054b50) {
      const commentLength = u16(view, offset + 20);
      if (offset + 22 + commentLength !== bytes.byteLength) continue;
      return offset;
    }
  }
  fail("CORRUPT_PACKAGE", "ZIP end-of-central-directory record was not found.");
}

function hasZip64Extra(bytes: Uint8Array, offset: number, length: number): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = offset;
  const end = offset + length;
  while (cursor + 4 <= end) {
    const id = u16(view, cursor);
    const size = u16(view, cursor + 2);
    cursor += 4;
    if (cursor + size > end) fail("CORRUPT_PACKAGE", "ZIP extra field exceeds declared bounds.");
    if (id === 0x0001) return true;
    cursor += size;
  }
  if (cursor !== end) fail("CORRUPT_PACKAGE", "ZIP extra field is truncated.");
  return false;
}

function safePath(path: string): string {
  const finding = checkZipPath407(path);
  if (finding !== null) fail("UNSAFE_PACKAGE_PATH", `Unsafe OOXML part path: ${finding.message}`);
  return path;
}

function classify(path: string): OoxmlEntryClass {
  if (/\.rels$/iu.test(path) || /\.xml$/iu.test(path)) return "xml";
  if (/(?:^|\/)media\//iu.test(path)) return "media";
  if (/(?:^|\/)fonts?\//iu.test(path) || /\.(?:odttf|ttf|otf|woff2?)$/iu.test(path)) return "font";
  return "other";
}

function packageKind(paths: ReadonlySet<string>): OoxmlPackageKind {
  if (paths.has("word/document.xml")) return "docx";
  if (paths.has("ppt/presentation.xml")) return "pptx";
  if (paths.has("xl/workbook.xml")) return "xlsx";
  fail("UNSUPPORTED_PACKAGE_KIND", "ZIP is not a supported DOCX, PPTX or XLSX OOXML package.");
}

function assertLocalHeader(bytes: Uint8Array, entry: Omit<OoxmlZipEntry, "classification" | "expansionRatio">, centralFlags: number, centralOffset: number): { dataStart: number; recordEnd: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;
  if (u32(view, offset) !== 0x04034b50) fail("CORRUPT_PACKAGE", `${entry.path}: local ZIP header signature is invalid.`);
  const flags = u16(view, offset + 6);
  const method = u16(view, offset + 8);
  if ((flags & 1) !== 0) fail("ENCRYPTED_PACKAGE_UNSUPPORTED", `${entry.path}: encrypted OOXML members are not supported.`);
  if (flags !== centralFlags) fail("CORRUPT_PACKAGE", `${entry.path}: local and central ZIP flags differ.`);
  if (method !== entry.compressionMethod) fail("CORRUPT_PACKAGE", `${entry.path}: local and central compression methods differ.`);
  if ((flags & 8) === 0 && (u32(view, offset + 14) !== entry.crc32 || u32(view, offset + 18) !== entry.compressedSize || u32(view, offset + 22) !== entry.uncompressedSize)) {
    fail("CORRUPT_PACKAGE", `${entry.path}: local and central member CRC or sizes differ.`);
  }
  const nameLength = u16(view, offset + 26);
  const extraLength = u16(view, offset + 28);
  const nameStart = offset + 30;
  const nameEnd = nameStart + nameLength;
  if (nameEnd + extraLength > bytes.byteLength) fail("CORRUPT_PACKAGE", `${entry.path}: local ZIP metadata exceeds package bounds.`);
  let localName: string;
  try {
    localName = decoder.decode(bytes.subarray(nameStart, nameEnd));
  } catch {
    fail("CORRUPT_PACKAGE", `${entry.path}: local member name is not UTF-8.`);
  }
  if (localName !== entry.path) fail("CORRUPT_PACKAGE", `${entry.path}: local and central member names differ.`);
  if (hasZip64Extra(bytes, nameEnd, extraLength)) fail("ZIP64_UNSUPPORTED", `${entry.path}: ZIP64 local metadata is outside the bounded OOXML path.`);
  const dataStart = nameEnd + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > centralOffset) fail("CORRUPT_PACKAGE", `${entry.path}: compressed member bytes overlap the ZIP directory.`);
  let recordEnd = dataEnd;
  if ((flags & 8) !== 0) {
    // ZIP bit-3 puts the authoritative CRC and sizes in an immediately
    // following data descriptor. A missing or mismatched descriptor must
    // never be accepted as a structurally valid OOXML member.
    const signed = dataEnd + 4 <= centralOffset && u32(view, dataEnd) === 0x08074b50;
    const descriptorStart = dataEnd + (signed ? 4 : 0);
    recordEnd = descriptorStart + 12;
    if (recordEnd > centralOffset ||
        u32(view, descriptorStart) !== entry.crc32 ||
        u32(view, descriptorStart + 4) !== entry.compressedSize ||
        u32(view, descriptorStart + 8) !== entry.uncompressedSize) {
      fail("CORRUPT_PACKAGE", `${entry.path}: ZIP data descriptor is missing or disagrees with verified central metadata.`);
    }
  }
  return { dataStart, recordEnd };
}

/** Verify real DEFLATE output before any downstream unzipSync trusts ZIP sizes.
 * Tiny input chunks bound peak inflate allocation, and output is never retained.
 */
function verifyMemberPayload(bytes: Uint8Array, entry: Omit<OoxmlZipEntry, "classification" | "expansionRatio">, dataStart: number, remainingBudget: number): number {
  const packed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  let expanded = 0;
  let crc = 0xffffffff;
  const accept = (chunk: Uint8Array): void => {
    expanded += chunk.byteLength;
    if (expanded > entry.uncompressedSize || expanded > OOXML_PACKAGE_LIMITS.maxEntryUncompressedBytes || expanded > remainingBudget) {
      fail("EXPANSION_LIMIT", `${entry.path}: actual DEFLATE output exceeds the verified ZIP expansion budget.`);
    }
    crc = updateCrc32(crc, chunk);
  };
  if (entry.compressionMethod === 0) {
    accept(packed);
  } else {
    if (packed.byteLength === 0) fail("CORRUPT_PACKAGE", `${entry.path}: empty DEFLATE stream.`);
    let finished = false;
    try {
      const inflator = new Inflate((chunk, final) => {
        accept(chunk);
        if (final) finished = true;
      });
      for (let at = 0; at < packed.byteLength; at += 256) {
        inflator.push(packed.subarray(at, Math.min(at + 256, packed.byteLength)), at + 256 >= packed.byteLength);
      }
    } catch (error) {
      if (error instanceof OoxmlPackageError) throw error;
      fail("CORRUPT_PACKAGE", `${entry.path}: DEFLATE payload could not be verified.`);
    }
    if (!finished) fail("CORRUPT_PACKAGE", `${entry.path}: DEFLATE stream ended before verification.`);
  }
  if (expanded !== entry.uncompressedSize) fail("CORRUPT_PACKAGE", `${entry.path}: actual expanded length differs from ZIP metadata.`);
  if (((crc ^ 0xffffffff) >>> 0) !== entry.crc32) fail("CORRUPT_PACKAGE", `${entry.path}: actual CRC32 differs from ZIP metadata.`);
  return expanded;
}

export function analyzeOoxmlPackage(input: ArrayBuffer | Uint8Array): OoxmlPackageAnalysis {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength === 0) fail("INVALID_INPUT", "OOXML package bytes are required.");
  if (bytes.byteLength > OOXML_PACKAGE_LIMITS.maxInputBytes) fail("PACKAGE_TOO_LARGE", "OOXML package exceeds the bounded local input limit.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes, view);
  const disk = u16(view, eocd + 4);
  const centralDisk = u16(view, eocd + 6);
  const diskEntries = u16(view, eocd + 8);
  const entryCount = u16(view, eocd + 10);
  const centralSize = u32(view, eocd + 12);
  const centralOffset = u32(view, eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount) fail("ZIP64_UNSUPPORTED", "Multi-disk ZIP packages are outside the bounded OOXML path.");
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) fail("ZIP64_UNSUPPORTED", "ZIP64 OOXML packages are outside the bounded local path.");
  if (entryCount < 1 || entryCount > OOXML_PACKAGE_LIMITS.maxEntries) fail("PACKAGE_TOO_LARGE", "OOXML member count exceeds the local limit.");
  if (centralOffset + centralSize > eocd || centralOffset < 0) fail("CORRUPT_PACKAGE", "ZIP central-directory bounds are invalid.");

  const entries: OoxmlZipEntry[] = [];
  const paths = new Set<string>();
  const canonicalPaths = new Set<string>();
  let cursor = centralOffset;
  let totalUncompressedBytes = 0;
  let totalCompressedMemberBytes = 0;
  let verifiedUncompressedBytes = 0;
  const localRecords: { start: number; end: number }[] = [];
  const payloadChecks: { entry: Omit<OoxmlZipEntry, "classification" | "expansionRatio">; flags: number }[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (u32(view, cursor) !== 0x02014b50) fail("CORRUPT_PACKAGE", `Central-directory entry ${index + 1} has an invalid signature.`);
    const flags = u16(view, cursor + 8);
    const method = u16(view, cursor + 10);
    const crc32 = u32(view, cursor + 16);
    const compressedSize = u32(view, cursor + 20);
    const uncompressedSize = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localHeaderOffset = u32(view, cursor + 42);
    if ((flags & 1) !== 0) fail("ENCRYPTED_PACKAGE_UNSUPPORTED", "Encrypted OOXML members are not supported.");
    if (method !== 0 && method !== 8) fail("UNSUPPORTED_COMPRESSION", `Compression method ${method} is not supported for bounded OOXML rebuild.`);
    if (nameLength < 1 || nameLength > OOXML_PACKAGE_LIMITS.maxEntryNameBytes) fail("PACKAGE_TOO_LARGE", "OOXML member name exceeds the local limit.");
    if (uncompressedSize > OOXML_PACKAGE_LIMITS.maxEntryUncompressedBytes) fail("EXPANSION_LIMIT", "OOXML member exceeds the per-entry expanded-byte limit.");
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    const next = nameEnd + extraLength + commentLength;
    if (next > centralOffset + centralSize) fail("CORRUPT_PACKAGE", "OOXML central-directory metadata exceeds its declared bounds.");
    if (hasZip64Extra(bytes, nameEnd, extraLength)) fail("ZIP64_UNSUPPORTED", "ZIP64 OOXML entries are outside the bounded local path.");
    let path: string;
    try {
      path = safePath(decoder.decode(bytes.subarray(nameStart, nameEnd)));
    } catch (error) {
      if (error instanceof OoxmlPackageError) throw error;
      fail("CORRUPT_PACKAGE", "OOXML member name is not valid UTF-8.");
    }
    const typeFinding = checkZipEntryType407(u16(view, cursor + 4), u32(view, cursor + 38), path);
    if (typeFinding !== null) fail("UNSAFE_PACKAGE_PATH", `${path}: ${typeFinding.message}`);
    const canonical = path.normalize("NFKC").toLowerCase().replace(/\/$/u, "");
    if (paths.has(path) || canonicalPaths.has(canonical)) fail("CORRUPT_PACKAGE", `Duplicate OOXML part path is not allowed: ${path}.`);
    paths.add(path);
    canonicalPaths.add(canonical);
    totalUncompressedBytes += uncompressedSize;
    totalCompressedMemberBytes += compressedSize;
    if (totalUncompressedBytes > OOXML_PACKAGE_LIMITS.maxTotalUncompressedBytes) fail("EXPANSION_LIMIT", "OOXML cumulative expanded bytes exceed the local limit.");
    const expansionRatio = compressedSize === 0 ? (uncompressedSize === 0 ? 1 : Number.POSITIVE_INFINITY) : uncompressedSize / compressedSize;
    if (expansionRatio > OOXML_PACKAGE_LIMITS.maxExpansionRatio) fail("EXPANSION_LIMIT", `${path}: declared expansion ratio ${expansionRatio.toFixed(2)} exceeds the local limit.`);
    const baseEntry = { path, compressionMethod: method as 0 | 8, compressedSize, uncompressedSize, crc32, localHeaderOffset };
    // Do not inspect even the first local CRC until all central member names
    // have been scanned: duplicate raw entries have diagnostic priority over
    // an independently corrupted hidden shadow member (#368 contract).
    payloadChecks.push({ entry: baseEntry, flags });
    entries.push({ ...baseEntry, classification: classify(path), expansionRatio });
    cursor = next;
  }
  if (cursor !== centralOffset + centralSize) fail("CORRUPT_PACKAGE", "ZIP central-directory size does not match parsed entries.");
  const verifiedPayloads: { entry: Omit<OoxmlZipEntry, "classification" | "expansionRatio">; dataStart: number }[] = [];
  for (const { entry, flags } of payloadChecks) {
    const { dataStart, recordEnd } = assertLocalHeader(bytes, entry, flags, centralOffset);
    localRecords.push({ start: entry.localHeaderOffset, end: recordEnd });
    verifiedPayloads.push({ entry, dataStart });
  }
  localRecords.sort((a, b) => a.start - b.start);
  for (let index = 1; index < localRecords.length; index += 1) {
    if (localRecords[index]!.start < localRecords[index - 1]!.end) {
      fail("CORRUPT_PACKAGE", "OOXML ZIP local header, member or descriptor records physically overlap.");
    }
  }
  for (const { entry, dataStart } of verifiedPayloads) {
    verifiedUncompressedBytes += verifyMemberPayload(bytes, entry, dataStart, OOXML_PACKAGE_LIMITS.maxTotalUncompressedBytes - verifiedUncompressedBytes);
  }
  const canonicalFiles = new Set(entries.filter(({ path }) => !path.endsWith("/"))
    .map(({ path }) => path.normalize("NFKC").toLowerCase()));
  for (const canonical of canonicalPaths) {
    const segments = canonical.split("/");
    for (let depth = 1; depth < segments.length; depth += 1) {
      if (canonicalFiles.has(segments.slice(0, depth).join("/"))) {
        fail("UNSAFE_PACKAGE_PATH", `OOXML member is beneath a regular-file path: ${canonical}.`);
      }
    }
  }
  if (!paths.has("[Content_Types].xml")) fail("CORRUPT_PACKAGE", "OOXML [Content_Types].xml part is missing.");
  if ([...paths].some((path) => /(?:^|\/)vbaProject\.bin$/iu.test(path) || /macroEnabled/iu.test(path))) {
    fail("MACRO_PACKAGE_UNSUPPORTED", "Macro-enabled OOXML packages are explicitly outside this bounded rebuild path.");
  }
  const kind = packageKind(paths);
  const classCounts: Record<OoxmlEntryClass, number> = { xml: 0, media: 0, font: 0, other: 0 };
  for (const entry of entries) classCounts[entry.classification] += 1;
  const documentCount = paths.has("word/document.xml") ? 1 : 0;
  const slideCount = [...paths].filter((path) => /^ppt\/slides\/slide\d+\.xml$/u.test(path)).length;
  const sheetCount = [...paths].filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/u.test(path)).length;
  const relationshipPartCount = [...paths].filter((path) => /\.rels$/u.test(path)).length;
  return {
    kind,
    entryCount,
    entries,
    classCounts,
    totalCompressedMemberBytes,
    totalUncompressedBytes,
    documentCount,
    slideCount,
    sheetCount,
    relationshipPartCount,
    hasContentTypes: true,
    macroPolicy: "refused",
    encryptedPolicy: "refused",
    externalRelationshipPolicy: "preserve-inert-never-resolve",
  };
}
