import { inspectPdfBytes } from "../engines/pdf";
import type { OutputArtifactDescriptor } from "./output-artifact";

/** #338: preview is opt-in local byte inspection, not output verification. */
export const OUTPUT_FACTS_338_LIMITS = {
  maxOutputBytes: 4 * 1024 * 1024,
  maxPdfPages: 200,
  maxPngPixels: 1_000_000,
  maxPngChunks: 128,
} as const;

export type OutputFacts338Reason = "UNVERIFIED" | "UNSUPPORTED" | "TOO_LARGE" | "MALFORMED";
export type OutputFacts338 =
  | {
      readonly state: "available";
      readonly source: "actual-output-bytes";
      readonly filename: string;
      readonly byteLength: number;
      readonly format: "pdf";
      readonly pdf: {
        readonly pageCount: number;
        readonly version: string;
        readonly firstPage: { readonly width: number; readonly height: number; readonly rotation: number };
      };
      readonly limitations: string;
    }
  | {
      readonly state: "available";
      readonly source: "actual-output-bytes";
      readonly filename: string;
      readonly byteLength: number;
      readonly format: "png";
      readonly png: { readonly width: number; readonly height: number; readonly colorType: number };
      readonly limitations: string;
    }
  | {
      readonly state: "unavailable";
      readonly reason: OutputFacts338Reason;
      readonly message: string;
    };

function invalid(reason: OutputFacts338Reason, message: string): OutputFacts338 {
  return { state: "unavailable", reason, message };
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let text = "";
  for (let offset = start; offset < start + length; offset += 1) text += String.fromCharCode(bytes[offset] ?? 0);
  return text;
}

function u32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffff_ffff;
  for (let i = start; i < end; i += 1) {
    crc ^= bytes[i] ?? 0;
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb8_8320 : 0);
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function inspectPng(bytes: Uint8Array): { width: number; height: number; colorType: number } | null {
  if (bytes.length < 57 || ![137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) return null;
  let offset = 8;
  let chunks = 0;
  let sawIdat = false;
  let sawIend = false;
  let width = 0, height = 0, colorType = -1;
  while (offset + 12 <= bytes.length && chunks++ < OUTPUT_FACTS_338_LIMITS.maxPngChunks) {
    const length = u32(bytes, offset);
    const next = offset + 12 + length;
    if (!Number.isSafeInteger(next) || next > bytes.length) return null;
    const type = ascii(bytes, offset + 4, 4);
    if (!/^[A-Za-z]{4}$/u.test(type)) return null;
    if (crc32(bytes, offset + 4, offset + 8 + length) !== u32(bytes, offset + 8 + length)) return null;
    if (chunks === 1) {
      if (type !== "IHDR" || length !== 13) return null;
      width = u32(bytes, offset + 8);
      height = u32(bytes, offset + 12);
      const depth = bytes[offset + 16] ?? -1;
      colorType = bytes[offset + 17] ?? -1;
      const validDepths: Readonly<Record<number, readonly number[]>> = {
        0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16],
      };
      if (!validDepths[colorType]?.includes(depth) || width < 1 || height < 1
        || width * height > OUTPUT_FACTS_338_LIMITS.maxPngPixels
        || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || ![0,1].includes(bytes[offset + 20] ?? -1)) return null;
    } else {
      if (type === "IHDR" || type === "acTL" || type === "fcTL" || type === "fdAT") return null;
      // Unknown *critical* chunks require a decoder we intentionally do not invoke.
      if (type[0] === type[0]?.toUpperCase() && !["PLTE", "IDAT", "IEND"].includes(type)) return null;
      if (type === "IDAT") {
        if (length === 0) return null;
        sawIdat = true;
      }
      if (type === "IEND") {
        if (length !== 0 || !sawIdat || next !== bytes.length) return null;
        sawIend = true;
        break;
      }
    }
    offset = next;
  }
  return sawIend ? { width, height, colorType } : null;
}

