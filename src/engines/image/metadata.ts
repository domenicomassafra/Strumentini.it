/*
 * Byte-level inventory of what an image file carries besides pixels.
 *
 * "Removing metadata" is a claim, so this module is the part that makes the
 * claim checkable: it walks the real container structure — JPEG marker
 * segments, PNG chunks, WebP RIFF chunks — and reports exactly which
 * privacy-bearing segments are present and how many bytes they occupy. It
 * reads bytes only: it never decodes pixels and never needs a browser.
 *
 * Reference: CIPA DC-007 (Exif), W3C PNG (chunk types), Google WebP container
 * specification (RIFF chunk types).
 */

export type MetadataCarrier = "exif" | "xmp" | "iptc" | "comment" | "text" | "timestamp" | "icc-profile" | "ancillary";

export interface MetadataSegment {
  readonly carrier: MetadataCarrier;
  /** Container-level name, e.g. `JPEG APP1`, `PNG tEXt`, `WebP EXIF`. */
  readonly segment: string;
  readonly labelIt: string;
  /** Bytes the segment occupies on disk, header and trailer included. */
  readonly bytes: number;
}

export const METADATA_CARRIER_IT: Readonly<Record<MetadataCarrier, string>> = {
  exif: "dati Exif (posizione, modello, data di scatto)",
  xmp: "metadati XMP",
  iptc: "dati IPTC",
  comment: "commento del file",
  text: "testo incorporato",
  timestamp: "data e ora registrate",
  "icc-profile": "profilo colore ICC",
  ancillary: "dati aggiuntivi del contenitore (contenuto non verificato)",
};

/** Carriers that can carry identifying information and are therefore the target.
 * ICC profiles are primarily color data, but their copyright/description tags
 * can embed names or private text. Count them without reclassifying their color role.
 */
export const PRIVACY_BEARING_CARRIERS: readonly MetadataCarrier[] = ["exif", "xmp", "iptc", "comment", "icc-profile", "ancillary"];

export interface MetadataInventory {
  readonly format: "jpeg" | "png" | "webp" | "unknown";
  readonly segments: readonly MetadataSegment[];
  readonly bytesTotal: number;
  readonly privacySegmentCount: number;
  readonly privacyBytes: number;
  /** True when the walk completed; a truncated file is reported, not guessed. */
  readonly complete: boolean;
}

export interface MetadataGroup {
  readonly carrier: MetadataCarrier;
  readonly labelIt: string;
  readonly class: "privacy" | "descriptive" | "color";
  readonly segments: readonly string[];
  readonly count: number;
  readonly bytes: number;
}

export interface MetadataInventoryDiff {
  readonly before: readonly MetadataGroup[];
  readonly after: readonly MetadataGroup[];
  readonly removed: readonly MetadataGroup[];
  readonly retained: readonly MetadataGroup[];
}

const JPEG_SEGMENTS: Readonly<Record<number, { readonly carrier: MetadataCarrier; readonly segment: string }>> = {
  0xe1: { carrier: "exif", segment: "JPEG APP1" },
  0xed: { carrier: "iptc", segment: "JPEG APP13" },
  0xfe: { carrier: "comment", segment: "JPEG COM" },
};

// A complete JPEG has no practical need for thousands of container markers.
// Cap both the synchronous walk and segment allocations; an exhausted budget
// is an incomplete forensic inventory, never a verified metadata-free claim.
const MAX_JPEG_MARKERS = 512;

const PNG_CHUNKS: Readonly<Record<string, { readonly carrier: MetadataCarrier; readonly segment: string }>> = {
  tEXt: { carrier: "text", segment: "PNG tEXt" },
  zTXt: { carrier: "text", segment: "PNG zTXt" },
  iTXt: { carrier: "text", segment: "PNG iTXt" },
  eXIf: { carrier: "exif", segment: "PNG eXIf" },
  tIME: { carrier: "timestamp", segment: "PNG tIME" },
  iCCP: { carrier: "icc-profile", segment: "PNG iCCP" },
};

const PNG_PIXEL_CHUNKS = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);

