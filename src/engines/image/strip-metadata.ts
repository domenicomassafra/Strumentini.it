/*
 * Image metadata removal with a verifiable result.
 *
 * The job is "give me the same picture without the identifying data". The
 * output is produced by re-encoding decoded pixels in a new container, then
 * **the produced bytes are parsed again**. Checking chunk names alone cannot
 * certify IDAT: a decodable PNG may hide arbitrary bytes after the compressed
 * zlib stream. The tool reports success only when both container inventory
 * and complete decoded raster stream are verified.
 */

import {
  ImageVisualError,
  IMAGE_VISUAL_LIMITS,
  assertFile,
  formatBytes,
  normalizeName,
  type ImageVisualFile,
  type ImageVisualProgress,
} from "./visual";
import {
  bitmapCanvas,
  decodeImage,
  extensionForMime,
  get2d,
  imageDataFromBitmap,
  validateObject,
  type OutputMime,
} from "./operations";
import {
  describeMetadataIt,
  diffImageMetadata,
  scanImageMetadataBlob,
  type MetadataGroup,
  type MetadataInventory,
  type MetadataSegment,
} from "./metadata";
import { Zlib } from "fflate";

export interface StripMetadataResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly inputMime: string;
  readonly outputMime: OutputMime;
  readonly width: number;
  readonly height: number;
  readonly dimensionsPreserved: true;
  readonly inputInventory: MetadataInventory;
  readonly outputInventory: MetadataInventory;
  readonly removed: readonly MetadataSegment[];
  readonly privacySegmentCount: number;
  readonly privacyBytes: number;
  readonly inputSizeLabel: string;
  readonly outputSizeLabel: string;
  /** Proven for the produced bytes, not assumed from the encoder. */
  readonly metadataFree: true;
  readonly policyIt: string;
  readonly metadataGroups: {
    readonly before: readonly MetadataGroup[];
    readonly after: readonly MetadataGroup[];
    readonly removed: readonly MetadataGroup[];
    readonly retained: readonly MetadataGroup[];
  };
  readonly fidelity: {
    readonly outputFormat: "image/png";
    readonly dimensionsPreserved: true;
    readonly decodedRgbaExact: true;
    readonly verification: "browser-decoded RGBA before vs reopened PNG RGBA";
    readonly limitation: string;
  };
  readonly engineVersion: string;
}

export const METADATA_STRIPPER_VERSION = "image-metadata-strip-v6";

// The metadata inventory validates the PNG *chunk names and boundaries*.
// That alone does not establish that IDAT contains only image data: decoders
// may silently ignore arbitrary private bytes after the zlib end marker,
// while still returning pixel-perfect RGBA. This is a distinct forensic
// boundary: verify the entire compressed pixel stream, including its checksum.
//
// Never inflate unbounded attacker-supplied data. The encoded payload must
// already fit the engine's 40 MiB file cap; decompressed scanline length is
// independently derived from the bounded output dimensions. Use streaming
// reads so the validator does not duplicate a 40 MiB PNG or 64 MiB RGBA.
const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, entry) => {
  let crc = entry;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

/** Canonical output is a deterministic function of the *decoded* RGBA.
 * A PNG can otherwise encode invisible private data in DEFLATE block
 * padding, harmless empty blocks or unused PNG palette entries, even with a
 * perfect CRC/Adler and exactly matching rendered pixels. Such encoder bytes
 * can be checked for valid syntax but cannot be certified free of hidden
 * identity. We never deliver them: use our own fixed PNG structure, filter
 * 0, and pinned local Zlib stream over independently checked source pixels.
 * This is pixel canonicalization, not evidence of stripping steganography
 * from visible RGBA values themselves.
 */
function canonicalRgbaPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  signal?: AbortSignal,
): Blob {
  const reject = (message: string): never => {
    throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", message);
  };
  if (width < 1 || height < 1 || width > IMAGE_VISUAL_LIMITS.maxDimension ||
      height > IMAGE_VISUAL_LIMITS.maxDimension ||
      width * height > IMAGE_VISUAL_LIMITS.maxPixels || rgba.length !== width * height * 4) {
    reject("Decoded RGBA geometry is outside the canonical PNG profile");
  }
  const pngChunk = (name: string, bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
    const output = new Uint8Array(bytes.length + 12);
    const view = new DataView(output.buffer);
    view.setUint32(0, bytes.length, false);
    for (let index = 0; index < 4; index++) output[4 + index] = name.charCodeAt(index);
    output.set(bytes, 8);
    let crc = 0xffffffff;
    for (let index = 4; index < bytes.length + 8; index++) {
      crc = PNG_CRC_TABLE[(crc ^ output[index]!) & 255]! ^ (crc >>> 8);
    }
    view.setUint32(bytes.length + 8, (crc ^ 0xffffffff) >>> 0, false);
    return output;
  };
  const header = new Uint8Array(13);
  const dims = new DataView(header.buffer);
  dims.setUint32(0, width, false);
  dims.setUint32(4, height, false);
  header[8] = 8; // exact 8-bit channel precision
  header[9] = 6; // RGBA, no palette or unused pixel-bit padding

  const parts: Uint8Array<ArrayBuffer>[] = [];
  let total = 8 + 25 + 12; // signature, IHDR, IEND
  let finalOutput = false;
  const compressor = new Zlib({ level: 6 }, (packed, final) => {
    if (packed.length > 0) {
      total += 12 + packed.length;
      if (total > IMAGE_VISUAL_LIMITS.maxFileBytes) reject("Canonical PNG exceeds the bounded output budget");
      parts.push(pngChunk("IDAT", packed));
    }
    if (final) finalOutput = true;
  });
  for (let y = 0; y < height; y++) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    const row = new Uint8Array(1 + width * 4);
    row.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), 1);
    compressor.push(row, y === height - 1);
  }
  if (!finalOutput || parts.length === 0) reject("Canonical PNG compressor did not finish");
  return new Blob(
    [new Uint8Array(PNG_MAGIC), pngChunk("IHDR", header), ...parts, pngChunk("IEND", new Uint8Array())],
    { type: "image/png" },
  );
}

