/** HEIF EXIF orientation fallback for libheif's already-transformed RGBA output.
 * Only metadata describing the primary item is used. Container irot/imir
 * properties take precedence: libheif applies those before returning pixels.
 */
import { abortIfNeeded, ImageVisualError } from "./visual";

type Box = { type: string; data: number; end: number };

function invalid(): never {
  throw new ImageVisualError("UNSUPPORTED_HEIC_ORIENTATION", "HEIC orientation metadata is incomplete or unsupported");
}

function number(bytes: Uint8Array, start: number, size: number): number {
  if (size < 0 || size > 8 || start < 0 || start + size > bytes.length) return invalid();
  let value = 0;
  for (let i = 0; i < size; i++) value = value * 256 + bytes[start + i]!;
  if (!Number.isSafeInteger(value)) return invalid();
  return value;
}

function fourcc(bytes: Uint8Array, start: number): string {
  if (start < 0 || start + 4 > bytes.length) return invalid();
  return String.fromCharCode(...bytes.subarray(start, start + 4));
}

function boxes(bytes: Uint8Array, first: number, end: number): Box[] {
  const result: Box[] = [];
  for (let at = first; at < end;) {
    if (result.length > 4096 || at + 8 > end) return invalid();
    let length = number(bytes, at, 4);
    let header = 8;
    if (length === 1) { length = number(bytes, at + 8, 8); header = 16; }
    if (length === 0) length = end - at;
    if (length < header || at + length > end) return invalid();
    result.push({ type: fourcc(bytes, at + 4), data: at + header, end: at + length });
    at += length;
  }
  return result;
}

function direct(children: Box[], type: string): Box | undefined {
  return children.find(child => child.type === type);
}

function exifTiffOrientation(bytes: Uint8Array): number {
  if (bytes.length < 12) return invalid();
  const tiff = 4 + number(bytes, 0, 4);
  const le = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  if (!le && !(bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d)) return invalid();
  const read16 = (at: number): number => le
    ? number(bytes, at, 1) + number(bytes, at + 1, 1) * 256 : number(bytes, at, 2);
  const read32 = (at: number): number => le
    ? read16(at) + read16(at + 2) * 65536 : number(bytes, at, 4);
  if (read16(tiff + 2) !== 42) return invalid();
  const ifd = tiff + read32(tiff + 4);
  const count = read16(ifd);
  if (count > 512 || ifd + 2 + count * 12 > bytes.length) return invalid();
  let orientation = 1;
  let foundOrientation = false;
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (read16(entry) !== 0x0112) continue;
    if (read16(entry + 2) !== 3 || read32(entry + 4) !== 1) return invalid();
    const value = read16(entry + 8);
    if (value < 1 || value > 8 || foundOrientation) return invalid();
    orientation = value;
    foundOrientation = true;
  }
  return orientation;
}

