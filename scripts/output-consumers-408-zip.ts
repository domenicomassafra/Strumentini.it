/** Strict, independent ZIP32 central-directory and CRC consumer for #408. */
import { unzipSync } from "fflate";

export const OUTPUT_408_MAX_ZIP_PARTS = 128;
export const OUTPUT_408_MAX_EXPANDED_BYTES = 8 * 1024 * 1024;
const OUTPUT_408_MAX_BYTES = 4 * 1024 * 1024;
const UTF8 = new TextDecoder("utf-8", { fatal: true });
function verify(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}

function crc32408(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Inspect ZIP central directory BEFORE decompression to enforce cumulative
 * expansion bounds and forbid hidden members/overlapping range tricks.
 * Uses only the canonical bounded no-comment ZIP32 produced by the app. */
function zipCentral408(bytes: Uint8Array): Map<string, { size: number; crc: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  verify(end >= 0 && view.getUint32(end, true) === 0x06054b50, "ZIP_EOCD_INVALID");
  const entries = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  verify(view.getUint16(end + 8, true) === entries && entries > 0 && entries <= OUTPUT_408_MAX_ZIP_PARTS, "ZIP_MEMBER_COUNT_INVALID");
  verify(view.getUint16(end + 4, true) === 0 && view.getUint16(end + 6, true) === 0, "ZIP_MULTI_DISK_REFUSED");
  verify(centralOffset + centralSize === end && centralOffset >= 30, "ZIP_CENTRAL_DIRECTORY_RANGE_INVALID");
  const inventory = new Map<string, { size: number; crc: number }>();
  let uncompressedTotal = 0;
  let offset = centralOffset;
  for (let i = 0; i < entries; i++) {
    verify(offset + 46 <= end && view.getUint32(offset, true) === 0x02014b50, "ZIP_BAD_CENTRAL_HEADER");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 24, true);
    const compressed = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    verify((flags & 0x0001) === 0 && (method === 0 || method === 8), "ZIP_ENCRYPTION_OR_COMPRESSION_REFUSED");
    verify(size <= OUTPUT_408_MAX_EXPANDED_BYTES && compressed <= OUTPUT_408_MAX_BYTES, "ZIP_MEMBER_RESOURCE_LIMIT");
    uncompressedTotal += size;
    verify(uncompressedTotal <= OUTPUT_408_MAX_EXPANDED_BYTES, "ZIP_CUMULATIVE_EXPANSION_LIMIT");
    verify(nameLen > 0 && nameLen <= 240 && offset + 46 + nameLen + extraLen + commentLen <= end, "ZIP_BAD_CENTRAL_NAME_RANGE");
    const name = UTF8.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    // JSZip writes canonical directory records with zero-byte data.
    // Zero-length regular files remain refused by the independent consumer.
    verify(size > 0 || (name.endsWith("/") && compressed === 0), "ZIP_MEMBER_RESOURCE_LIMIT");
    verify(!name.startsWith("/") && !name.includes("..") && !name.includes("\\") && !inventory.has(name), "ZIP_UNSAFE_OR_DUPLICATE_PART");
    verify(localOffset + 30 < centralOffset && view.getUint32(localOffset, true) === 0x04034b50, "ZIP_LOCAL_HEADER_RANGE_INVALID");
    inventory.set(name, { size, crc: view.getUint32(offset + 16, true) });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  verify(offset === end, "ZIP_CENTRAL_DIRECTORY_TRAILING_GARBAGE");
  return inventory;
}

export function zipParts408(bytes: Uint8Array): Record<string, Uint8Array> {
  const declared = zipCentral408(bytes);
  const input = unzipSync(bytes, { filter: (file) => {
    verify(file.originalSize <= OUTPUT_408_MAX_EXPANDED_BYTES, "ZIP_BOMB_ENTRY");
    return true;
  } });
  const entries = Object.entries(input);
  verify(entries.length === declared.size, "ZIP_MEMBER_SET_MISMATCH");
  verify(entries.reduce((sum, [, value]) => sum + value.length, 0) <= OUTPUT_408_MAX_EXPANDED_BYTES, "ZIP_EXPANSION_BUDGET");
  for (const [name, decoded] of entries) {
    const wanted = declared.get(name);
    verify(wanted && wanted.size === decoded.length && wanted.crc === crc32408(decoded), "ZIP_CRC_OR_UNCOMPRESSED_LENGTH_MISMATCH");
  }
  return input;
}