async function verifyPngIdatStream(
  blob: Blob,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<void> {
  const reject = (message: string): never => {
    throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", message);
  };
  const abort = () => {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  };
  abort();
  if (blob.size < 57 || blob.size > IMAGE_VISUAL_LIMITS.maxFileBytes) {
    reject("PNG output byte length exceeds verified raster limits");
  }
  const read = async (start: number, end: number): Promise<Uint8Array> => {
    abort();
    const value = new Uint8Array(await blob.slice(start, end).arrayBuffer());
    abort();
    return value;
  };
  const magic = await read(0, 8);
  if (!PNG_MAGIC.every((byte, index) => magic[index] === byte)) reject("PNG signature is missing");

  const idatParts: Blob[] = [];
  let idatTail = new Uint8Array();
  let idatBytes = 0;
  let seenHeader = false;
  let seenData = false;
  let finishedData = false;
  let seenEnd = false;
  let expectedInflatedBytes = 0;
  let offset = 8;
  for (let chunks = 0; chunks < 65_536 && offset + 12 <= blob.size; chunks += 1) {
    abort();
    const header = await read(offset, offset + 8);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const length = view.getUint32(0, false);
    const type = String.fromCharCode(...header.subarray(4, 8));
    const next = offset + 12 + length;
    if (next > blob.size) reject("PNG chunk extends beyond the output file");
    if (chunks === 0 && (type !== "IHDR" || length !== 13)) reject("PNG must start with a 13-byte IHDR");
    if (chunks > 0 && type === "IHDR") reject("PNG contains multiple IHDR headers");
    // PLTE is not proof of visible pixels: even a fully decodable truecolor
    // RGBA PNG may carry a suggested palette whose entries are never used,
    // including hidden identifiers. A metadata-stripped artifact must not
    // preserve unverifiable palette-only bytes and call them metadata-free.
    // Browser encoders normally emit truecolor PNG for the RGBA canvas; an
    // indexed encoder is conservatively refused rather than falsely attested.
    if (!["IHDR", "IDAT", "IEND"].includes(type)) reject("PNG contains a non-raster or unverified palette chunk");

    let crc = 0xffffffff;
    for (let position = offset + 4; position < next - 4;) {
      const bytes = await read(position, Math.min(next - 4, position + 64 * 1024));
      for (const byte of bytes) crc = PNG_CRC_TABLE[(crc ^ byte) & 255]! ^ (crc >>> 8);
      position += bytes.length;
    }
    const checksum = new DataView((await read(next - 4, next)).buffer).getUint32(0, false);
    if (((crc ^ 0xffffffff) >>> 0) !== checksum) reject(`PNG ${type} chunk CRC mismatch`);

    if (type === "IHDR") {
      const ihdr = await read(offset + 8, offset + 21);
      const dimensions = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
      const encodedWidth = dimensions.getUint32(0, false);
      const encodedHeight = dimensions.getUint32(4, false);
      const depth = ihdr[8]!;
      const color = ihdr[9]!;
      // An otherwise valid 1/2/4-bit grayscale PNG has unused scanline
      // padding bits; with a width of 1 only one bit is visible and seven
      // bits per row can carry a recoverable private identifier despite a
      // correct Adler32, CRC, and pixel-perfect browser decode. Require
      // exact 8-bit RGBA canvas output for this forensic *export* boundary;
      // input PNG formats are still decoded and re-encoded normally.
      if (encodedWidth !== width || encodedHeight !== height
        || encodedWidth * encodedHeight > IMAGE_VISUAL_LIMITS.maxPixels
        || depth !== 8 || color !== 6
        || ihdr[10] !== 0 || ihdr[11] !== 0 || ihdr[12] !== 0) {
        reject("PNG IHDR raster format, dimensions or interlace cannot be certified");
      }
      expectedInflatedBytes = height * (1 + width * 4);
      if (expectedInflatedBytes > IMAGE_VISUAL_LIMITS.maxPixels * 8 + IMAGE_VISUAL_LIMITS.maxDimension) {
        reject("PNG inflated scanlines exceed the verified pixel budget");
      }
      seenHeader = true;
    } else if (type === "IDAT") {
      if (!seenHeader || finishedData) reject("PNG IDAT stream must be contiguous");
      seenData = true;
      idatBytes += length;
      if (idatBytes > IMAGE_VISUAL_LIMITS.maxFileBytes) reject("PNG IDAT exceeds compressed resource limits");
      idatParts.push(blob.slice(offset + 8, offset + 8 + length));
      // The four-byte Adler32 can itself cross IDAT boundaries. Collect the
      // final four concatenated data bytes, not just the final chunk suffix.
      const last = await read(offset + 8 + Math.max(0, length - 4), offset + 8 + length);
      idatTail = Uint8Array.from([...idatTail, ...last].slice(-4));
    } else {
      if (!seenData || length !== 0 || next !== blob.size) reject("PNG IEND must terminate the exact raster file");
      seenEnd = true;
      break;
    }
    if (seenData && type !== "IDAT") finishedData = true;
    offset = next;
  }
  if (!seenHeader || !seenData || !seenEnd || idatBytes < 6 || typeof DecompressionStream !== "function") {
    reject("Complete PNG zlib stream verification is unavailable");
  }

  // DecompressionStream('deflate') validates the terminal zlib framing;
  // Chromium rejects extraneous data following Adler32 even when image
  // decoders display it. The independently calculated Adler32 also requires
  // the *last* four IDAT bytes to match the actual inflated scanlines.
  let decodedBytes = 0;
  let adlerA = 1;
  let adlerB = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const inflated = new Blob(idatParts).stream().pipeThrough(new DecompressionStream("deflate"));
    reader = inflated.getReader();
    const streamReader = reader;
    onAbort = () => { void streamReader.cancel().catch(() => undefined); };
    signal?.addEventListener("abort", onAbort, { once: true });
    while (true) {
      abort();
      const item = await streamReader.read();
      abort();
      if (item.done) break;
      decodedBytes += item.value.byteLength;
      if (decodedBytes > expectedInflatedBytes) reject("PNG inflate exceeded its expected decoded scanlines");
      for (let index = 0; index < item.value.length; index += 1) {
        adlerA += item.value[index]!;
        adlerB += adlerA;
        if ((index & 0xfff) === 0xfff) {
          adlerA %= 65521;
          adlerB %= 65521;
        }
      }
      adlerA %= 65521;
      adlerB %= 65521;
    }
  } catch (error) {
    abort();
    if (error instanceof ImageVisualError) throw error;
    reject("PNG IDAT contains corrupt or unconsumed compressed payload");
  } finally {
    if (onAbort) signal?.removeEventListener("abort", onAbort);
    if (reader) {
      try { await reader.cancel(); } catch { /* already completed/failed */ }
    }
  }
  abort();
  if (decodedBytes !== expectedInflatedBytes) reject("PNG decoded scanline byte count is incomplete");
  const expectedAdler = new DataView(idatTail.buffer, idatTail.byteOffset, idatTail.byteLength).getUint32(0, false);
  const actualAdler = (((adlerB & 0xffff) << 16) | (adlerA & 0xffff)) >>> 0;
  if (expectedAdler !== actualAdler) reject("PNG IDAT has unexpected content after the zlib checksum");
}

