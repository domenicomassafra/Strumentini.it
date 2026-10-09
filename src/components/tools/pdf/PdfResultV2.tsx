import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";
import type { PdfArtifact } from "../../../engines/pdf";
import { inspectPdfBytes } from "../../../engines/pdf";
import { verifyGeneratedArtifact } from "../../../runtime/artifact-verifier";
import { createBoundedTextPreview } from "../../../runtime/bounded-preview";
import { createFileResultItem, createFileResultWorkspace } from "../../../runtime/file-result";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
import { PDF_ALL_RESULT_DECLARATIONS, type PdfResultToolId } from "../../../tools/pdf-result-declarations";
import { DownloadLink } from "../marketing-media/DownloadLink";
import {
  BoundedTextResultPreview,
  FileResultWorkspace,
  ResultActions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "../shared";

type PdfResultRecord = Record<string, unknown>;

export interface VerifiedPdfOutput {
  readonly blob: Blob;
  readonly artifact: OutputArtifactDescriptor;
  readonly pageCount?: number;
}

export interface PreparedPdfResult {
  readonly raw: PdfResultRecord;
  readonly artifacts: readonly VerifiedPdfOutput[];
}

export interface PdfResultV2Props {
  readonly toolId: PdfResultToolId;
  readonly result: PreparedPdfResult;
  readonly sourceFiles: readonly File[];
  readonly onReset: () => void;
  readonly onRetry?: () => void | Promise<void>;
}

const RESULT_KEY_IT: Readonly<Record<string, string>> = {
  artifactCount: "file_generati",
  artifacts: "file_generati",
  byteLength: "dimensione_byte",
  capabilities: "capacità",
  changedPages: "pagine_geometria_diversa",
  comparison: "confronto",
  declaredPageCount: "numero_pagine_dichiarato",
  differences: "differenze",
  encrypted: "cifrato",
  fields: "campi",
  files: "file",
  forms: "campi_modulo",
  height: "altezza",
  images: "immagini",
  inspection: "analisi",
  json: "json",
  links: "collegamenti",
  metadata: "metadati",
  provenance: "provenienza",
  selectedPages: "pagine_selezionate",
  unsupported: "filtri_immagine_non_supportati",
  verification: "verifica",
  objectCount: "numero_oggetti",
  operation: "operazione",
  order: "ordine",
  page: "pagina",
  pageCount: "numero_pagine",
  pages: "pagine",
  policy: "criterio",
  rotation: "rotazione",
  rotations: "rotazioni",
  samePageCount: "stesso_numero_pagine",
  samePageGeometry: "stessa_geometria_pagine",
  sha256: "sha256",
  summary: "riepilogo",
  text: "testo",
  textChangedPages: "pagine_testo_diverso",
  totalBytes: "byte_risultato",
  truncated: "troncato",
  validSignature: "conteggio_coerente",
  warnings: "avvisi",
  width: "larghezza",
};

function asRecord(value: unknown): PdfResultRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as PdfResultRecord
    : { value };
}

function artifactList(value: PdfResultRecord): readonly PdfArtifact[] {
  const artifacts = value.artifacts;
  if (!Array.isArray(artifacts)) return [];
  return artifacts.filter((item): item is PdfArtifact =>
    typeof item === "object"
    && item !== null
    && "blob" in item
    && "bytes" in item
    && "filename" in item
    && "mime" in item,
  );
}

function serializableValue(value: unknown): unknown {
  if (value instanceof Blob) return `[Dati binari: ${value.size} byte]`;
  if (value instanceof Uint8Array) return `[Byte: ${value.byteLength}]`;
  if (Array.isArray(value)) return value.map(serializableValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value as PdfResultRecord).map(([key, entry]) => [RESULT_KEY_IT[key] ?? key, serializableValue(entry)]));
}

