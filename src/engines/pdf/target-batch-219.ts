import { unzipSync, zipSync } from "fflate";
import { inspectPdfBytes } from "./index";
import { recompressPdfEmbeddedJpegs } from "./jpeg-image-aware";
import { recompressPdfScannedImages } from "./scan-image-aware";
import type { PdfArtifact } from "./types";

const MAX_FILES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_BATCH_BYTES = 20 * 1024 * 1024;
const MAX_ZIP_BYTES = 30 * 1024 * 1024;
const MIN_TARGET_BYTES = 1024;
const MAX_TARGET_BYTES = 8 * 1024 * 1024;

export interface PdfTarget219Attempt {
  readonly quality: number;
  readonly longestEdgePx: number;
  readonly outputBytes: number | null;
  readonly reason: string;
}

export interface PdfTarget219FileReport {
  readonly name: string;
  readonly status: "met" | "unmet" | "refused";
  readonly sourceBytes: number;
  readonly finalBytes: number | null;
  readonly targetBytes: number;
  readonly attempts: readonly PdfTarget219Attempt[];
  readonly limitingContent: string;
  readonly nextActions: readonly string[];
  readonly artifact: PdfArtifact | null;
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Compression target batch cancelled", "AbortError");
}

function sourceFilename(name: string, index: number, met: boolean): string {
  const base = name.normalize("NFKC").replaceAll(/[^A-Za-z0-9_.-]/gu, "_").replace(/\.pdf$/iu, "").slice(0, 72) || "source";
  return `${String(index + 1).padStart(2, "0")}-${base}-${met ? "under-target" : "best-effort"}.pdf`;
}

function artifact219(bytes: Uint8Array, name: string, pages: number): PdfArtifact {
  const owned = Uint8Array.from(bytes);
  return { bytes: owned, blob: new Blob([owned], { type: "application/pdf" }), filename: name,
    mime: "application/pdf", pageCount: pages };
}

/**
 * Best effort, never a target guarantee. Every candidate is generated from
 * the ORIGINAL (not successively degrading the previously compressed JPEG).
 * Only existing preservation-checked JPEG/Flate profiles are allowed.
 */
export async function solvePdfTarget219(source: Uint8Array, targetBytes: number, index = 0,
  name = "document.pdf", signal?: AbortSignal): Promise<PdfTarget219FileReport> {
  if (!Number.isSafeInteger(targetBytes) || targetBytes < MIN_TARGET_BYTES || targetBytes > MAX_TARGET_BYTES) {
    throw new Error("INVALID_INPUT: PDF target must be a whole byte count between 1 KiB and 8 MiB");
  }
  if (!(source instanceof Uint8Array) || source.byteLength < 8 || source.byteLength > MAX_FILE_BYTES) {
    throw new Error("PDF_LIMIT: Source PDF exceeds the 8 MiB bounded target solver limit");
  }
  abortIfNeeded(signal);
  const inspection = inspectPdfBytes(source);
  if (inspection.encrypted || inspection.pageCount < 1) throw new Error("UNSUPPORTED_CAPABILITY: Encrypted/page-less PDFs cannot be targeted");
  const attempts: PdfTarget219Attempt[] = [];
  let best = Uint8Array.from(source);
  if (best.byteLength > targetBytes) {
    for (const setting of [
      { quality: 0.8, longestEdgePx: 2048 },
      { quality: 0.55, longestEdgePx: 1280 },
      { quality: 0.35, longestEdgePx: 640 },
    ]) {
      abortIfNeeded(signal);
      try {
        const jpeg = await recompressPdfEmbeddedJpegs(source, { quality: setting.quality }, signal);
        const scan = await recompressPdfScannedImages(jpeg.artifact.bytes, {
          quality: setting.quality, maxLongestEdgePx: setting.longestEdgePx,
        }, signal);
        abortIfNeeded(signal);
        const candidate = scan.artifact.bytes;
        const reopened = inspectPdfBytes(candidate);
        if (reopened.encrypted || reopened.pageCount !== inspection.pageCount ||
            reopened.pages.some((page, pageIndex) => page.width !== inspection.pages[pageIndex]?.width ||
              page.height !== inspection.pages[pageIndex]?.height || page.rotation !== inspection.pages[pageIndex]?.rotation)) {
          throw new Error("PDF_OUTPUT_MISMATCH: Output PDF geometry or page count changed");
        }
        attempts.push({ ...setting, outputBytes: candidate.byteLength, reason: "verified-pdf-source-reparsed" });
        if (candidate.byteLength < best.byteLength) best = Uint8Array.from(candidate);
        if (best.byteLength <= targetBytes) break;
      } catch (error) {
        abortIfNeeded(signal);
        const reason = error instanceof Error ? error.message : "unsupported-profile";
        // Preserve hard safety failures, but isolate an unsupported codec for
        // the next candidate and ultimately report truthful impossibility.
        if (/^PDF_OUTPUT_MISMATCH|^PDF_LIMIT/u.test(reason)) throw error;
        attempts.push({ ...setting, outputBytes: null, reason: reason.slice(0, 180) });
      }
    }
  }
  abortIfNeeded(signal);
  const met = best.byteLength <= targetBytes;
  const limitingContent = met ? "Dimensione del risultato verificata sui byte PDF finali."
    : best.byteLength === source.byteLength
      ? "Nessun profilo JPEG RGB/Flate riconosciuto ha ridotto sufficientemente i dati: altri flussi, vettori o codec non supportati possono dominare il PDF."
      : "Il contenuto comprimibile ha raggiunto il limite dei profili locali disponibili; il PDF ottenuto supera ancora il limite richiesto.";
  return {
    name, status: met ? "met" : "unmet", sourceBytes: source.byteLength,
    finalBytes: best.byteLength, targetBytes, attempts, limitingContent,
    nextActions: met ? [] : ["pdf-split", "pdf-page-delete-extract"],
    artifact: artifact219(best, sourceFilename(name, index, met), inspection.pageCount),
  };
}