function pngMetadataSegment(type: string, payload: Uint8Array, size: number): MetadataSegment | null {
  const known = PNG_CHUNKS[type];
  if (known !== undefined) {
    const isText = known.carrier === "text";
    // PNG XMP lives inside iTXt (or a legacy textual keyword), not in a
    // separate chunk type. The null-terminated keyword precedes the data.
    const keywordEnd = payload.indexOf(0);
    const keyword = keywordEnd >= 0 ? new TextDecoder().decode(payload.subarray(0, keywordEnd)).toLowerCase() : "";
    const carrier = isText && (keyword === "xml:com.adobe.xmp" || keyword.includes("xmp")) ? "xmp" : known.carrier;
    return segment(carrier, known.segment, size);
  }
  return PNG_PIXEL_CHUNKS.has(type) ? null : segment("ancillary", `PNG ${type}`, size);
}

const WEBP_CHUNKS: Readonly<Record<string, { readonly carrier: MetadataCarrier; readonly segment: string }>> = {
  EXIF: { carrier: "exif", segment: "WebP EXIF" },
  // WebP FourCC names occupy exactly four bytes; XMP has a literal space.
  "XMP ": { carrier: "xmp", segment: "WebP XMP" },
  ICCP: { carrier: "icc-profile", segment: "WebP ICCP" },
};
const WEBP_PIXEL_CHUNKS = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF"]);

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= 8 && signature.every((value, index) => bytes[index] === value);
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP");
}

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  return offset + text.length <= bytes.length && [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function segment(carrier: MetadataCarrier, segmentName: string, size: number): MetadataSegment {
  return { carrier, segment: segmentName, labelIt: METADATA_CARRIER_IT[carrier], bytes: size };
}

function scanJpeg(bytes: Uint8Array): MetadataInventory {
  const segments: MetadataSegment[] = [];
  let offset = 2;
  let complete = false;
  let entropyScan = false;
  let markerCount = 0;
  // JPEG metadata markers may appear between successive SOS scans. An SOS is
  // not an end-of-image marker: walk through entropy-coded data to a real EOI.
  // Entropy 0xFF00 is a stuffed byte and RST0..RST7 are not segment headers.
  while (offset < bytes.length) {
    if (entropyScan) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
      if (offset >= bytes.length) break;
    } else if (bytes[offset] !== 0xff) {
      break;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset]!;
    if (entropyScan && (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7))) {
      offset += 1;
      continue;
    }
    // Entropy byte stuffing and restart markers are not metadata segments;
    // only actual container markers consume the bounded forensic budget.
    if (++markerCount > MAX_JPEG_MARKERS) break;
    entropyScan = false;
    if (marker === 0xd9) {
      const trailingBytes = bytes.length - offset - 1;
      if (trailingBytes > 0) segments.push(segment("ancillary", "JPEG trailing payload", trailingBytes));
      complete = trailingBytes === 0;
      break;
    }
    // A nested start marker or 0xFF00 outside entropy is not a valid segment.
    if (marker === 0xd8 || marker === 0x00) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 1;
      continue;
    }
    if (offset + 3 > bytes.length) break;
    // `offset` is on the marker byte, so the two-byte length field that
    // follows the 0xFF marker prefix starts one byte later.
    const length = (bytes[offset + 1]! << 8) | bytes[offset + 2]!;
    if (length < 2 || offset + 1 + length > bytes.length) break;
    const payload = bytes.subarray(offset + 3, offset + 1 + length);
    const known = JPEG_SEGMENTS[marker];
    if (known !== undefined) {
      // APP1 is shared by Exif and XMP; the payload identifies which.
      const carrier = marker === 0xe1 && (ascii(payload, 0, "http://ns.adobe.com/xap/1.0/") || ascii(payload, 0, "http://ns.adobe.com/xmp/extension/"))
        ? "xmp"
        : known.carrier;
      segments.push(segment(carrier, carrier === "xmp" ? "JPEG APP1 XMP" : known.segment, length + 2));
    } else if (marker >= 0xe0 && marker <= 0xef) {
      // APP0..APP15 are application-owned payloads, not JPEG pixel coding.
      // A JFIF header with variable 16-bit density fields can hide arbitrary
      // private data. Ignore only the *exact* neutral 1:1 no-thumbnail JFIF
      // 1.01 constant used by the standard fixture: none of its bytes can
      // carry input-specific information. All other JFIF/APP0 is unverified.
      const neutralJfif = marker === 0xe0 && payload.length === 14
        && ascii(payload, 0, "JFIF\0") && payload[5] === 1 && payload[6] === 1
        && payload[7] === 0 && payload[8] === 0 && payload[9] === 1
        && payload[10] === 0 && payload[11] === 1
        && payload[12] === 0 && payload[13] === 0;
      if (!neutralJfif) {
        const icc = marker === 0xe2 && ascii(payload, 0, "ICC_PROFILE\0");
        segments.push(segment(icc ? "icc-profile" : "ancillary", icc ? "JPEG APP2 ICC" : `JPEG APP${marker - 0xe0}`, length + 2));
      }
    }
    // `offset` sits on the marker byte itself (the leading 0xFF was consumed
    // above), so the next marker starts one byte plus the declared length later.
    offset += 1 + length;
    if (marker === 0xda) entropyScan = true;
  }
  return summarize("jpeg", segments, complete);
}