/** Returns the EXIF transform still needed after heic-to/libheif decoding. */
export async function additionalHeicOrientation(blob: Blob, signal?: AbortSignal): Promise<number> {
  abortIfNeeded(signal);
  // HEIF metadata usually precedes mdat; only bounded metadata is parsed.
  const header = new Uint8Array(await blob.slice(0, Math.min(blob.size, 512 * 1024)).arrayBuffer());
  abortIfNeeded(signal);
  let meta: Box | undefined;
  for (let at = 0; at + 8 <= blob.size;) {
    if (at + 16 > header.length) return invalid();
    let length = number(header, at, 4);
    const type = fourcc(header, at + 4);
    const size = length === 1 ? 16 : 8;
    if (length === 1) length = number(header, at + 8, 8);
    if (length === 0) length = blob.size - at;
    if (length < size || at + length > blob.size) return invalid();
    if (type === "meta") {
      if (at + length > header.length) return invalid();
      meta = { type, data: at + size, end: at + length };
      break;
    }
    at += length;
  }
  if (!meta) return invalid();
  const children = boxes(header, meta.data + 4, meta.end);
  const pitm = direct(children, "pitm");
  const iinf = direct(children, "iinf");
  const iref = direct(children, "iref");
  const iloc = direct(children, "iloc");
  if (!pitm || !iinf || !iloc) return invalid();
  const primary = number(header, pitm.data + 4, header[pitm.data] === 0 ? 2 : 4);

  // Identify the actual Exif item linked to the primary image, not a thumbnail.
  const information = boxes(header, iinf.data + (header[iinf.data] === 0 ? 6 : 8), iinf.end);
  const exifIds = new Set<number>();
  for (const info of information) {
    if (info.type !== "infe" || header[info.data]! < 2) continue;
    const idSize = header[info.data] === 2 ? 2 : 4;
    if (fourcc(header, info.data + 4 + idSize + 2) === "Exif") exifIds.add(number(header, info.data + 4, idSize));
  }
  let exifId: number | undefined;
  if (iref) {
    const idSize = header[iref.data] === 0 ? 2 : 4;
    for (const ref of boxes(header, iref.data + 4, iref.end)) {
      if (ref.type !== "cdsc") continue;
      let at = ref.data;
      const from = number(header, at, idSize); at += idSize;
      const count = number(header, at, 2); at += 2;
      if (count > 1024 || at + count * idSize > ref.end) return invalid();
      for (let i = 0; i < count; i++, at += idSize) {
        if (exifIds.has(from) && number(header, at, idSize) === primary) {
          if (exifId !== undefined && exifId !== from) return invalid();
          exifId = from;
        }
      }
    }
  }

  const iprp = direct(children, "iprp");
  if (iprp) {
    const parts = boxes(header, iprp.data, iprp.end);
    const ipco = direct(parts, "ipco");
    const ipma = direct(parts, "ipma");
    if (ipco && ipma) {
      const properties = boxes(header, ipco.data, ipco.end);
      const version = header[ipma.data]!;
      const wide = (header[ipma.data + 3]! & 1) !== 0;
      const itemBytes = version < 1 ? 2 : 4;
      let at = ipma.data + 8;
      const count = number(header, ipma.data + 4, 4);
      if (count > 4096) return invalid();
      for (let i = 0; i < count; i++) {
        const item = number(header, at, itemBytes); at += itemBytes;
        const propertyCount = number(header, at, 1); at++;
        for (let p = 0; p < propertyCount; p++) {
          const encoded = number(header, at, wide ? 2 : 1); at += wide ? 2 : 1;
          const index = encoded & (wide ? 0x7fff : 0x7f);
          if (index > properties.length) return invalid();
          if (item === primary && index > 0 && ["irot", "imir"].includes(properties[index - 1]!.type)) {
            return 1; // libheif already applied the primary item's container transform.
          }
        }
      }
      if (at > ipma.end) return invalid();
    }
  }
  if (exifId === undefined) return 1;

  const version = header[iloc.data]!;
  if (version > 2) return invalid();
  const offsetSize = header[iloc.data + 4]! >> 4;
  const lengthSize = header[iloc.data + 4]! & 15;
  const baseSize = header[iloc.data + 5]! >> 4;
  const indexSize = version > 0 ? header[iloc.data + 5]! & 15 : 0;
  const idSize = version === 2 ? 4 : 2;
  let at = iloc.data + 6;
  const count = number(header, at, version === 2 ? 4 : 2); at += version === 2 ? 4 : 2;
  if (count > 4096) return invalid();
  for (let i = 0; i < count; i++) {
    const id = number(header, at, idSize); at += idSize;
    const construction = version > 0 ? number(header, at, 2) & 15 : 0;
    if (version > 0) at += 2;
    const dataRef = number(header, at, 2); at += 2;
    const base = number(header, at, baseSize); at += baseSize;
    const extents = number(header, at, 2); at += 2;
    if (extents > 128) return invalid();
    let start = 0, length = 0;
    for (let e = 0; e < extents; e++) {
      at += indexSize;
      const offset = number(header, at, offsetSize); at += offsetSize;
      const size = number(header, at, lengthSize); at += lengthSize;
      if (id === exifId) { start = base + offset; length = size; }
    }
    if (at > iloc.end) return invalid();
    if (id !== exifId) continue;
    if (extents !== 1 || dataRef !== 0 || length < 12 || length > 65536) return invalid();
    if (construction === 1) {
      const idat = direct(children, "idat");
      if (!idat) return invalid();
      start += idat.data;
      if (start + length > idat.end) return invalid();
    } else if (construction !== 0) return invalid();
    if (!Number.isSafeInteger(start) || start < 0 || start + length > blob.size) return invalid();
    const bytes = new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
    abortIfNeeded(signal);
    return exifTiffOrientation(bytes);
  }
  return invalid();
}