/**
 * The producer's earlier verification remains immutable. This routine never
 * edits the artifact, starts downloads, persists bytes or calls the network.
 * It only shows facts after a *new*, bounded structural inspection succeeds.
 * No inferred savings, DPI, visual fidelity, OCR or pixel/content equivalence.
 */
export function readOutputFacts338(artifact: OutputArtifactDescriptor): OutputFacts338 {
  try {
    if (!artifact.download.ready || artifact.verification.state !== "verified" || artifact.issues.length !== 0) {
      return invalid("UNVERIFIED", "L'output non è verificato: nessuna anteprima dei fatti disponibile.");
    }
    const bytes = artifact.bytes;
    if (!(bytes instanceof Uint8Array) || !Number.isSafeInteger(artifact.byteLength)
      || bytes.byteLength !== artifact.byteLength || bytes.length === 0) {
      return invalid("MALFORMED", "Lunghezza effettiva dei byte incoerente.");
    }
    if (bytes.byteLength > OUTPUT_FACTS_338_LIMITS.maxOutputBytes) {
      return invalid("TOO_LARGE", "Anteprima non disponibile oltre 4 MiB; il download verificato resta disponibile.");
    }
    if (artifact.mime === "application/pdf" && artifact.verification.verifiedMime === "application/pdf"
      && artifact.kind === "pdf" && /\.pdf$/iu.test(artifact.name)) {
      if (bytes.length < 32 || ascii(bytes, 0, 5) !== "%PDF-"
        || !/%%EOF\s*$/u.test(ascii(bytes, Math.max(0, bytes.length - 32), Math.min(32, bytes.length)))) {
        return invalid("MALFORMED", "PDF senza firma o chiusura finale coerente.");
      }
      const parsed = inspectPdfBytes(bytes);
      const first = parsed.pages[0];
      if (!Number.isInteger(parsed.pageCount) || parsed.pageCount < 1
        || parsed.pageCount > OUTPUT_FACTS_338_LIMITS.maxPdfPages
        || parsed.pages.length !== parsed.pageCount || first === undefined
        || !Number.isFinite(first.width) || !Number.isFinite(first.height)
        || first.width <= 0 || first.height <= 0
        || !Number.isInteger(first.rotation) || ![0,90,180,270].includes(first.rotation)) {
        return invalid("MALFORMED", "Il parser locale non ha ricostruito pagine e geometria coerenti.");
      }
      return {
        state: "available", source: "actual-output-bytes", filename: artifact.name,
        byteLength: bytes.byteLength, format: "pdf",
        pdf: { pageCount: parsed.pageCount, version: parsed.version,
          firstPage: { width: first.width, height: first.height, rotation: first.rotation } },
        limitations: "Fatti strutturali riletti dal PDF prodotto; non è una miniatura né una verifica di equivalenza visiva.",
      };
    }
    if (artifact.mime === "image/png" && artifact.verification.verifiedMime === "image/png"
      && ["file", "image"].includes(artifact.kind) && /\.png$/iu.test(artifact.name)) {
      const facts = inspectPng(bytes);
      if (facts === null) return invalid("MALFORMED", "PNG troncato o contenitore/chunk incoerenti.");
      return { state: "available", source: "actual-output-bytes", filename: artifact.name,
        byteLength: bytes.byteLength, format: "png", png: facts,
        limitations: "Dimensioni dichiarate nell'IHDR con CRC dei chunk coerenti; pixel non decodificati né confrontati visivamente.",
      };
    }
    return invalid("UNSUPPORTED", "Anteprima strutturale limitata a PDF e PNG con MIME e nome coerenti.");
  } catch {
    // Parser failure is NEVER allowed to change an existing verified download.
    return invalid("MALFORMED", "Rilettura dell'output non riuscita; l'eventuale download precedente resta indipendente.");
  }
}
