import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { verifyGeneratedArtifact } from "../../../runtime/artifact-verifier";
import { createFileResultItem, createFileResultWorkspace } from "../../../runtime/file-result";
import type { OutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
import { IMAGE_RESULT_DECLARATIONS, type ImageResultToolId } from "../../../tools/image-result-declarations";
import { DownloadLink } from "../marketing-media/DownloadLink";
import {
  FileResultWorkspace,
  ResultActions,
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "../shared";

export type ImageResultValue = Record<string, unknown>;

export interface VerifiedImageOutput {
  readonly blob: Blob;
  readonly artifact: OutputArtifactDescriptor;
  readonly width?: number;
  readonly height?: number;
  readonly sourceIndex?: number;
}

export interface PreparedImageResult {
  readonly raw: ImageResultValue;
  readonly artifacts: readonly VerifiedImageOutput[];
  readonly zip?: { readonly blob: Blob; readonly artifact: OutputArtifactDescriptor };
}

interface ImageResultV2Props {
  readonly toolId: ImageResultToolId;
  readonly result: PreparedImageResult;
  readonly sourceFiles?: readonly File[];
  readonly onReset: () => void;
  readonly onRetry?: () => void | Promise<void>;
}

interface BlobCandidate {
  readonly blob: Blob;
  readonly filename: string;
  readonly declaredMime: string;
  readonly width?: number;
  readonly height?: number;
  readonly sourceIndex?: number;
}

function asRecord(value: unknown): ImageResultValue | null {
  return typeof value === "object" && value !== null ? value as ImageResultValue : null;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function candidateFor(record: ImageResultValue, fallback: ImageResultValue): BlobCandidate | null {
  if (!(record.blob instanceof Blob)) return null;
  const filename = stringField(record.filename) ?? stringField(fallback.filename) ?? "immagine-risultato";
  const declaredMime = stringField(record.outputMime)
    ?? stringField(record.mime)
    ?? stringField(fallback.outputMime)
    ?? stringField(fallback.mime)
    ?? record.blob.type;
  if (declaredMime.trim() === "") return null;
  const size = numberField(record.size);
  const width = numberField(record.width) ?? numberField(fallback.outputWidth) ?? numberField(fallback.width) ?? size;
  const height = numberField(record.height) ?? numberField(fallback.outputHeight) ?? numberField(fallback.height) ?? size;
  return {
    blob: record.blob,
    filename,
    declaredMime,
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(numberField(record.sourceIndex) === undefined ? {} : { sourceIndex: numberField(record.sourceIndex)! }),
  };
}

function collectBlobCandidates(raw: ImageResultValue): readonly BlobCandidate[] {
  const candidates: BlobCandidate[] = [];
  const direct = candidateFor(raw, raw);
  if (direct !== null) candidates.push(direct);
  if (Array.isArray(raw.items)) {
    for (const item of raw.items) {
      const record = asRecord(item);
      if (record === null) continue;
      const candidate = candidateFor(record, raw);
      if (candidate !== null) candidates.push(candidate);
    }
  }
  return candidates;
}

export async function prepareImageResult(value: unknown): Promise<PreparedImageResult> {
  const raw = asRecord(value) ?? (Array.isArray(value) ? { items: value } : { value });
  const artifacts = await Promise.all(collectBlobCandidates(raw).map(async (candidate): Promise<VerifiedImageOutput> => {
    const bytes = new Uint8Array(await candidate.blob.arrayBuffer());
    const verification = await verifyGeneratedArtifact({
      kind: candidate.declaredMime === "application/pdf" ? "pdf" : "image",
      name: candidate.filename,
      declaredMime: candidate.declaredMime,
      bytes,
      fidelity: {
        fidelity: "unknown",
        statement: "Firma, contenitore e MIME del file prodotto sono verificati; la fedeltà visiva resta governata dal contratto dell'engine che ha generato i pixel.",
      },
    });
    return {
      blob: candidate.blob,
      artifact: verification.artifact,
      ...(candidate.width === undefined ? {} : { width: candidate.width }),
      ...(candidate.height === undefined ? {} : { height: candidate.height }),
      ...(candidate.sourceIndex === undefined ? {} : { sourceIndex: candidate.sourceIndex }),
    };
  }));
  let zip: PreparedImageResult["zip"];
  if (raw.zipBlob instanceof Blob && raw.zipFilename === "immagini-compresse.zip") {
    const verification = await verifyGeneratedArtifact({
      kind: "file", name: raw.zipFilename, declaredMime: "application/zip",
      bytes: new Uint8Array(await raw.zipBlob.arrayBuffer()),
      fidelity: { fidelity: "structural", statement: "Archivio locale con voci ispezionate e verificate individualmente." },
    });
    if (verification.success) zip = { blob: raw.zipBlob, artifact: verification.artifact };
  }
  return { raw, artifacts, ...(zip === undefined ? {} : { zip }) };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MiB`;
}

function displayValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return "—";
}

function detailRows(raw: ImageResultValue): readonly { label: string; value: string }[] {
  const ignored = new Set(["blob", "items", "palette", "dominant", "metadataGroups", "fidelity", "zipBlob"]);
  return Object.entries(raw)
    .filter(([key]) => !ignored.has(key))
    .slice(0, 10)
    .map(([key, value]) => ({ label: key, value: displayValue(value) }));
}

function metadataGroupsLabel(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "nessuno";
  return value.map((entry) => {
    const group = asRecord(entry);
    const carrier = stringField(group?.carrier) ?? "metadata";
    const count = numberField(group?.count) ?? 0;
    const bytes = numberField(group?.bytes) ?? 0;
    return `${carrier} ×${count} · ${formatBytes(bytes)}`;
  }).join("; ");
}

function collectionRows(raw: ImageResultValue): readonly { label: string; value: string }[] {
  const rows: Array<{ label: string; value: string }> = [];
  if (Array.isArray(raw.items)) {
    raw.items.slice(0, 20).forEach((item, index) => rows.push({ label: `Elemento ${index + 1}`, value: displayValue(item) }));
  }
  if (Array.isArray(raw.palette)) {
    raw.palette.slice(0, 12).forEach((item, index) => rows.push({ label: `Colore ${index + 1}`, value: displayValue(item) }));
  }
  if (raw.dominant !== undefined && raw.dominant !== null) {
    rows.push({ label: "Colore dominante", value: displayValue(raw.dominant) });
  }
  return rows;
}

function copyPayload(raw: ImageResultValue): string {
  const serializable = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "blob"));
  return JSON.stringify(serializable, (_key, value) => value instanceof Blob ? `[file ${value.type || "binario"} · ${value.size} byte]` : value, 2);
}

function calculatorHeadline(toolId: ImageResultToolId, raw: ImageResultValue): string {
  switch (toolId) {
    case "aspect-ratio-calculator": return stringField(raw.ratio) ?? "Rapporto calcolato";
    case "color-converter":
    case "color-picker": return stringField(raw.hex) ?? "Colore calcolato";
    case "dominant-color-extractor": return stringField(asRecord(raw.dominant)?.hex) ?? "Colore dominante calcolato";
    case "image-dimensions-batch-inspector": return `${Array.isArray(raw.items) ? raw.items.length : 0} immagini analizzate`;
    case "image-metadata-viewer": return numberField(raw.width) !== undefined && numberField(raw.height) !== undefined
      ? `${raw.width}×${raw.height} px`
      : "Metadati immagine letti";
    case "image-rename-batch-preview": return `${Array.isArray(raw.items) ? raw.items.length : 0} nomi in anteprima`;
    case "palette-extractor": return `${Array.isArray(raw.palette) ? raw.palette.length : 0} colori estratti`;
    case "platform-size-presets": {
      const cover = asRecord(raw.cover);
      return numberField(cover?.width) !== undefined && numberField(cover?.height) !== undefined
        ? `${cover?.width}×${cover?.height} px`
        : "Dimensioni calcolate";
    }
    default: return "Risultato calcolato";
  }
}

function validatorHeadline(toolId: ImageResultToolId, raw: ImageResultValue): string {
  if (toolId === "contrast-checker") return raw.aaNormal === true ? "Conforme AA" : "Non conforme AA";
  if (toolId === "image-compare-slider") {
    return raw.sameDimensions === true && raw.differenceRatio === 0 ? "Nessuna differenza rilevata" : "Differenze rilevate";
  }
  if (toolId === "perceptual-duplicate-finder") {
    const count = Array.isArray(raw.items) ? raw.items.length : 0;
    return count === 0 ? "Nessun duplicato rilevato" : `${count} coppie simili`;
  }
  return "Controllo completato";
}

function useBlobPreviewDataUrl(blob: Blob | undefined): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (blob === undefined) {
      setUrl("");
      return;
    }
    const reader = new FileReader();
    let active = true;
    reader.addEventListener("load", () => {
      if (active && typeof reader.result === "string") setUrl(reader.result);
    });
    reader.readAsDataURL(blob);
    return () => {
      active = false;
      reader.abort();
    };
  }, [blob]);
  return url;
}

function VisualPreview({ output }: { readonly output: VerifiedImageOutput | undefined }) {
  const url = useBlobPreviewDataUrl(output?.artifact.download.ready === true ? output.blob : undefined);
  if (output === undefined) return null;
  if (!output.artifact.download.ready) {
    return <ResultInterpretation state="error">Il file prodotto non supera la verifica indipendente di firma/contenitore e non viene offerto come risultato scaricabile.</ResultInterpretation>;
  }
  if (output.blob.type === "application/pdf") {
    return <ResultInterpretation state="warning">PDF generato da un'immagine raster JPEG. I tracciati e il testo SVG NON sono vettoriali nel PDF: scarica il file dalla sezione risultati.</ResultInterpretation>;
  }
  return (
    <figure data-result-slot="visual-preview" aria-label="Anteprima del file immagine prodotto">
      {url === "" ? <p role="status">Preparazione dell'anteprima locale…</p> : <img src={url} alt={`Anteprima verificata di ${output.artifact.name}`} />}
      {output.width !== undefined && output.height !== undefined ? <figcaption>{output.width}×{output.height}</figcaption> : null}
    </figure>
  );
}

function VisualComparison({
  source,
  output,
  modeLabel,
}: {
  readonly source: File | undefined;
  readonly output: VerifiedImageOutput | undefined;
  readonly modeLabel: string;
}) {
  const sourceUrl = useBlobPreviewDataUrl(source);
  const outputUrl = useBlobPreviewDataUrl(output?.artifact.download.ready === true ? output.blob : undefined);
  if (source === undefined || output === undefined) return null;
  return (
    <div data-result-slot="comparison" aria-label={`Confronto originale e simulazione ${modeLabel}`}>
      <figure>
        {sourceUrl === "" ? <p role="status">Preparazione originale locale…</p> : <img src={sourceUrl} alt="Immagine originale" />}
        <figcaption>Originale</figcaption>
      </figure>
      <figure>
        {!output.artifact.download.ready
          ? <p>Il risultato non ha superato la verifica del file.</p>
          : outputUrl === ""
            ? <p role="status">Preparazione simulazione locale…</p>
            : <img src={outputUrl} alt={`Simulazione ${modeLabel}`} />}
        <figcaption>Simulazione: {modeLabel}</figcaption>
      </figure>
    </div>
  );
}

function downloadVerified(output: VerifiedImageOutput): void {
  if (!output.artifact.download.ready) return;
  const url = URL.createObjectURL(output.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = output.artifact.download.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function workspaceFor(toolId: ImageResultToolId, outputs: readonly VerifiedImageOutput[], sourceFiles: readonly File[]) {
  const fallbackBytes = sourceFiles.reduce((total, file) => total + file.size, 0);
  const fallbackName = sourceFiles.length === 1 ? sourceFiles[0]?.name ?? "Input locale" : `${sourceFiles.length} immagini locali`;
  return createFileResultWorkspace(outputs.map((output, index) => {
    const source = sourceFiles[output.sourceIndex ?? index] ?? sourceFiles[0];
    return createFileResultItem({
      id: `${toolId}-${index + 1}`,
      source: {
        name: source?.name ?? fallbackName,
        byteLength: source?.size ?? fallbackBytes,
        ...(source?.type === undefined || source.type === "" ? {} : { detectedMime: source.type }),
      },
      status: output.artifact.download.ready ? "success" : "error",
      artifact: output.artifact,
      beforeBytes: source?.size ?? fallbackBytes,
      afterBytes: output.artifact.byteLength,
      retryable: true,
      cancellable: false,
      ...output.artifact.download.ready ? {} : { message: output.artifact.verification.message ?? "Verifica del file prodotto non superata." },
    });
  }), { location: "LOCAL", network: "forbidden" });
}

function imageMetrics(output: VerifiedImageOutput | undefined, sourceFiles: readonly File[]): readonly { label: string; value: ComponentChildren }[] {
  if (output === undefined) return [];
  return [
    ...(output.width !== undefined && output.height !== undefined ? [{ label: "Dimensioni risultato", value: `${output.width} × ${output.height} px` }] : []),
    { label: "Formato verificato", value: output.artifact.verification.verifiedMime ?? output.artifact.mime },
    { label: "Dimensione risultato", value: formatBytes(output.artifact.byteLength) },
    ...(sourceFiles.length > 0 ? [{ label: "Dimensione ingresso", value: formatBytes(sourceFiles.reduce((total, file) => total + file.size, 0)) }] : []),
    { label: "Verifica artifact", value: output.artifact.download.ready ? "Firma/contenitore coerenti: download abilitato" : "Verifica non superata: download bloccato" },
  ];
}

function semanticImageRows(toolId: ImageResultToolId, raw: ImageResultValue): readonly { label: string; value: ComponentChildren }[] {
  if (toolId === "image-compression" && (raw.compressionMode === "png-palette-exact" || raw.compressionMode === "png-palette-lossy")) {
    return [
      { label: "Modalità", value: raw.compressionMode === "png-palette-exact" ? "Palette esatta, pixel identici" : "Palette approssimata (perdita RGB dichiarata)" },
      { label: "Trasparenza", value: raw.alphaVerification === "exact" ? "Alpha verificato identico" : "Non verificato" },
      { label: "Colori palette", value: String(numberField(raw.paletteColors) ?? 0) },
      { label: "Errore RGB massimo osservato", value: String(numberField(raw.maxObservedChannelError) ?? 0) },
      { label: "File esportato", value: raw.keptOriginal === true ? "Originale conservato perché non più grande" : "PNG indicizzato, verificato" },
    ];
  }
  if (toolId === "image-compression" && raw.compressionMode === "png-idat-lossless") {
    return [
      { label: "Modalità", value: "PNG IDAT senza perdita, non interlacciato (RGB/RGBA, grigi o palette supportati)" },
      { label: "Pixel", value: raw.pixelVerification === "exact-filtered-scanlines" ? "Byte delle scanline verificati identici" : "Verifica non disponibile" },
      { label: "Output", value: raw.keptOriginal === true ? "Originale verificato conservato (già più piccolo)" : "Flusso IDAT ricompresso e verificato" },
      { label: "Risparmio reale", value: formatBytes(numberField(raw.estimatedBytesSaved) ?? 0) },
    ];
  }
  if (toolId === "image-compression" && Array.isArray(raw.items)) {
    return [
      { label: "File elaborati", value: String(numberField(raw.processedCount) ?? 0) },
      { label: "File riusciti", value: String(raw.items.length) },
      { label: "File con errore", value: String(Array.isArray(raw.failures) ? raw.failures.length : 0) },
      { label: "Byte originali riusciti", value: formatBytes(numberField(raw.successfulOriginalBytes) ?? 0) },
      { label: "Byte risultati", value: formatBytes(numberField(raw.outputBytes) ?? 0) },
      { label: "Risparmio sugli output riusciti", value: `${raw.savedPercent ?? 0}%` },
      { label: "Obiettivi non raggiunti", value: String(numberField(raw.countMissingTarget) ?? 0) },
      { label: "Lavori in parallelo", value: "1 (sequenziale e limitato)" },
    ];
  }
  if (toolId === "image-compression" && raw.targetBytes !== undefined) {
    return [
      { label: "Obiettivo", value: formatBytes(numberField(raw.targetBytes) ?? 0) },
      { label: "Limite rispettato", value: raw.targetMet === true ? "Sì: dimensione effettiva verificata" : "No: restituito il tentativo più piccolo" },
      ...(numberField(raw.targetAttempts) === undefined ? [] : [{ label: "Tentativi", value: String(raw.targetAttempts) }]),
      ...(numberField(raw.chosenQuality) === undefined ? [] : [{ label: "Qualità selezionata", value: String(raw.chosenQuality) }]),
      { label: "Risoluzione ridotta", value: raw.resizedForTarget === true ? "Sì, autorizzata" : "No" },
      ...(raw.targetMet === true ? [] : [{ label: "Motivo del limite", value: raw.targetReason === "png-no-quality-control" ? "Il PNG non espone un controllo di qualità per ridurre i byte." : "Raggiunto il minimo di qualità/dimensioni consentito dalle opzioni scelte." }]),
    ];
  }
  if (toolId === "color-blindness-image-simulation") {
    return [
      ...(stringField(raw.modeLabel) === undefined ? [] : [{ label: "Modalità scelta", value: stringField(raw.modeLabel)! }]),
      ...(stringField(raw.model) === undefined ? [] : [{ label: "Modello", value: stringField(raw.model)! }]),
      ...(stringField(raw.transformSpace) === undefined ? [] : [{ label: "Spazio di trasformazione", value: stringField(raw.transformSpace)! }]),
      ...(stringField(raw.modelDoi) === undefined ? [] : [{ label: "Fonte", value: `DOI ${stringField(raw.modelDoi)!}` }]),
    ];
  }
  if (toolId === "image-crop" && raw.transform !== undefined) {
    const transform = asRecord(raw.transform);
    const crop = asRecord(transform?.crop);
    return [
      ...(numberField(raw.sourceWidth) !== undefined && numberField(raw.sourceHeight) !== undefined
        ? [{ label: "Sorgente", value: `${raw.sourceWidth}×${raw.sourceHeight} px` }]
        : []),
      ...(numberField(crop?.width) !== undefined && numberField(crop?.height) !== undefined
        ? [{ label: "Ritaglio", value: `${crop?.width}×${crop?.height} px @ ${crop?.x ?? 0},${crop?.y ?? 0}` }]
        : []),
      ...(numberField(transform?.rotate) === undefined ? [] : [{ label: "Rotazione", value: `${transform?.rotate}°` }]),
      { label: "Ribaltamento", value: `orizzontale=${transform?.flipHorizontal === true ? "sì" : "no"}, verticale=${transform?.flipVertical === true ? "sì" : "no"}` },
      { label: "Maschera", value: transform?.roundCrop === true ? "round crop ellittico" : "rettangolare" },
      ...(stringField(raw.alphaPolicy) === undefined ? [] : [{ label: "Alpha", value: stringField(raw.alphaPolicy)! }]),
      ...(stringField(raw.backgroundPolicy) === undefined ? [] : [{ label: "Sfondo", value: stringField(raw.backgroundPolicy)! }]),
      ...(stringField(raw.pipelineVersion) === undefined ? [] : [{ label: "Pipeline", value: stringField(raw.pipelineVersion)! }]),
    ];
  }
  if (toolId === "image-crop" && raw.corners !== undefined) {
    const boundary = asRecord(raw.boundary);
    return [
      { label: "Modalità", value: "prospettiva documento · quattro angoli" },
      { label: "Sampling", value: stringField(raw.sampling) ?? "—" },
      { label: "Confine sorgente", value: displayValue(boundary?.polygon ?? raw.corners) },
      { label: "Output", value: `${numberField(raw.width) ?? 0}×${numberField(raw.height) ?? 0}px` },
    ];
  }
  if (toolId === "exif-remover") {
    const groups = asRecord(raw.metadataGroups);
    const fidelity = asRecord(raw.fidelity);
    return [
      { label: "Metadati prima", value: metadataGroupsLabel(groups?.before) },
      { label: "Classi rimosse", value: metadataGroupsLabel(groups?.removed) },
      { label: "Classi trattenute dopo", value: metadataGroupsLabel(groups?.retained) },
      { label: "Reispezione output", value: raw.metadataFree === true ? "completa · nessun metadata privacy-bearing" : "non verificata" },
      { label: "Fedeltà pixel", value: fidelity?.decodedRgbaExact === true ? "RGBA decodificato identico prima/dopo" : "non provata" },
      ...(stringField(fidelity?.limitation) === undefined ? [] : [{ label: "Limite claim", value: stringField(fidelity?.limitation)! }]),
    ];
  }
  if (toolId === "image-format-conversion") {
    const gifSource = asRecord(raw.gifSource);
    return [
      ...(raw.rasterBackedPdf === true ? [{ label: "PDF", value: "Raster JPEG incorporato, non vettoriale" }] : []),
      ...(stringField(raw.inputKind) === undefined ? [] : [{ label: "Formato ingresso rilevato", value: stringField(raw.inputKind)!.toUpperCase() }]),
      ...(stringField(raw.decoder) === undefined ? [] : [{ label: "Decoder", value: stringField(raw.decoder) === "libheif-wasm" ? "libheif/WASM locale (lazy)" : "decoder locale del browser" }]),
      ...(stringField(raw.framePolicy) === undefined ? [] : [{ label: "Frame", value: stringField(raw.framePolicy) === "first-frame-only" ? "solo primo frame" : "immagine singola" }]),
      ...(typeof gifSource?.frameCount === "number"
        ? [{ label: "GIF originale", value: `${gifSource.frameCount} frame · ${typeof gifSource.totalDelayCentiseconds === "number" ? gifSource.totalDelayCentiseconds : "?"} centesimi di secondo dichiarati · animazione non esportata` }]
        : []),
      ...(stringField(raw.alphaPolicy) === undefined ? [] : [{ label: "Alpha", value: stringField(raw.alphaPolicy)! }]),
      ...(stringField(raw.background) === undefined ? [] : [{ label: "Sfondo JPEG", value: stringField(raw.background)! }]),
      { label: "Perdita", value: raw.lossy === true ? "ricodifica lossy" : "pixel RGBA decodificati ricodificati senza perdita" },
      ...(stringField(raw.lossNote) === undefined ? [] : [{ label: "Nota qualità/fedeltà", value: stringField(raw.lossNote)! }]),
      { label: "Verifica output", value: "firma + header/dimensioni + decode locale" },
    ];
  }
  if (toolId !== "image-resize") return [];
  const sourceWidth = numberField(raw.sourceWidth);
  const sourceHeight = numberField(raw.sourceHeight);
  const inputMime = stringField(raw.inputMime);
  const estimatedDecodedBytes = numberField(raw.estimatedDecodedBytes);
  return [
    ...(sourceWidth !== undefined && sourceHeight !== undefined
      ? [{ label: "Ingresso", value: `${sourceWidth}×${sourceHeight}${inputMime === undefined ? "" : ` · ${inputMime}`}` }]
      : []),
    ...(estimatedDecodedBytes === undefined
      ? []
      : [{ label: "Memoria stimata", value: `${formatBytes(estimatedDecodedBytes)} stimati per l'elaborazione decodificata` }]),
    ...(stringField(raw.orientationPolicy) === undefined ? [] : [{ label: "Orientamento", value: stringField(raw.orientationPolicy)! }]),
    ...(stringField(raw.metadataPolicy) === undefined ? [] : [{ label: "Metadati", value: stringField(raw.metadataPolicy)! }]),
  ];
}

export function ImageResultV2({ toolId, result, sourceFiles = [], onReset, onRetry }: ImageResultV2Props) {
  const [actionStatus, setActionStatus] = useState("");
  const declaration = IMAGE_RESULT_DECLARATIONS[toolId];
  const payload = useMemo(() => copyPayload(result.raw), [result.raw]);

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona i dati mostrati e copiali manualmente.");
      return;
    }
    await navigator.clipboard.writeText(payload);
    setActionStatus("Risultato copiato.");
  }

  if (declaration.class === "image") {
    const primary = result.artifacts.length === 1 ? result.artifacts[0] : undefined;
    const actions = resolveResultActions({
      declaration,
      primary: primary?.artifact.download.ready === true ? "download" : null,
      ...(primary === undefined ? {} : { artifact: primary.artifact }),
      retryReady: onRetry !== undefined,
      resetReady: true,
    });
    const workspace = workspaceFor(toolId, result.artifacts, sourceFiles);
    const metrics = [...imageMetrics(primary ?? result.artifacts[0], sourceFiles), ...semanticImageRows(toolId, result.raw), ...detailRows(result.raw)].slice(0, 18);
    const comparisonMode = toolId === "color-blindness-image-simulation"
      ? stringField(result.raw.modeLabel) ?? stringField(result.raw.mode) ?? "modalità selezionata"
      : undefined;
    return (
      <div data-result-class="image">
        {toolId === "image-compression" && Array.isArray(result.raw.items) && (
          <>
            {(Array.isArray(result.raw.failures) && result.raw.failures.length > 0) || numberField(result.raw.countMissingTarget)! > 0
              ? <ResultInterpretation state="warning">Risultato parziale: alcuni file non sono stati elaborati o non hanno raggiunto la dimensione obiettivo. Verifica le singole righe; il ZIP contiene soltanto i risultati prodotti.</ResultInterpretation>
              : null}
            {Array.isArray(result.raw.failures) && result.raw.failures.length > 0 && (
              <div data-batch-failures><strong>File non elaborati</strong>
                <ul>{result.raw.failures.map((failure, index) => {
                  const record = asRecord(failure);
                  return <li key={index}>{stringField(record?.name) ?? "File"}: {stringField(record?.message) ?? "Errore"}</li>;
                })}</ul>
              </div>
            )}
            <div data-image-batch-details><strong>Risparmio per immagine riuscita</strong>
              <ul>{result.raw.items.map((item, index) => {
                const record = asRecord(item);
                const before = numberField(record?.originalBytes);
                const blob = record?.blob;
                const after = blob instanceof Blob ? blob.size : undefined;
                const percent = before !== undefined && before > 0 && after !== undefined
                  ? `${((before - after) * 100 / before).toFixed(1).replace(".", ",")}%`
                  : "Non misurabile";
                return <li key={index}>{stringField(record?.filename) ?? "Risultato"}: {before ?? "?"} → {after ?? "?"} byte ({percent}){record?.targetMet === false ? " · obiettivo non raggiunto" : ""}</li>;
              })}</ul>
            </div>
          </>
        )}
        {toolId === "exif-remover" && result.raw.metadataFree === true
          ? <ResultInterpretation state="success">Verificato sul file prodotto: nessun segmento Exif, XMP, IPTC o commento identificativo.</ResultInterpretation>
          : null}
        {toolId === "color-blindness-image-simulation"
          ? <>
              <ResultInterpretation state="warning">Questa è una simulazione visiva basata su un modello, non una diagnosi medica e non una rappresentazione universale della percezione di ogni persona con una differenza nella visione dei colori.</ResultInterpretation>
              <VisualComparison source={sourceFiles[0]} output={primary ?? result.artifacts[0]} modeLabel={comparisonMode!} />
            </>
          : <VisualPreview output={primary ?? result.artifacts[0]} />}
        <div data-result-slot="media-metrics"><ResultBreakdown label="Dati del file prodotto" rows={metrics} /></div>
        <div data-result-slot="file-workspace">
          {result.zip?.artifact.download.ready === true && <DownloadLink blob={result.zip.blob} filename={result.zip.artifact.download.filename}>Scarica tutte le immagini riuscite (ZIP)</DownloadLink>}
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
        <ResultActions actions={actions} onAction={{
          ...(primary === undefined ? {} : { download: () => downloadVerified(primary) }),
          ...(onRetry === undefined ? {} : { retry: onRetry }),
          reset: onReset,
        }} />
      </div>
    );
  }

  const rows = [...detailRows(result.raw), ...collectionRows(result.raw)].slice(0, 24);
  const actions = resolveResultActions({
    declaration,
    primary: "copy",
    hasCopyPayload: payload !== "",
    retryReady: declaration.class === "validator" && onRetry !== undefined,
    resetReady: true,
  });
  if (declaration.class === "validator") {
    const headline = validatorHeadline(toolId, result.raw);
    return (
      <div data-result-class="validator">
        <ResultExplanation
          primary={<div data-result-slot="primary"><ResultPrimaryAnswer label="Esito">{headline}</ResultPrimaryAnswer></div>}
          interpretation={<div data-result-slot="interpretation"><ResultInterpretation state={headline.startsWith("Non ") || headline.includes("Differenze") ? "warning" : "success"}>Il controllo usa esclusivamente i dati prodotti dall'engine locale corrente.</ResultInterpretation></div>}
          breakdown={<div data-result-slot="checks"><ResultBreakdown label="Controlli e metriche" rows={rows} /></div>}
          provenance={<div data-result-slot="provenance"><ResultProvenance>Elaborazione locale; nessun upload del contenuto.</ResultProvenance></div>}
        />
        <ResultActions actions={actions} onAction={{ copy: copyResult, ...(onRetry === undefined ? {} : { retry: onRetry }), reset: onReset }} />
        {actionStatus !== "" && <p role="status" class="success">{actionStatus}</p>}
      </div>
    );
  }

  return (
    <div data-result-class="calculator">
      <ResultExplanation
        primary={<div data-result-slot="primary"><ResultPrimaryAnswer>{calculatorHeadline(toolId, result.raw)}</ResultPrimaryAnswer></div>}
        interpretation={<div data-result-slot="interpretation"><ResultInterpretation state="success">Risultato calcolato localmente sul contratto corrente dello strumento.</ResultInterpretation></div>}
        breakdown={<div data-result-slot="breakdown"><ResultBreakdown rows={rows} /></div>}
        assumptions={<div data-result-slot="assumptions"><ResultAssumptions items={[{ label: "Esecuzione", value: "Locale nel browser, senza upload del contenuto" }]} /></div>}
        provenance={<div data-result-slot="provenance"><ResultProvenance>Output dell'engine image/image-visual corrente; nessuna nuova semantica codec introdotta dalla UI.</ResultProvenance></div>}
      />
      <ResultActions actions={actions} onAction={{ copy: copyResult, reset: onReset }} />
      {actionStatus !== "" && <p role="status" class="success">{actionStatus}</p>}
    </div>
  );
}
