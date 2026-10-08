import { analyzeOoxmlPackage, OOXML_PACKAGE_LIMITS, type OoxmlEntryClass } from "../ooxml/package";
import { inspectMp4Local } from "../video/mp4-inspection";

/** Pure diagnostic adapters for STR-266. Read-only, no encoder, no estimates. */
export function inspectOfficePackageSize(bytes: Uint8Array) {
  const report = analyzeOoxmlPackage(bytes);
  const groups = Object.fromEntries(([
    "xml", "media", "font", "other",
  ] as const satisfies readonly OoxmlEntryClass[]).map((kind) => {
    const entries = report.entries.filter((entry) => entry.classification === kind);
    return [kind, {
      entryCount: entries.length,
      compressedMemberBytes: entries.reduce((sum, entry) => sum + entry.compressedSize, 0),
      uncompressedBytes: entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0),
    }];
  })) as Record<OoxmlEntryClass, { entryCount: number; compressedMemberBytes: number; uncompressedBytes: number }>;
  return {
    format: report.kind,
    entryCount: report.entryCount,
    documentCount: report.documentCount,
    slideCount: report.slideCount,
    sheetCount: report.sheetCount,
    relationshipPartCount: report.relationshipPartCount,
    groups,
    compressedMemberBytes: report.totalCompressedMemberBytes,
    uncompressedBytes: report.totalUncompressedBytes,
    zipOverheadBytes: bytes.byteLength - report.totalCompressedMemberBytes,
    largestMedia: report.entries.filter((part) => part.classification === "media")
      .sort((a, b) => b.compressedSize - a.compressedSize || a.path.localeCompare(b.path))
      .slice(0, 8).map((entry) => ({ path: entry.path, compressedBytes: entry.compressedSize, uncompressedBytes: entry.uncompressedSize })),
    safety: { macros: "refused", encrypted: "refused", links: "never resolved" },
  };
}

/** Declared PCM RIFF WAVE data only; never infer output audio codec quality. */
export async function inspectPcmWaveSize(file: Blob, signal?: AbortSignal) {
  const unsupported = (reason: string) => ({ format: "wave", codec: null, durationSeconds: null, sampleRateHz: null,
    channels: null, bitsPerSample: null, declaredBitrateBps: null, dataBytes: null, reason });
  if (file.size < 44 || file.size > 50 * 1024 * 1024) return unsupported("RIFF WAVE fuori limite supportato");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (String.fromCharCode(...header.slice(0, 4)) !== "RIFF" || String.fromCharCode(...header.slice(8, 12)) !== "WAVE") {
    return unsupported("Intestazione RIFF/WAVE non riconosciuta");
  }
  const dv = new DataView(header.buffer);
  // Strict one-RIFF-one-file policy. Trailing chunks or multiple concatenated
  // RIFFs require a dedicated parser to claim complete duration.
  if (dv.getUint32(4, true) + 8 !== file.size) return unsupported("Dimensione RIFF non coincide con il file");
  let offset = 12;
  let fmt: { sampleRate: number; channels: number; bits: number; blockAlign: number; byteRate: number } | null = null;
  let dataBytes: number | null = null;
  for (let chunkIndex = 0; chunkIndex < 128 && offset + 8 <= file.size; chunkIndex += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const chunk = new Uint8Array(await file.slice(offset, offset + 8).arrayBuffer());
    const kind = String.fromCharCode(...chunk.slice(0, 4));
    const size = new DataView(chunk.buffer).getUint32(4, true);
    const next = offset + 8 + size + (size % 2);
    if (next > file.size || !Number.isSafeInteger(next)) return unsupported("Chunk WAVE fuori limiti");
    if (kind === "fmt ") {
      if (fmt !== null || size < 16 || size > 64) return unsupported("Formato WAVE ambiguo o esteso");
      const values = new DataView(await file.slice(offset + 8, offset + 24).arrayBuffer());
      if (values.getUint16(0, true) !== 1) return unsupported("Solo PCM lineare WAVE è misurabile");
      fmt = { channels: values.getUint16(2, true), sampleRate: values.getUint32(4, true),
        byteRate: values.getUint32(8, true), blockAlign: values.getUint16(12, true), bits: values.getUint16(14, true) };
    }
    if (kind === "data") {
      if (dataBytes !== null) return unsupported("Più chunk dati WAVE: durata non verificabile");
      dataBytes = size;
    }
    offset = next;
  }
  if (offset !== file.size || fmt === null || dataBytes === null || dataBytes < 1 || fmt.channels < 1 || fmt.channels > 8
    || fmt.sampleRate < 8000 || fmt.sampleRate > 192000 || ![8, 16, 24, 32].includes(fmt.bits)
    || fmt.blockAlign !== fmt.channels * fmt.bits / 8 || fmt.byteRate !== fmt.sampleRate * fmt.blockAlign
    || dataBytes % fmt.blockAlign !== 0) return unsupported("Header PCM o dati incompleti/incoerenti");
  return { format: "wave", codec: "PCM", durationSeconds: dataBytes / fmt.byteRate, sampleRateHz: fmt.sampleRate,
    channels: fmt.channels, bitsPerSample: fmt.bits, declaredBitrateBps: fmt.byteRate * 8, dataBytes,
    reason: "Misura derivata da header PCM coerente e numero di campioni dichiarati; nessun decoding o encoder." };
}

export async function inspectVideoContainerSize(blob: Blob, signal?: AbortSignal) {
  const report = await inspectMp4Local(blob, signal);
  return {
    format: "mp4", majorBrand: report.majorBrand, durationSeconds: report.durationSeconds,
    averageContainerBitrateBps: report.averageContainerBitrateBps,
    videoTracks: report.videoTracks, audioTracks: report.audioTracks,
    fragmented: report.containsMovieFragments,
    tracks: report.tracks.map((track) => ({ type: track.kind, codecFourCc: track.codecFourCc,
      width: track.width, height: track.height, rotation: track.quarterTurnDegrees,
      streamBitrateBps: null, fps: null, fpsMode: "unknown" as const })),
    limit: "moov only <=8 MiB, source mdat not decoded; per-stream bitrate and FPS stay unknown",
  };
}

export const MAX_OFFICE_BYTES_266 = OOXML_PACKAGE_LIMITS.maxInputBytes;