export interface PdfTargetBatch219Result {
  readonly reports: readonly PdfTarget219FileReport[];
  readonly artifacts: readonly PdfArtifact[];
  readonly attemptedFiles: number;
  readonly metTargetFiles: number;
  readonly notMetFiles: number;
  readonly refusedFiles: number;
  readonly allMet: boolean;
  readonly targetBytes: number;
  readonly zipIncludes: readonly string[];
  readonly note: string;
}

/** Sequential, bounded local batch. File-level failures never mask other PDFs. */
export async function runPdfTargetBatch219(files: readonly File[], targetBytes: number,
  signal?: AbortSignal): Promise<PdfTargetBatch219Result> {
  if (files.length < 1 || files.length > MAX_FILES) throw new Error("INVALID_INPUT: Choose between 1 and 4 PDFs");
  if (!Number.isSafeInteger(targetBytes) || targetBytes < MIN_TARGET_BYTES || targetBytes > MAX_TARGET_BYTES) {
    throw new Error("INVALID_INPUT: PDF target must be between 1 KiB and 8 MiB");
  }
  if (files.some((file) => !(file instanceof File) || file.size < 8 || file.size > MAX_FILE_BYTES) ||
      files.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES) {
    throw new Error("PDF_LIMIT: Max 8 MiB per PDF and 20 MiB per batch");
  }
  const reports: PdfTarget219FileReport[] = [];
  const artifacts: PdfArtifact[] = [];
  const passing: Record<string, Uint8Array> = {};
  for (const [index, file] of files.entries()) {
    abortIfNeeded(signal);
    try {
      const source = new Uint8Array(await file.arrayBuffer());
      abortIfNeeded(signal);
      const report = await solvePdfTarget219(source, targetBytes, index, file.name, signal);
      reports.push(report);
      if (report.artifact !== null) {
        artifacts.push(report.artifact);
        if (report.status === "met") passing[report.artifact.filename] = Uint8Array.from(report.artifact.bytes);
      }
    } catch (error) {
      abortIfNeeded(signal);
      reports.push({ name: file.name, status: "refused", sourceBytes: file.size, finalBytes: null,
        targetBytes, attempts: [], limitingContent: error instanceof Error ? error.message : "PDF non leggibile",
        nextActions: ["pdf-page-count-verifier"], artifact: null });
    }
  }
  abortIfNeeded(signal);
  const zipIncludes = Object.keys(passing);
  if (files.length > 1 && zipIncludes.length > 0) {
    const zip = zipSync(passing, { level: 0 });
    abortIfNeeded(signal);
    if (zip.length > MAX_ZIP_BYTES) throw new Error("PDF_LIMIT: Batch ZIP exceeds 30 MiB");
    const reopened = unzipSync(zip);
    if (Object.keys(reopened).length !== zipIncludes.length || zipIncludes.some((name) =>
      reopened[name] === undefined || reopened[name]!.byteLength !== passing[name]!.byteLength ||
      !reopened[name]!.every((byte, index) => byte === passing[name]![index]))) {
      throw new Error("PDF_OUTPUT_MISMATCH: Target batch ZIP failed exact reopen integrity");
    }
    const owned = Uint8Array.from(zip);
    artifacts.push({ bytes: owned, blob: new Blob([owned], { type: "application/zip" }),
      filename: "pdf-entro-limite-verificati.zip", mime: "application/zip" });
  }
  return {
    reports, artifacts, attemptedFiles: files.length,
    metTargetFiles: reports.filter((report) => report.status === "met").length,
    notMetFiles: reports.filter((report) => report.status === "unmet").length,
    refusedFiles: reports.filter((report) => report.status === "refused").length,
    allMet: reports.every((report) => report.status === "met"), targetBytes, zipIncludes,
    note: "Target raggiunto solo se il PDF finale è ≤ byte richiesti. ZIP contiene esclusivamente i risultati sotto limite; PDF best-effort fuori limite disponibili singolarmente. File rifiutati isolati senza upload.",
  };
}
