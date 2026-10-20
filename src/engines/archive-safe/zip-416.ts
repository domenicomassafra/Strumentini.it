import { Inflate } from "fflate";
import { checkZipEntryType407, checkZipPath407 } from "../../runtime/file-threat-gate-407";

export const ARCHIVE_416_LIMITS = {
  maxInputBytes: 12 * 1024 * 1024,
  maxFiles: 32,
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 24 * 1024 * 1024,
  maxExpansionRatio: 250,
  maxPathBytes: 256,
} as const;

export class Archive416Error extends Error {
  constructor(readonly code: "INVALID_INPUT" | "UNSUPPORTED_ARCHIVE" | "CORRUPT_ARCHIVE" |
    "UNSAFE_ARCHIVE_PATH" | "ARCHIVE_TOO_LARGE" | "CANCELLED", message: string) {
    super(message);
    this.name = "Archive416Error";
  }
}

const bad = (code: Archive416Error["code"], message: string): never => { throw new Archive416Error(code, message); };
export const cancelled416 = (signal?: AbortSignal): void => {
  if (signal?.aborted) bad("CANCELLED", "Elaborazione annullata");
};
const u16 = (v: DataView, i: number): number => {
  if (i < 0 || i + 2 > v.byteLength) bad("CORRUPT_ARCHIVE", "Campo ZIP troncato");
  return v.getUint16(i, true);
};
const u32 = (v: DataView, i: number): number => {
  if (i < 0 || i + 4 > v.byteLength) bad("CORRUPT_ARCHIVE", "Campo ZIP troncato");
  return v.getUint32(i, true);
};
const utf8 = new TextDecoder("utf-8", { fatal: true });

export function safeArchivePath416(name: string, directory = false): string {
  if (typeof name !== "string" || !name || (directory && !name.endsWith("/"))) {
    bad("UNSAFE_ARCHIVE_PATH", "Nome di file non valido");
  }
  const problem = checkZipPath407(name);
  if (problem || new TextEncoder().encode(name).byteLength > ARCHIVE_416_LIMITS.maxPathBytes) {
    bad("UNSAFE_ARCHIVE_PATH", "Percorso ZIP ambiguo, assoluto o non sicuro");
  }
  if (/\.(?:zip|gz|gzip|tgz|tar|7z|rar|jar)$/iu.test(name.replace(/\/$/u, ""))) {
    bad("UNSUPPORTED_ARCHIVE", "Archivi annidati non supportati");
  }
  return name;
}

export function refuseNested416(bytes: Uint8Array): void {
  if ((bytes[0] === 0x50 && bytes[1] === 0x4b && (
    (bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6))) ||
    (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
    bad("UNSUPPORTED_ARCHIVE", "Archivio annidato rilevato dai byte");
  }
}

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let k = 0; k < 8; k++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n >>> 0;
});
export function crc416(crc: number, bytes: Uint8Array): number {
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255]! ^ (crc >>> 8);
  return crc >>> 0;
}
export const crcFinal416 = (bytes: Uint8Array): number => (crc416(0xffffffff, bytes) ^ 0xffffffff) >>> 0;

export interface Extracted416 {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly packedBytes: number;
  readonly method: "store" | "deflate" | "gzip";
}
interface ZipMember {
  path: string;
  compressed: number;
  expanded: number;
  crc: number;
  method: 0 | 8;
  offset: number;
  flags: number;
  directory: boolean;
}

function utf8Name(bytes: Uint8Array, flags: number): string {
  if ((flags & 0x800) === 0 && bytes.some((b) => b > 127)) {
    bad("UNSUPPORTED_ARCHIVE", "Nomi ZIP legacy non UTF-8 non supportati");
  }
  try { return utf8.decode(bytes); } catch { return bad("CORRUPT_ARCHIVE", "Nome ZIP con UTF-8 malformato"); }
}

function noZip64(bytes: Uint8Array, from: number, length: number, v: DataView): void {
  const end = from + length;
  if (end > bytes.byteLength) bad("CORRUPT_ARCHIVE", "ZIP extra field troncato");
  for (let p = from; p < end;) {
    if (p + 4 > end) bad("CORRUPT_ARCHIVE", "ZIP extra field troncato");
    const type = u16(v, p), size = u16(v, p + 2);
    p += 4;
    if (p + size > end) bad("CORRUPT_ARCHIVE", "ZIP extra field fuori dai limiti");
    if (type === 1) bad("UNSUPPORTED_ARCHIVE", "ZIP64 non supportato");
    p += size;
  }
}