function scanPng(bytes: Uint8Array): MetadataInventory {
  const segments: MetadataSegment[] = [];
  let offset = 8;
  let complete = true;
  let sawEnd = false;
  while (offset + 8 <= bytes.length) {
    const length =
      (bytes[offset]! * 0x1000000 + (bytes[offset + 1]! << 16) + (bytes[offset + 2]! << 8) + bytes[offset + 3]!) >>> 0;
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    if (offset + 12 + length > bytes.length) {
      complete = false;
      break;
    }
    if (type === "IEND") {
      sawEnd = true;
      if (length !== 0 || offset + 12 !== bytes.length) complete = false;
      break;
    }
    const item = pngMetadataSegment(type, bytes.subarray(offset + 8, offset + 8 + Math.min(length, 256)), length + 12);
    if (item !== null) segments.push(item);
    offset += 12 + length;
  }
  if (!sawEnd) complete = false;
  return summarize("png", segments, complete);
}

function scanWebp(bytes: Uint8Array): MetadataInventory {
  const segments: MetadataSegment[] = [];
  const riffSize = (bytes[4]! + (bytes[5]! << 8) + (bytes[6]! << 16) + (bytes[7]! << 24)) >>> 0;
  const declaredEnd = 8 + riffSize;
  const limit = Math.min(bytes.length, declaredEnd);
  let offset = 12;
  let complete = riffSize >= 4 && declaredEnd === bytes.length;
  if (declaredEnd < bytes.length) {
    // Bytes outside the declared RIFF boundary can hide XMP, Exif or private
    // data while a decoder still opens the image. Never certify them as clean.
    segments.push(segment("ancillary", "WebP trailing payload", bytes.length - declaredEnd));
  }
  while (offset < limit) {
    if (offset + 8 > limit) {
      complete = false;
      break;
    }
    const type = String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
    const size = (bytes[offset + 4]! + (bytes[offset + 5]! << 8) + (bytes[offset + 6]! << 16) + (bytes[offset + 7]! << 24)) >>> 0;
    if (offset + 8 + size + (size % 2) > limit) {
      complete = false;
      break;
    }
    const known = WEBP_CHUNKS[type];
    if (known !== undefined) segments.push(segment(known.carrier, known.segment, size + 8 + (size % 2)));
    else if (!WEBP_PIXEL_CHUNKS.has(type)) {
      // Nonstandard RIFF chunks are ignored by some decoders, yet can contain
      // identifying metadata. Count them instead of asserting a clean export.
      segments.push(segment("ancillary", `WebP ${type}`, size + 8 + (size % 2)));
    }
    offset += 8 + size + (size % 2);
  }
  if (offset !== limit) complete = false;
  return summarize("webp", segments, complete);
}

function summarize(format: "jpeg" | "png" | "webp", segments: readonly MetadataSegment[], complete: boolean): MetadataInventory {
  const bytesTotal = segments.reduce((sum, entry) => sum + entry.bytes, 0);
  const privacy = segments.filter((entry) => PRIVACY_BEARING_CARRIERS.includes(entry.carrier));
  return {
    format,
    segments,
    bytesTotal,
    privacySegmentCount: privacy.length,
    privacyBytes: privacy.reduce((sum, entry) => sum + entry.bytes, 0),
    complete,
  };
}