export async function stripImageMetadataLocal(
  input: unknown,
  signal?: AbortSignal,
  progress?: (value: ImageVisualProgress) => void,
): Promise<StripMetadataResult> {
  const value = validateObject(input);
  // `assertFile` is the one place a caller-supplied File becomes the engine's
  // own record, and it is also where the size limits are enforced.
  const file = assertFile(value.file, "image");
  const mime = "image/png" as const;

  const inputInventory = await scanImageMetadataBlob(file.blob, signal);

  progress?.({ phase: "decode", label: "Decodifica locale" });
  const decoded = await decodeImage(file, signal, progress);
  try {
    const canvas = bitmapCanvas(decoded.bitmap);
    const sourcePixels = get2d(canvas).getImageData(0, 0, decoded.width, decoded.height).data;
    // Native WebKit toBlob can add eXIf/sRGB chunks to an otherwise clean
    // canvas PNG, while DEFLATE also permits recoverable invisible padding
    // bits. Since the only deliverable is our own canonical PNG, invoking
    // and inspecting an undistributed native encoder is unnecessary and
    // falsely refuses Safari. Never serialize via canvas.toBlob here:
    // re-encode solely from owned decoded RGBA, then fully re-open/attest it.
    const canonicalBlob = canonicalRgbaPng(sourcePixels, decoded.width, decoded.height, signal);
    const canonicalInventory = await scanImageMetadataBlob(canonicalBlob, signal);
    if (canonicalInventory.format !== "png" || !canonicalInventory.complete || canonicalInventory.segments.length > 0) {
      throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Canonical output still contains unverified metadata");
    }
    await verifyPngIdatStream(canonicalBlob, decoded.width, decoded.height, signal);
    const canonicalDecoded = await decodeImage({
      name: "metadata-stripped-canonical.png",
      size: canonicalBlob.size,
      type: mime,
      blob: canonicalBlob,
    }, signal, progress);
    try {
      const canonicalRgba = await imageDataFromBitmap(canonicalDecoded.bitmap, signal);
      if (canonicalRgba.width !== decoded.width || canonicalRgba.height !== decoded.height ||
          canonicalRgba.data.length !== sourcePixels.length) {
        throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", "Canonical PNG dimensions or decoded length changed");
      }
      for (let at = 0; at < sourcePixels.length; at++) {
        if ((at & 0xffff) === 0 && signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
        if (canonicalRgba.data[at] !== sourcePixels[at]) {
          throw new ImageVisualError("OUTPUT_VALIDATION_FAILED", `Canonical PNG RGBA mismatch at byte ${at}`);
        }
      }
    } finally {
      canonicalDecoded.bitmap.close();
    }
    const removed = inputInventory.segments;
    const metadataGroups = diffImageMetadata(inputInventory, canonicalInventory);
    return {
      blob: canonicalBlob,
      filename: `${normalizeName(file.name)}-senza-metadati.${extensionForMime(mime)}`,
      inputMime: inputInventory.format === "unknown" ? "image/*" : `image/${inputInventory.format}`,
      outputMime: mime,
      width: decoded.width,
      height: decoded.height,
      dimensionsPreserved: true,
      inputInventory,
      outputInventory: canonicalInventory,
      removed,
      privacySegmentCount: inputInventory.privacySegmentCount,
      privacyBytes: inputInventory.privacyBytes,
      inputSizeLabel: formatBytes(file.size),
      outputSizeLabel: formatBytes(canonicalBlob.size),
      metadataFree: true,
      policyIt: `L'immagine viene ricodificata localmente esclusivamente dall'RGBA decodificato usando PNG canonico RGBA8, righe senza filtro e compressore locale deterministico; il contenitore PNG del browser non viene creato né copiato, così i suoi eventuali chunk Exif, palette e bit di padding non entrano nel risultato. Il file finale è ricontrollato su CRC, Adler32, flusso IDAT e pixel. ${inputInventory.complete ? "Inventario sorgente completo." : "Inventario sorgente parziale: solo i segmenti rilevati sono documentati."} Eventuali thumbnail Exif non sono inventariati separatamente; l'intero contenitore Exif originale non viene copiato nella nuova immagine.`,
      metadataGroups,
      fidelity: {
        outputFormat: "image/png",
        dimensionsPreserved: true,
        decodedRgbaExact: true,
        verification: "browser-decoded RGBA before vs reopened PNG RGBA",
        limitation: "Exact only for browser-decoded RGBA. Original container, Exif embedded thumbnails, ICC/profile semantics and codec history are not preserved. Pixel steganography or identifying picture content cannot be scrubbed by metadata removal.",
      },
      engineVersion: METADATA_STRIPPER_VERSION,
    };
  } finally {
    decoded.bitmap.close();
  }
}

/** Reports what an image carries, without producing anything. */
export async function inspectImageMetadataSegments(file: ImageVisualFile, signal?: AbortSignal): Promise<MetadataInventory> {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  return scanImageMetadataBlob(file.blob, signal);
}

export function summarizeMetadataRemoval(inventory: MetadataInventory): string {
  return describeMetadataIt(inventory);
}