function serializedResult(value: PdfResultRecord): string {
  try {
    return JSON.stringify(serializableValue(value), null, 2);
  } catch {
    return "{\n  \"risultato\": \"Dati tecnici non serializzabili\"\n}";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MiB`;
}

function textArtifact(name: string, text: string, mime: "text/plain" | "text/markdown" | "application/json"): OutputArtifactDescriptor {
  const bytes = new TextEncoder().encode(text);
  if (mime === "application/json") JSON.parse(text);
  const roundTrip = new TextDecoder().decode(bytes);
  return createOutputArtifactDescriptor({
    kind: mime === "application/json" ? "structured" : "text",
    name,
    mime,
    bytes,
    verification: {
      state: roundTrip === text ? "verified" : "invalid",
      verifiedMime: mime,
      method: mime === "application/json" ? "JSON.parse + UTF-8 round-trip" : "UTF-8 round-trip",
      ...(roundTrip === text ? {} : { message: "La ricodifica UTF-8 non coincide con il testo prodotto." }),
    },
    fidelity: "structural",
    fidelityNote: "Il file testuale conserva integralmente l'output esposto dal motore locale, entro i limiti dichiarati dal motore stesso.",
  });
}

export async function preparePdfResult(_toolId: PdfResultToolId, value: unknown): Promise<PreparedPdfResult> {
  const raw = asRecord(value);
  const artifacts = await Promise.all(artifactList(raw).map(async (source): Promise<VerifiedPdfOutput> => {
    const pdf = source.mime === "application/pdf";
    const verification = await verifyGeneratedArtifact({
      kind: pdf ? "pdf" : "file",
      name: source.filename,
      declaredMime: source.mime,
      bytes: source.bytes,
      fidelity: pdf
        ? {
            fidelity: "structural",
            statement: "Firma, contenitore e riapertura del PDF prodotto sono verificati; le trasformazioni restano quelle dichiarate dall'engine PDF corrente.",
            limitations: ["Questa UI non renderizza miniature né afferma equivalenza visiva pixel-per-pixel."],
          }
        : {
            fidelity: "lossless",
            statement: "Il flusso file estratto viene esposto senza ricodifica dei byte prodotti dall'engine PDF.",
          },
      ...(pdf ? {
        reopen: (bytes: Uint8Array) => {
          try {
            const inspection = inspectPdfBytes(bytes);
            return {
              ok: true,
              method: "parser PDF locale riaperto sul file prodotto",
              facts: { pageCount: inspection.pageCount, byteLength: inspection.byteLength, encrypted: inspection.encrypted },
            };
          } catch (error) {
            return {
              ok: false,
              method: "parser PDF locale riaperto sul file prodotto",
              message: error instanceof Error ? error.message : "Il PDF prodotto non può essere riaperto dal parser locale.",
            };
          }
        },
      } : {}),
    });
    return {
      blob: source.blob,
      artifact: verification.artifact,
      ...(source.pageCount === undefined ? {} : { pageCount: source.pageCount }),
    };
  }));
  return { raw, artifacts };
}

function sourceDescriptor(sourceFiles: readonly File[]): { name: string; byteLength: number; detectedMime?: string } {
  if (sourceFiles.length === 1 && sourceFiles[0] !== undefined) {
    const source = sourceFiles[0];
    return {
      name: source.name,
      byteLength: source.size,
      ...(source.type === "" ? {} : { detectedMime: source.type }),
    };
  }
  const byteLength = sourceFiles.reduce((total, file) => total + file.size, 0);
  return { name: `${sourceFiles.length} file locali`, byteLength };
}

function workspaceFor(toolId: PdfResultToolId, outputs: readonly VerifiedPdfOutput[], sourceFiles: readonly File[]) {
  const source = sourceDescriptor(sourceFiles);
  return createFileResultWorkspace(outputs.map((output, index) => createFileResultItem({
    id: `${toolId}-${index + 1}`,
    source,
    status: output.artifact.download.ready ? "success" : "error",
    artifact: output.artifact,
    beforeBytes: source.byteLength,
    afterBytes: output.artifact.byteLength,
    retryable: true,
    cancellable: false,
    ...(output.artifact.download.ready ? {} : { message: output.artifact.verification.message ?? "Verifica del file prodotto non superata." }),
  })), { location: "LOCAL", network: "forbidden" });
}

function rawPreview(raw: PdfResultRecord) {
  const serialized = serializedResult(raw);
  return createBoundedTextPreview(textArtifact("pdf-result.json", serialized, "application/json"), 42, "code");
}

function SecondaryRaw({ raw }: { readonly raw: PdfResultRecord }) {
  return (
    <details data-result-secondary-raw>
      <summary>Dati tecnici strutturati (anteprima)</summary>
      <BoundedTextResultPreview preview={rawPreview(raw)} />
    </details>
  );
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Sì" : "No";
  return undefined;
}

function factRows(raw: PdfResultRecord): readonly { label: string; value: ComponentChildren }[] {
  const rows: Array<{ label: string; value: ComponentChildren }> = [];
  const scalarKeys = ["pageCount", "declaredPageCount", "byteLength", "totalBytes", "artifactCount", "encrypted", "validSignature", "truncated", "mode", "operation"] as const;
  for (const key of scalarKeys) {
    const value = scalar(raw[key]);
    if (value !== undefined) rows.push({ label: RESULT_KEY_IT[key] ?? key, value });
  }
  for (const key of ["pages", "forms", "links", "warnings"] as const) {
    const value = raw[key];
    if (Array.isArray(value)) rows.push({ label: RESULT_KEY_IT[key] ?? key, value: `${value.length}` });
  }
  if (Array.isArray(raw.selectedPages)) rows.push({ label: "Pagine selezionate", value: raw.selectedPages.join(", ") });
  if (typeof raw.renderer === "string") rows.push({ label: "Renderer", value: raw.renderer === "pdfjs-local-lazy" ? "PDF.js locale (lazy)" : raw.renderer });
  if (typeof raw.effectiveDpi === "number") rows.push({ label: "DPI effettivi", value: String(raw.effectiveDpi) });
  if (typeof raw.scale === "number") rows.push({ label: "Scala render", value: `${raw.scale}×` });
  if (typeof raw.mime === "string") rows.push({ label: "Formato uscita", value: raw.mime });
  if (raw.zipIncluded === true) rows.push({ label: "ZIP multipagina verificato", value: `${typeof raw.zipEntries === "number" ? raw.zipEntries : "?"} file` });
  if (typeof raw.renderedImageCount === "number") rows.push({ label: "Immagini pagina prodotte", value: String(raw.renderedImageCount) });
  if (Array.isArray(raw.failures)) rows.push({ label: "Pagine non renderizzate", value: String(raw.failures.length) });
  if (typeof raw.pageSize === "string") rows.push({ label: "Formato pagina PDF", value: raw.pageSize.toUpperCase() });
  if (typeof raw.orientation === "string") rows.push({ label: "Orientamento pagina", value: raw.orientation });
  if (typeof raw.fit === "string") rows.push({ label: "Adattamento immagine", value: raw.fit });
  if (typeof raw.marginMm === "number") rows.push({ label: "Margine", value: `${raw.marginMm} mm` });
  if (Array.isArray(raw.conversions)) {
    rows.push({ label: "Immagini preparate per PDF", value: String(raw.conversions.length) });
    const reencoded = raw.conversions.filter((entry) => typeof entry === "object" && entry !== null && (entry as PdfResultRecord).embeddedAs === "jpeg-reencode").length;
    rows.push({ label: "Ricodificate in JPEG", value: String(reencoded) });
    rows.push({ label: "JPEG originali incorporati", value: String(raw.conversions.length - reencoded) });
  }
  if (Array.isArray(raw.provenance)) {
    rows.push({ label: "Immagini con provenienza", value: String(raw.provenance.length) });
    raw.provenance.slice(0, 3).forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null) return;
      const record = entry as PdfResultRecord;
      const object = typeof record.object === "number" ? `oggetto ${record.object}` : "oggetto diretto";
      const occurrences = Array.isArray(record.occurrences)
        ? record.occurrences.map((occurrence) => {
            if (typeof occurrence !== "object" || occurrence === null) return "?";
            const occurrenceRecord = occurrence as PdfResultRecord;
            const page = typeof occurrenceRecord.page === "number" ? occurrenceRecord.page : "?";
            const resource = typeof occurrenceRecord.resourceName === "string" ? occurrenceRecord.resourceName : "?";
            return `p.${page}/${resource}`;
          }).join(", ")
        : "—";
      rows.push({ label: `JPEG ${index + 1} · ${object}`, value: occurrences });
    });
  }
  if (Array.isArray(raw.unsupported)) {
    rows.push({ label: "Immagini non esportate per filtro", value: String(raw.unsupported.length) });
    raw.unsupported.slice(0, 3).forEach((entry) => {
      if (typeof entry !== "object" || entry === null) return;
      const record = entry as PdfResultRecord;
      const page = typeof record.page === "number" ? record.page : "?";
      const resourceName = typeof record.resourceName === "string" ? record.resourceName : "?";
      const filters = Array.isArray(record.filters) ? record.filters.join(" → ") : "nessun filtro esportabile";
      rows.push({ label: `Pagina ${page} · ${resourceName}`, value: filters });
    });
  }
  if (Array.isArray(raw.order)) {
    rows.push({ label: "Ordine pagine", value: raw.order.join(" → ") });
  }
  if (typeof raw.rotations === "object" && raw.rotations !== null && !Array.isArray(raw.rotations)) {
    rows.push({ label: "Rotazioni", value: JSON.stringify(raw.rotations) });
  }
  if (Array.isArray(raw.pages)) {
    raw.pages.slice(0, 4).forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null) return;
      const page = entry as PdfResultRecord;
      if (typeof page.width !== "number" || typeof page.height !== "number") return;
      const pageNumber = typeof page.page === "number" ? page.page : index + 1;
      const rotation = typeof page.rotation === "number" ? ` · rotazione ${page.rotation}°` : "";
      rows.push({ label: `Pagina ${pageNumber}`, value: `${page.width} × ${page.height}${rotation}` });
    });
  }
  if (Array.isArray(raw.forms)) {
    raw.forms.slice(0, 6).forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null) return;
      const form = entry as PdfResultRecord;
      if (typeof form.name !== "string") return;
      rows.push({ label: `Campo ${index + 1}`, value: form.name });
    });
  }
  const inspection = typeof raw.inspection === "object" && raw.inspection !== null ? raw.inspection as PdfResultRecord : null;
  if (inspection !== null) {
    for (const key of ["version", "objectCount", "pageCount", "encrypted"] as const) {
      const value = scalar(inspection[key]);
      if (value !== undefined) rows.push({ label: `PDF ${RESULT_KEY_IT[key] ?? key}`, value });
    }
    const metadata = typeof inspection.metadata === "object" && inspection.metadata !== null ? inspection.metadata as PdfResultRecord : null;
    if (metadata !== null) {
      for (const [key, label] of [["title", "Titolo"], ["author", "Autore"]] as const) {
        const value = scalar(metadata[key]);
        if (value !== undefined && value !== "") rows.push({ label, value });
      }
      const recognized = typeof metadata.recognizedInfo === "object" && metadata.recognizedInfo !== null ? metadata.recognizedInfo as PdfResultRecord : {};
      const unknown = typeof metadata.unknownInfo === "object" && metadata.unknownInfo !== null ? metadata.unknownInfo as PdfResultRecord : {};
      rows.push({ label: "Campi metadata riconosciuti", value: String(Object.keys(recognized).length) });
      rows.push({ label: "Campi Info sconosciuti", value: String(Object.keys(unknown).length) });
      Object.entries(unknown).slice(0, 3).forEach(([key, value]) => rows.push({ label: `Info sconosciuto: ${key}`, value: scalar(value) ?? "valore non testuale" }));
      const xmpObjectIds = Array.isArray(metadata.xmpObjectIds) ? metadata.xmpObjectIds : [];
      rows.push({ label: "Stream XMP /Metadata", value: xmpObjectIds.length === 0 ? "Nessuno" : xmpObjectIds.join(", ") });
    }
  }
  const verification = typeof raw.verification === "object" && raw.verification !== null ? raw.verification as PdfResultRecord : null;
  if (verification !== null) {
    const reparsed = scalar(verification.reparsed);
    const metadataRemoved = scalar(verification.metadataRemoved);
    if (reparsed !== undefined) rows.push({ label: "Output riaperto e riparsato", value: reparsed });
    if (metadataRemoved !== undefined) rows.push({ label: "Metadati rimossi dopo reparse", value: metadataRemoved });
    const pageCount = typeof verification.pageCount === "object" && verification.pageCount !== null ? verification.pageCount as PdfResultRecord : null;
    if (pageCount !== null) {
      const stable = scalar(pageCount.stable);
      if (stable !== undefined) rows.push({ label: "Numero pagine stabile", value: stable });
    }
    const textBaseline = typeof verification.textBaseline === "object" && verification.textBaseline !== null ? verification.textBaseline as PdfResultRecord : null;
    if (textBaseline !== null) {
      const status = scalar(textBaseline.status);
      const stable = scalar(textBaseline.stable);
      if (status !== undefined) rows.push({ label: "Baseline testo", value: status === "verified" ? `Verificata${stable === undefined ? "" : ` · stabile: ${stable}`}` : `Non disponibile${typeof textBaseline.reason === "string" ? ` · ${textBaseline.reason}` : ""}` });
    }
  }
  const comparison = typeof raw.comparison === "object" && raw.comparison !== null ? raw.comparison as PdfResultRecord : null;
  if (comparison !== null) {
    for (const key of ["samePageCount", "samePageGeometry"] as const) {
      const value = scalar(comparison[key]);
      if (value !== undefined) rows.push({ label: RESULT_KEY_IT[key] ?? key, value });
    }
    for (const key of ["changedPages", "textChangedPages"] as const) {
      const value = comparison[key];
      if (Array.isArray(value)) rows.push({ label: RESULT_KEY_IT[key] ?? key, value: String(value.length) });
    }
  }
  return rows.slice(0, 14);
}

function validatorHeadline(toolId: PdfResultToolId, raw: PdfResultRecord): string {
  if (toolId === "pdf-compare-lite") return typeof raw.summary === "string" ? raw.summary : "Confronto completato";
  if (toolId === "pdf-page-count-verifier") {
    const pages = typeof raw.pageCount === "number" ? raw.pageCount : null;
    return raw.validSignature === true && pages !== null ? `Conteggio verificato: ${pages} pagine` : "Conteggio PDF da verificare";
  }
  if (toolId === "pdf-password-check-remove") return raw.encrypted === true ? "PDF cifrato" : "PDF non cifrato";
  if (toolId === "pdf-form-inspector") return `${Array.isArray(raw.forms) ? raw.forms.length : 0} campi modulo rilevati`;
  if (toolId === "pdf-page-size-inspector") return `${typeof raw.pageCount === "number" ? raw.pageCount : 0} pagine analizzate`;
  if (toolId === "pdf-metadata-inspector") return `${typeof raw.pageCount === "number" ? raw.pageCount : 0} pagine · ${typeof raw.byteLength === "number" ? formatBytes(raw.byteLength) : "dimensione non disponibile"}`;
  return "Controllo PDF completato";
}

function textPayload(toolId: PdfResultToolId, raw: PdfResultRecord): { text: string; filename: string; mime: "text/plain" | "text/markdown" | "application/json"; metrics: readonly { label: string; value: string }[] } {
  if (toolId === "document-handoff-manifest") {
    const text = typeof raw.json === "string" ? raw.json : serializedResult(raw);
    const manifest = typeof raw.manifest === "object" && raw.manifest !== null ? raw.manifest as PdfResultRecord : null;
    const files = Array.isArray(manifest?.files) ? manifest.files.length : 0;
    return { text, filename: "document-handoff.json", mime: "application/json", metrics: [{ label: "File nel manifest", value: String(files) }, { label: "Righe", value: String(text.split(/\r\n|\n|\r/u).length) }] };
  }
  if (toolId === "pdf-link-extractor") {
    const links = Array.isArray(raw.links) ? raw.links : [];
    const text = links.map((entry, index) => {
      const record = typeof entry === "object" && entry !== null ? entry as PdfResultRecord : {};
      const page = typeof record.page === "number" ? `Pagina ${record.page}` : "Pagina non specificata";
      const uri = typeof record.uri === "string" ? record.uri : String(entry);
      return `${index + 1}. ${page} — ${uri}`;
    }).join("\n");
    return { text, filename: "pdf-links.txt", mime: "text/plain", metrics: [{ label: "Collegamenti", value: String(links.length) }, { label: "Pagine", value: typeof raw.pageCount === "number" ? String(raw.pageCount) : "—" }] };
  }
  if (toolId === "pdf-multi-text-search") {
    const files = Array.isArray(raw.files) ? raw.files : [];
    const matches = Array.isArray(raw.matches) ? raw.matches : [];
    const lines: string[] = [];
    lines.push("Query: " + (typeof raw.query === "string" ? raw.query : ""));
    lines.push("Risultati restituiti: " + String(typeof raw.returnedMatches === "number" ? raw.returnedMatches : matches.length) + " / " + String(typeof raw.totalMatches === "number" ? raw.totalMatches : matches.length));
    lines.push("");
    files.forEach((entry, index) => {
      const file = typeof entry === "object" && entry !== null ? entry as PdfResultRecord : {};
      const filename = typeof file.filename === "string" ? file.filename : "file " + String(index + 1);
      const status = typeof file.status === "string" ? file.status : "unknown";
      const matchCount = typeof file.matchCount === "number" ? file.matchCount : 0;
      lines.push("[FILE " + String(index + 1) + "] " + filename + " — " + status + " — match: " + String(matchCount));
      if (status === "no-text" && typeof file.ocrHandoff === "object" && file.ocrHandoff !== null) {
        const handoff = file.ocrHandoff as PdfResultRecord;
        lines.push("OCR: " + (typeof handoff.reason === "string" ? handoff.reason : "non disponibile"));
      }
      if (typeof file.errorMessage === "string") lines.push("Errore: " + file.errorMessage);
    });
    lines.push("");
    matches.forEach((entry) => {
      const match = typeof entry === "object" && entry !== null ? entry as PdfResultRecord : {};
      const filename = typeof match.filename === "string" ? match.filename : "?";
      const page = typeof match.page === "number" ? match.page : "?";
      const matchIndex = typeof match.matchIndex === "number" ? match.matchIndex + 1 : "?";
      const context = typeof match.context === "string" ? match.context : "";
      lines.push("[" + filename + " · pagina " + String(page) + " · occorrenza " + String(matchIndex) + "] " + context);
    });
    return {
      text: lines.join("\n"),
      filename: "ricerca-pdf.txt",
      mime: "text/plain",
      metrics: [
        { label: "File analizzati", value: String(files.length) },
        { label: "Match totali", value: String(typeof raw.totalMatches === "number" ? raw.totalMatches : matches.length) },
        { label: "Match restituiti", value: String(typeof raw.returnedMatches === "number" ? raw.returnedMatches : matches.length) },
        { label: "Risultato troncato", value: raw.truncated === true ? "Sì" : "No" },
      ],
    };
  }
  if (toolId === "pdf-to-markdown") {
    const text = typeof raw.markdown === "string" ? raw.markdown : "";
    const sourceName = typeof raw.filename === "string" ? raw.filename : "document.pdf";
    const filename = sourceName.replace(/\.pdf$/iu, "") + ".md";
    return {
      text,
      filename,
      mime: "text/markdown",
      metrics: [
        { label: "Stato", value: typeof raw.status === "string" ? raw.status : "unknown" },
        { label: "Pagine sorgente", value: typeof raw.pageCount === "number" ? String(raw.pageCount) : "—" },
        { label: "Pagine esportate", value: String(Array.isArray(raw.pages) ? raw.pages.length : 0) },
        { label: "Perdite dichiarate", value: String(Array.isArray(raw.losses) ? raw.losses.length : 0) },
        { label: "Output troncato", value: raw.truncated === true ? "Sì" : "No" },
      ],
    };
  }
  const text = typeof raw.text === "string" ? raw.text : "";
  const pages = Array.isArray(raw.pages) ? raw.pages.length : 0;
  const mode = typeof raw.mode === "string" ? raw.mode : "non specificata";
  const selectedPages = Array.isArray(raw.selectedPages) ? raw.selectedPages.join(", ") : "tutte";
  return { text, filename: "pdf-text.txt", mime: "text/plain", metrics: [{ label: "Pagine lette", value: String(pages) }, { label: "Pagine selezionate", value: selectedPages }, { label: "Modalità", value: mode }, { label: "Separatore pagina", value: "===== PAGINA N =====" }, { label: "Caratteri estratti", value: String(text.length) }, { label: "Output troncato dal motore", value: raw.truncated === true ? "Sì" : "No" }] };
}

function PdfPagePreview({ outputs }: { readonly outputs: readonly VerifiedPdfOutput[] }) {
  const [page, setPage] = useState(1);
  const first = outputs[0];
  if (first === undefined) return null;
  const count = Math.max(1, first.pageCount ?? 1);
  const shown = Math.min(count, 12);
  const safePage = Math.min(page, count);
  return (
    <section data-result-slot="page-preview" aria-label="Riepilogo pagine del PDF prodotto">
      <p class="file-note">Anteprima strutturale: {count} pagine nel primo PDF prodotto. Le miniature non sono disponibili in questo renderer.</p>
      <div class="actions" aria-label="Pagine del primo PDF prodotto">
        {Array.from({ length: shown }, (_, index) => index + 1).map((pageNumber) => (
          <button
            type="button"
            data-page-preview-control={true}
            aria-pressed={safePage === pageNumber ? "true" : "false"}
            onClick={() => setPage(pageNumber)}
            key={pageNumber}
          >
            Pagina {pageNumber}
          </button>
        ))}
      </div>
      <p class="gutter-note" role="status">Pagina selezionata: {safePage} di {count}{count > shown ? ` · controlli mostrati per le prime ${shown}` : ""}.</p>
    </section>
  );
}

function downloadVerified(output: VerifiedPdfOutput): void {
  if (!output.artifact.download.ready) return;
  const url = URL.createObjectURL(output.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = output.artifact.download.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string, setStatus: (value: string) => void): Promise<void> {
  if (navigator.clipboard === undefined) {
    setStatus("Gli appunti non sono disponibili; seleziona il contenuto dall'anteprima.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Risultato completo copiato.");
  } catch {
    setStatus("Il browser ha bloccato gli appunti; seleziona il contenuto dall'anteprima.");
  }
}

function downloadText(artifact: OutputArtifactDescriptor): void {
  if (!artifact.download.ready) return;
  const url = URL.createObjectURL(new Blob([artifact.bytes.slice().buffer], { type: artifact.mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.download.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PdfResultV2({ toolId, result, sourceFiles, onReset, onRetry }: PdfResultV2Props) {
  const [actionStatus, setActionStatus] = useState("");
  const declaration = PDF_ALL_RESULT_DECLARATIONS[toolId];
  const serialized = useMemo(() => serializedResult(result.raw), [result.raw]);

  if (declaration.class === "pdf" || declaration.class === "file") {
    const primary = result.artifacts.length === 1 ? result.artifacts[0] : undefined;
    const workspace = workspaceFor(toolId, result.artifacts, sourceFiles);
    const actions = resolveResultActions({
      declaration,
      primary: primary?.artifact.download.ready === true ? "download" : null,
      ...(primary === undefined ? {} : { artifact: primary.artifact }),
      retryReady: onRetry !== undefined,
      resetReady: true,
    });
    const totalBytes = result.artifacts.reduce((total, output) => total + output.artifact.byteLength, 0);
    const totalPages = result.artifacts.reduce((total, output) => total + (output.pageCount ?? 0), 0);
    const jpegAnalysis = toolId === "pdf-compression-lite" && typeof result.raw.analysis === "object" && result.raw.analysis !== null
      && ["jpeg-rgb-reencode", "scan-flate-to-jpeg"].includes(String((result.raw.analysis as PdfResultRecord).profile)) ? result.raw.analysis as PdfResultRecord : null;
    const scanMode = jpegAnalysis?.profile === "scan-flate-to-jpeg";
    const rows = [
      { label: "File prodotti", value: String(result.artifacts.length) },
      { label: "Dimensione risultati", value: formatBytes(totalBytes) },
      ...(totalPages > 0 ? [{ label: "Pagine prodotte", value: String(totalPages) }] : []),
      { label: "Verifica artifact", value: result.artifacts.every(({ artifact }) => artifact.download.ready) ? "Firma/contenitore coerenti" : "Almeno un file non ha superato la verifica" },
      ...(jpegAnalysis === null ? [] : [
        { label: scanMode ? "Immagini Flate ricodificate" : "JPEG effettivamente ricodificati", value: String(jpegAnalysis.touched) },
        { label: scanMode ? "Immagini lasciate invariate" : "JPEG/immagini lasciati invariati", value: String(jpegAnalysis.skipped) },
        { label: "Byte risparmiati", value: String(jpegAnalysis.savedBytes) },
        ...(scanMode ? [
          { label: jpegAnalysis.targetDpi === null || jpegAnalysis.targetDpi === undefined ? "Lato massimo richiesto" : "DPI effettivi richiesti", value: jpegAnalysis.targetDpi === null || jpegAnalysis.targetDpi === undefined
            ? `${jpegAnalysis.maxLongestEdgePx} pixel` : `${jpegAnalysis.targetDpi} DPI` },
          { label: "DPI di posizionamento", value: jpegAnalysis.dpiCoverage === "verified-simple-uncompressed-paints"
            ? jpegAnalysis.dpiUsedForDownsample ? "Verificati e applicati ai raster idonei" : "Verificati; nessuna riduzione DPI applicata"
            : "Non verificabili: nessuna stima inventata" },
          { label: "Downsample applicato", value: jpegAnalysis.downsampleApplied ? "Sì" : "No" },
          { label: "Grigio applicato", value: jpegAnalysis.grayscaleApplied ? "Sì" : "No" },
          { label: "Originale consigliato", value: jpegAnalysis.recommendOriginal ? "Sì" : "No" },
        ] : []),
        { label: "Equivalenza visiva", value: "Non certificata: JPEG con perdita" },
      ]),
      ...factRows(result.raw),
    ].slice(0, 14);
    return (
      <div data-result-class={declaration.class}>
        {declaration.class === "pdf" ? <PdfPagePreview outputs={result.artifacts} /> : null}
        {declaration.class === "pdf" ? <div data-result-slot="operation-summary"><ResultBreakdown label="Riepilogo operazione" rows={rows} /></div> : null}
        {declaration.class === "file" ? <ResultBreakdown label="Riepilogo estrazione" rows={rows} /> : null}
        <div data-result-slot="file-workspace">
          <FileResultWorkspace
            workspace={workspace}
            actionsFor={(item) => {
              const output = result.artifacts.find(({ artifact }) => artifact.name === item.artifact?.name);
              return output?.artifact.download.ready === true
                ? <DownloadLink blob={output.blob} filename={output.artifact.download.filename}>Scarica {output.artifact.download.filename}</DownloadLink>
                : null;
            }}
          />
        </div>
        <ResultProvenance>Elaborazione locale nel browser; i file non vengono caricati in rete.</ResultProvenance>
        <ResultActions actions={actions} onAction={{
          ...(primary === undefined ? {} : { download: () => downloadVerified(primary) }),
          ...(onRetry === undefined ? {} : { retry: onRetry }),
          reset: onReset,
        }} />
        <SecondaryRaw raw={result.raw} />
      </div>
    );
  }

  if (declaration.class === "text-code") {
    const payload = textPayload(toolId, result.raw);
    const artifact = textArtifact(payload.filename, payload.text, payload.mime);
    const preview = createBoundedTextPreview(artifact, 36, "code");
    const canDownload = toolId === "document-handoff-manifest" || toolId === "pdf-to-markdown" && payload.text !== "";
    const actions = resolveResultActions({
      declaration,
      primary: declaration.capabilities.includes("copy") ? "copy" : canDownload && artifact.download.ready ? "download" : null,
      hasCopyPayload: payload.text !== "",
      ...(canDownload ? { artifact } : {}),
      resetReady: true,
    });
    return (
      <div data-result-class="text-code">
        <ResultPrimaryAnswer label="Risultato">{
          toolId === "pdf-text-extraction"
            ? String(payload.metrics[0]?.value ?? 0) + " pagine di testo"
            : toolId === "pdf-multi-text-search"
              ? String(payload.metrics[1]?.value ?? 0) + " corrispondenze"
              : toolId === "pdf-to-markdown"
                ? "PDF→Markdown: " + String(payload.metrics[0]?.value ?? "stato sconosciuto")
                : String(payload.metrics[0]?.value ?? 0) + " elementi"
        }</ResultPrimaryAnswer>
        <div data-result-slot="counts"><ResultBreakdown rows={payload.metrics} /></div>
        {toolId === "pdf-to-markdown" && Array.isArray(result.raw.losses) ? (
          <ResultBreakdown
            label="Perdite dichiarate"
            rows={result.raw.losses.map((loss, index) => ({ label: "Limite " + String(index + 1), value: String(loss) }))}
          />
        ) : null}
        {toolId === "pdf-to-markdown" && typeof result.raw.ocrHandoff === "object" && result.raw.ocrHandoff !== null ? (
          <ResultInterpretation state="warning">
            {String((result.raw.ocrHandoff as PdfResultRecord).reason ?? "Il percorso OCR non è disponibile in questa build.")}
          </ResultInterpretation>
        ) : null}
        <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={preview} /></div>
        <ResultProvenance>Output prodotto localmente dall'engine PDF corrente; l'anteprima è limitata, mentre le azioni operano sul risultato completo.</ResultProvenance>
        <ResultActions actions={actions} onAction={{
          copy: () => copyText(payload.text, setActionStatus),
          ...(canDownload ? { download: () => downloadText(artifact) } : {}),
          reset: onReset,
        }} />
        {actionStatus !== "" ? <p class="file-note" role="status">{actionStatus}</p> : null}
        <SecondaryRaw raw={result.raw} />
      </div>
    );
  }

  const rows = factRows(result.raw);
  const actions = resolveResultActions({
    declaration,
    primary: "copy",
    hasCopyPayload: serialized !== "",
    retryReady: onRetry !== undefined,
    resetReady: true,
  });
  const headline = validatorHeadline(toolId, result.raw);
  const warning = toolId === "pdf-password-check-remove" && result.raw.encrypted === true
    || toolId === "pdf-page-count-verifier" && result.raw.validSignature === false
    || toolId === "pdf-compare-lite" && typeof result.raw.summary === "string" && /differences found/iu.test(result.raw.summary);
  return (
    <div data-result-class="validator">
      <ResultExplanation
        primary={<div data-result-slot="primary"><ResultPrimaryAnswer label="Esito">{headline}</ResultPrimaryAnswer></div>}
        interpretation={<div data-result-slot="interpretation"><ResultInterpretation state={warning ? "warning" : "success"}>Controllo eseguito sui byte locali con i limiti dichiarati dall'engine PDF.</ResultInterpretation></div>}
        breakdown={<div data-result-slot="checks"><ResultBreakdown label="Fatti verificati" rows={rows} /></div>}
        provenance={<div data-result-slot="provenance"><ResultProvenance>Nessun upload del documento; nessun bypass di cifratura viene tentato.</ResultProvenance></div>}
      />
      <ResultActions actions={actions} onAction={{
        copy: () => copyText(serialized, setActionStatus),
        ...(onRetry === undefined ? {} : { retry: onRetry }),
        reset: onReset,
      }} />
      {actionStatus !== "" ? <p class="file-note" role="status">{actionStatus}</p> : null}
      <SecondaryRaw raw={result.raw} />
    </div>
  );
}