export function scanImageMetadata(bytes: Uint8Array): MetadataInventory {
  if (isPng(bytes)) return scanPng(bytes);
  if (isJpeg(bytes)) return scanJpeg(bytes);
  if (isWebp(bytes)) return scanWebp(bytes);
  return { format: "unknown", segments: [], bytesTotal: 0, privacySegmentCount: 0, privacyBytes: 0, complete: false };
}

/**
 * Full-file PNG inventory with constant-size reads, including chunks beyond a
 * large IDAT and any trailing payload after IEND. Other formats retain the
 * explicitly bounded 8 MiB prefix inventory until a streaming parser exists.
 */
export async function scanImageMetadataBlob(blob: Blob, signal?: AbortSignal): Promise<MetadataInventory> {
  const abort = () => {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  };
  const read = async (offset: number, length: number): Promise<Uint8Array> => {
    abort();
    const bytes = new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());
    abort();
    return bytes;
  };
  const signature = await read(0, 12);
  if (!isPng(signature)) {
    const limit = 8 * 1024 * 1024;
    const inventory = scanImageMetadata(await read(0, Math.min(blob.size, limit)));
    return blob.size > limit ? { ...inventory, complete: false } : inventory;
  }

  const segments: MetadataSegment[] = [];
  let offset = 8;
  let complete = false;
  // A valid 40 MiB input cannot require unbounded memory or an unbounded
  // number of per-chunk reads to inspect its container structure.
  for (let count = 0; count < 65_536 && offset + 12 <= blob.size; count += 1) {
    const header = await read(offset, 8);
    const length = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(0);
    const type = String.fromCharCode(...header.subarray(4, 8));
    if (offset + 12 + length > blob.size) break;
    if (type === "IEND") {
      complete = length === 0 && offset + 12 === blob.size;
      break;
    }
    if (!PNG_PIXEL_CHUNKS.has(type)) {
      const prefix = await read(offset + 8, Math.min(length, 256));
      const item = pngMetadataSegment(type, prefix, length + 12);
      if (item !== null) segments.push(item);
    }
    offset += length + 12;
  }
  return summarize("png", segments, complete);
}

function metadataClass(carrier: MetadataCarrier): MetadataGroup["class"] {
  if (carrier === "icc-profile") return "color";
  if (PRIVACY_BEARING_CARRIERS.includes(carrier)) return "privacy";
  return "descriptive";
}

export function groupImageMetadata(inventory: MetadataInventory): readonly MetadataGroup[] {
  const carriers = [...new Set(inventory.segments.map((entry) => entry.carrier))].toSorted();
  return carriers.map((carrier) => {
    const segments = inventory.segments.filter((entry) => entry.carrier === carrier);
    return {
      carrier,
      labelIt: METADATA_CARRIER_IT[carrier],
      class: metadataClass(carrier),
      segments: segments.map((entry) => entry.segment),
      count: segments.length,
      bytes: segments.reduce((sum, entry) => sum + entry.bytes, 0),
    };
  });
}

export function diffImageMetadata(beforeInventory: MetadataInventory, afterInventory: MetadataInventory): MetadataInventoryDiff {
  const before = groupImageMetadata(beforeInventory);
  const after = groupImageMetadata(afterInventory);
  const afterCarriers = new Set(after.map((group) => group.carrier));
  return {
    before,
    after,
    removed: before.filter((group) => !afterCarriers.has(group.carrier)),
    retained: after,
  };
}

export function describeMetadataIt(inventory: MetadataInventory): string {
  if (inventory.format === "unknown") return "Formato non riconosciuto: nessun inventario possibile.";
  if (inventory.segments.length === 0) {
    return inventory.complete
      ? "Nessun segmento di metadati trovato nel file."
      : "Il file sembra troncato: l'inventario è parziale e non può essere considerato completo.";
  }
  const carriers = [...new Set(inventory.segments.map((entry) => entry.carrier))];
  const message = `Trovati ${inventory.segments.length} segmenti di metadati (${carriers.join(", ")}), per ${inventory.bytesTotal} byte.`;
  return inventory.complete ? message : `${message} Inventario parziale: non è possibile certificare i segmenti successivi.`;
}