/** Fail-closed preflight of every central and local header before inflation. */
export function extractZip416(input: Uint8Array, signal?: AbortSignal): Extracted416[] {
  cancelled416(signal);
  if (input.byteLength < 22 || input.byteLength > ARCHIVE_416_LIMITS.maxInputBytes ||
      input[0] !== 0x50 || input[1] !== 0x4b) {
    bad("ARCHIVE_TOO_LARGE", "ZIP assente o superiore a 12 MiB");
  }
  const v = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let eocd = -1;
  for (let p = input.length - 22; p >= Math.max(0, input.length - 22 - 65535); p--) {
    if (u32(v, p) === 0x06054b50 && p + 22 + u16(v, p + 20) === input.length) { eocd = p; break; }
  }
  if (eocd < 0) bad("CORRUPT_ARCHIVE", "Directory finale ZIP assente");
  const count = u16(v, eocd + 10), dirSize = u32(v, eocd + 12), dirStart = u32(v, eocd + 16);
  if (u16(v, eocd + 4) || u16(v, eocd + 6) || u16(v, eocd + 8) !== count ||
      count === 65535 || dirSize === 0xffffffff || dirStart === 0xffffffff) {
    bad("UNSUPPORTED_ARCHIVE", "ZIP multi-disco o ZIP64 non supportato");
  }
  if (count > ARCHIVE_416_LIMITS.maxFiles || dirStart + dirSize !== eocd) {
    bad("ARCHIVE_TOO_LARGE", "Numero voci o directory ZIP fuori dai limiti");
  }
  const members: ZipMember[] = [];
  const names = new Set<string>();
  let at = dirStart, total = 0;
  for (let index = 0; index < count; index++) {
    cancelled416(signal);
    if (at + 46 > eocd || u32(v, at) !== 0x02014b50) bad("CORRUPT_ARCHIVE", "Voce centrale ZIP non valida");
    const madeBy = u16(v, at + 4), flags = u16(v, at + 8), method = u16(v, at + 10);
    const crc = u32(v, at + 16), compressed = u32(v, at + 20), expanded = u32(v, at + 24);
    const nameLength = u16(v, at + 28), extraLength = u16(v, at + 30), commentLength = u16(v, at + 32);
    const end = at + 46 + nameLength + extraLength + commentLength;
    if (end > eocd || nameLength > ARCHIVE_416_LIMITS.maxPathBytes) bad("CORRUPT_ARCHIVE", "Metadati voce ZIP fuori dai limiti");
    if ((flags & ~0x808) !== 0 || (method !== 0 && method !== 8)) {
      bad("UNSUPPORTED_ARCHIVE", "Cifratura o metodo ZIP non supportato");
    }
    if (compressed === 0xffffffff || expanded === 0xffffffff) bad("UNSUPPORTED_ARCHIVE", "ZIP64 non supportato");
    const path = safeArchivePath416(utf8Name(input.subarray(at + 46, at + 46 + nameLength), flags),
      input[at + 46 + nameLength - 1] === 47);
    if (checkZipEntryType407(madeBy, u32(v, at + 38), path)) bad("UNSUPPORTED_ARCHIVE", "Link o device ZIP non consentito");
    const key = path.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\/$/u, "");
    if (names.has(key)) bad("UNSAFE_ARCHIVE_PATH", "Percorso ZIP duplicato");
    names.add(key);
    if (expanded > ARCHIVE_416_LIMITS.maxFileBytes || expanded > ARCHIVE_416_LIMITS.maxTotalBytes - total ||
        (compressed === 0 ? expanded > 0 : expanded > compressed * ARCHIVE_416_LIMITS.maxExpansionRatio)) {
      bad("ARCHIVE_TOO_LARGE", "Archivio ZIP potenzialmente esplosivo");
    }
    total += expanded;
    noZip64(input, at + 46 + nameLength, extraLength, v);
    members.push({ path, compressed, expanded, crc, method: method as 0 | 8, offset: u32(v, at + 42), flags, directory: path.endsWith("/") });
    at = end;
  }
  if (at !== eocd) bad("CORRUPT_ARCHIVE", "Dimensione directory ZIP non coerente");
  for (const name of names) {
    const parts = name.split("/");
    for (let j = 1; j < parts.length; j++) {
      if (names.has(parts.slice(0, j).join("/"))) {
        const found = members.find((m) => m.path.toLocaleLowerCase("en-US").replace(/\/$/u, "") === parts.slice(0, j).join("/"));
        if (found && !found.directory) bad("UNSAFE_ARCHIVE_PATH", "Collisione tra file e directory ZIP");
      }
    }
  }
  const ranges: Array<[number, number]> = [];
  const output: Extracted416[] = [];
  for (const m of members) {
    cancelled416(signal);
    if (m.offset + 30 > dirStart || u32(v, m.offset) !== 0x04034b50 ||
        u16(v, m.offset + 6) !== m.flags || u16(v, m.offset + 8) !== m.method) {
      bad("CORRUPT_ARCHIVE", "Header locale ZIP discordante");
    }
    const n = u16(v, m.offset + 26), x = u16(v, m.offset + 28);
    const dataStart = m.offset + 30 + n + x, dataEnd = dataStart + m.compressed;
    if (dataEnd > dirStart || n > ARCHIVE_416_LIMITS.maxPathBytes) bad("CORRUPT_ARCHIVE", "Contenuto ZIP fuori directory");
    if (utf8Name(input.subarray(m.offset + 30, m.offset + 30 + n), m.flags) !== m.path) {
      bad("CORRUPT_ARCHIVE", "Percorso locale ZIP discordante");
    }
    noZip64(input, m.offset + 30 + n, x, v);
    if ((m.flags & 8) === 0 && (u32(v, m.offset + 14) !== m.crc ||
      u32(v, m.offset + 18) !== m.compressed || u32(v, m.offset + 22) !== m.expanded)) {
      bad("CORRUPT_ARCHIVE", "CRC o dimensioni locali ZIP discordanti");
    }
    let recordEnd = dataEnd;
    if ((m.flags & 8) !== 0) {
      const signed = dataEnd + 4 <= dirStart && u32(v, dataEnd) === 0x08074b50;
      const descriptor = dataEnd + (signed ? 4 : 0);
      recordEnd = descriptor + 12;
      if (recordEnd > dirStart || u32(v, descriptor) !== m.crc ||
          u32(v, descriptor + 4) !== m.compressed || u32(v, descriptor + 8) !== m.expanded) {
        bad("CORRUPT_ARCHIVE", "Descriptor ZIP mancante o discordante");
      }
    }
    ranges.push([m.offset, recordEnd]);
    const packed = input.subarray(dataStart, dataEnd);
    let length = 0, runningCrc = 0xffffffff;
    const chunks: Uint8Array[] = [];
    const receive = (chunk: Uint8Array): void => {
      cancelled416(signal);
      length += chunk.byteLength;
      if (length > m.expanded || length > ARCHIVE_416_LIMITS.maxFileBytes) {
        bad("ARCHIVE_TOO_LARGE", "Inflazione ZIP superiore al limite");
      }
      runningCrc = crc416(runningCrc, chunk);
      chunks.push(chunk.slice());
    };
    if (m.method === 0) receive(packed);
    else {
      if (packed.byteLength === 0) bad("CORRUPT_ARCHIVE", "Stream DEFLATE vuoto");
      try {
        const inflator = new Inflate((data) => receive(data));
        for (let i = 0; i < packed.length; i += 256) {
          inflator.push(packed.subarray(i, i + 256), i + 256 >= packed.length);
        }
      } catch (error) {
        if (error instanceof Archive416Error) throw error;
        bad("CORRUPT_ARCHIVE", "Stream DEFLATE ZIP corrotto");
      }
    }
    if (length !== m.expanded || ((runningCrc ^ 0xffffffff) >>> 0) !== m.crc) {
      bad("CORRUPT_ARCHIVE", "Dimensioni o CRC32 ZIP non validi");
    }
    if (m.directory) {
      if (length !== 0) bad("CORRUPT_ARCHIVE", "Directory ZIP con contenuto");
    } else {
      const bytes = new Uint8Array(length);
      let at = 0;
      for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
      refuseNested416(bytes);
      output.push({ path: m.path, bytes, packedBytes: m.compressed, method: m.method === 0 ? "store" : "deflate" });
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < ranges.length; i++) {
    if (ranges[i]![0] !== (i === 0 ? 0 : ranges[i - 1]![1])) {
      bad("CORRUPT_ARCHIVE", "ZIP con gap, prefisso o record sovrapposti");
    }
  }
  if (ranges.length && ranges.at(-1)![1] !== dirStart) bad("CORRUPT_ARCHIVE", "ZIP con dati locali non verificati");
  return output;
}
