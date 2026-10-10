import { useEffect, useRef, useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";
import { friendlyToolErrorIt } from "../../../i18n/it/errors";
import type { PdfResultToolId } from "../../../tools/pdf-result-declarations";
import { CONTROL, it, ToolResultPanel } from "../shared";
import { PdfResultV2, preparePdfResult, type PreparedPdfResult } from "./PdfResultV2";
import { PdfThumbnailPicker } from "./PdfThumbnailPicker";
import { PdfVisualOrder } from "./PdfVisualOrder";
import { PdfMergeOrganizer } from "./PdfMergeOrganizer";
import { parsePdfPageGroups, parsePdfPageSelection } from "../../../engines/pdf/page-selection";
import type { PdfMergePageRef } from "../../../engines/pdf/merge-page-plan";
import type { PdfCompareResult } from "../../../engines/pdf";
import { PdfVisualCompare } from "./PdfVisualCompare";
import { PdfFormAuditDetails } from "./PdfFormAuditDetails";
import type { PdfFormAnnotationAudit, PdfFlattenVerification } from "../../../engines/pdf";

export type PdfToolId = PdfResultToolId;

type InputMode = "single" | "multi" | "pair";
type OptionMode = "none" | "pages" | "groups" | "order" | "rotation" | "delete-extract" | "password" | "text-extraction" | "image-extraction" | "multi-search" | "pdf-to-markdown" | "images-to-pdf" | "pdf-to-images";

export interface PdfToolProps {
  readonly toolId: PdfToolId;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly inputMode?: InputMode;
  readonly optionMode?: OptionMode;
  readonly accept?: string;
}

const PDF_ACTION_IT: Readonly<Record<PdfToolId, string>> = {
  "pdf-merge": "Unisci PDF",
  "pdf-split": "Dividi PDF",
  "pdf-page-reorder": "Riordina pagine",
  "pdf-rotate": "Ruota pagine",
  "pdf-page-delete-extract": "Applica operazione alle pagine",
  "images-to-pdf": "Crea PDF",
  "pdf-to-images": "Converti PDF in immagini",
  "pdf-text-extraction": "Estrai testo",
  "pdf-metadata-inspector": "Analizza PDF",
  "pdf-metadata-remover": "Rimuovi metadati",
  "pdf-page-size-inspector": "Analizza dimensioni pagine",
  "pdf-page-count-verifier": "Verifica numero pagine",
  "pdf-password-check-remove": "Controlla cifratura",
  "pdf-flatten": "Appiattisci PDF",
  "pdf-form-inspector": "Analizza moduli",
  "pdf-link-extractor": "Estrai collegamenti",
  "pdf-image-extractor": "Estrai immagini",
  "pdf-compare-lite": "Confronta PDF",
  "pdf-compression-lite": "Crea copia alleggerita",
  "document-handoff-manifest": "Crea manifest",
  "pdf-multi-text-search": "Cerca nei PDF",
  "pdf-to-markdown": "Esporta Markdown",
};

function parseNumbers(value: string): number[] {
  return value.split(/[\s,;]+/u).filter(Boolean).map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function parseIndexedRotations(value: string): Record<number, 0 | 90 | 180 | 270> {
  const result: Record<number, 0 | 90 | 180 | 270> = {};
  if (value.trim() === "") return result;
  for (const token of value.split(/[;,]+/u).map((part) => part.trim()).filter(Boolean)) {
    const match = /^(\d+)\s*:\s*(0|90|180|270)$/u.exec(token);
    if (match === null) throw new Error("Usa rotazioni come 1:90, 3:270.");
    result[Number(match[1])] = Number(match[2]) as 0 | 90 | 180 | 270;
  }
  return result;
}

export function PdfTool({ toolId, title: _title, description: _description, actionLabel: _actionLabel, inputMode = "single", optionMode = "none", accept = "application/pdf,.pdf" }: PdfToolProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [mergePagePlan, setMergePagePlan] = useState<readonly PdfMergePageRef[] | null>(null);
  const [pages, setPages] = useState("");
  const [order, setOrder] = useState("");
  const [orderHistory, setOrderHistory] = useState<string[]>([]);
  const [groups, setGroups] = useState("");
  const [pdfSplitMode, setPdfSplitMode] = useState<"manual" | "size-limit">("manual");
  const [pdfSplitMaxKiB, setPdfSplitMaxKiB] = useState("1024");
  const [rotation, setRotation] = useState("90");
  const [deleteMode, setDeleteMode] = useState<"delete" | "extract">("extract");
  const [passwordMode, setPasswordMode] = useState<"check" | "remove">("check");
  const [textExtractionMode, setTextExtractionMode] = useState<"content-order" | "operator-lines">("content-order");
  const [imageDedupe, setImageDedupe] = useState(true);
  const [query, setQuery] = useState("");
  const [contextCharacters, setContextCharacters] = useState("120");
  const [maxResults, setMaxResults] = useState("100");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [imageBackground, setImageBackground] = useState("#ffffff");
  const [imageQuality, setImageQuality] = useState("0.92");
  const [pdfImageMime, setPdfImageMime] = useState<"image/jpeg" | "image/png" | "image/webp">("image/png");
  const [pdfImageScale, setPdfImageScale] = useState("2");
  const [compressionProfile, setCompressionProfile] = useState<"structural-only" | "jpeg-rgb-reencode" | "scan-flate-to-jpeg" | "target-best-effort">("structural-only");
  const [compressionJpegQuality, setCompressionJpegQuality] = useState("0.6");
  const [compressionPreset, setCompressionPreset] = useState<"high-quality" | "balanced" | "strong" | "custom">("balanced");
  const [pdfTargetKiB, setPdfTargetKiB] = useState("300");
  const [pdfTargetUnit, setPdfTargetUnit] = useState<"KiB" | "MiB">("KiB");
  const [scanMaxEdge, setScanMaxEdge] = useState("1600");
  const [scanResizePolicy, setScanResizePolicy] = useState<"pixel-edge" | "verified-dpi">("pixel-edge");
  const [scanTargetDpi, setScanTargetDpi] = useState("150");
  const [scanGrayscale, setScanGrayscale] = useState(false);
  const [imageRotations, setImageRotations] = useState("");
  const [pdfPageSize, setPdfPageSize] = useState<"original" | "a4" | "letter">("original");
  const [pdfPageOrientation, setPdfPageOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const [pdfImageFit, setPdfImageFit] = useState<"contain" | "cover">("contain");
  const [pdfMarginMm, setPdfMarginMm] = useState("0");
  const [pdfCompositionMode, setPdfCompositionMode] = useState<"pages" | "contact-sheet">("pages");
  const [contactSheetColumns, setContactSheetColumns] = useState("3");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showVisualCompare, setShowVisualCompare] = useState(false);
  const [selectionPageCount, setSelectionPageCount] = useState(0);
  const [activeSelectionGroup, setActiveSelectionGroup] = useState(0);
  const [result, setResult] = useState<PreparedPdfResult | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => {
    controller.current?.abort();
  }, []);

  useEffect(() => {
    if (optionMode !== "images-to-pdf" || files[0] === undefined) {
      setImagePreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(files[0]);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [files, optionMode]);

  function choose(event: Event, index = 0) {
    const input = event.currentTarget as HTMLInputElement;
    const selected = input.files === null ? [] : [...input.files];
    if (inputMode === "multi" || toolId === "pdf-compression-lite" && compressionProfile === "target-best-effort") {
      setFiles(selected);
    } else {
      setFiles((current) => {
        const next = [...current];
        const first = selected[0];
        if (first !== undefined) next[index] = first;
        return next.filter((item): item is File => item !== undefined);
      });
    }
    setResult(null);
    setShowVisualCompare(false);
    setMergePagePlan(null);
    setOrderHistory([]);
    setShowThumbnails(false);
    setSelectionPageCount(0);
    setActiveSelectionGroup(0);
    if (optionMode === "groups") setGroups("");
    if (optionMode === "delete-extract") setPages("");
    setError("");
    setStatus("idle");
  }

  function buildInput(): unknown {
    if (inputMode === "pair") return { first: files[0], second: files[1] };
    if (inputMode === "multi" && optionMode === "images-to-pdf") {
      return {
        files,
        background: imageBackground,
        quality: Number(imageQuality),
        ...(order.trim() === "" ? {} : { order: parseNumbers(order) }),
        rotations: parseIndexedRotations(imageRotations),
        pageSize: pdfPageSize,
        orientation: pdfPageOrientation,
        fit: pdfImageFit,
        marginMm: Number(pdfMarginMm),
        compositionMode: pdfCompositionMode,
        contactSheetColumns: Number(contactSheetColumns),
      };
    }
    if (inputMode === "multi" && optionMode === "multi-search") {
      return {
        files,
        query,
        contextCharacters: Number(contextCharacters),
        maxResults: Number(maxResults),
        caseSensitive,
      };
    }
    if (inputMode === "multi") return { files, ...(toolId === "pdf-merge" && mergePagePlan !== null ? { pagePlan: mergePagePlan } : {}) };
    if (optionMode === "pages") return { file: files[0], pages: parseNumbers(pages), ...(toolId === "pdf-page-delete-extract" ? { mode: deleteMode } : {}) };
    if (optionMode === "groups") return toolId === "pdf-split" && pdfSplitMode === "size-limit"
      ? { file: files[0], maxPartKiB: Number(pdfSplitMaxKiB) }
      : { file: files[0], groups };
    if (optionMode === "order") return { file: files[0], order: parseNumbers(order) };
    if (optionMode === "rotation") return { file: files[0], pages, rotation: Number(rotation) };
    if (optionMode === "delete-extract") return { file: files[0], pages, mode: deleteMode };
    if (optionMode === "password") return { file: files[0], mode: passwordMode };
    if (optionMode === "text-extraction") return { file: files[0], ...(pages.trim() === "" ? {} : { pages: parseNumbers(pages) }), mode: textExtractionMode };
    if (optionMode === "image-extraction") return { file: files[0], ...(pages.trim() === "" ? {} : { pages: parseNumbers(pages) }), dedupe: imageDedupe };
    if (optionMode === "pdf-to-markdown") return { file: files[0] };
    if (optionMode === "pdf-to-images") return {
      file: files[0],
      ...(pages.trim() === "" ? {} : { pages: pages.trim() }),
      mime: pdfImageMime,
      scale: Number(pdfImageScale),
      quality: Number(imageQuality),
      background: imageBackground,
    };
    return { file: files[0] };
  }

  async function execute() {
    setError("");
    setResult(null);
    setShowVisualCompare(false);
    if (inputMode === "pair" && files.length < 2) {
      setError("Scegli due file PDF locali.");
      return;
    }
    if (inputMode !== "pair" && files.length === 0) {
      setError("Scegli prima un file locale.");
      return;
    }
    const abortController = new AbortController();
    controller.current = abortController;
    setStatus("working");
    try {
      if (toolId === "pdf-compression-lite" && compressionProfile === "target-best-effort") {
        const { runPdfTargetBatch219 } = await import("../../../engines/pdf/target-batch-219");
        const targetBytes = Math.round(Number(pdfTargetKiB) * (pdfTargetUnit === "MiB" ? 1024 * 1024 : 1024));
        const batch = await runPdfTargetBatch219(files, targetBytes, abortController.signal);
        const prepared = await preparePdfResult(toolId, {
          artifacts: batch.artifacts, artifactCount: batch.artifacts.length,
          profile: "target-best-effort", targetBytes: batch.targetBytes,
          attemptedFiles: batch.attemptedFiles, metTargetFiles: batch.metTargetFiles,
          notMetFiles: batch.notMetFiles, refusedFiles: batch.refusedFiles,
          allMet: batch.allMet, zipIncludes: batch.zipIncludes,
          reports: batch.reports.map(({ artifact: _artifact, ...report }) => report), note: batch.note,
          policy: "Il tetto è riuscito solo se il PDF finale verifica <= i byte richiesti. JPEG/Flate con perdita e limiti espliciti; ZIP con soli file sotto tetto, gli altri disponibili individualmente.",
        });
        if (abortController.signal.aborted) throw new DOMException("Operation cancelled", "AbortError");
        setResult(prepared);
        setStatus("done");
        return;
      }
      if (toolId === "pdf-compression-lite" && compressionProfile === "jpeg-rgb-reencode") {
        const { recompressPdfEmbeddedJpegs } = await import("../../../engines/pdf/jpeg-image-aware");
        const source = files[0];
        if (source === undefined) throw new Error("INVALID_INPUT: Scegli un PDF da ottimizzare.");
        const optimized = await recompressPdfEmbeddedJpegs(new Uint8Array(await source.arrayBuffer()),
          { quality: Number(compressionJpegQuality) }, abortController.signal);
        const prepared = await preparePdfResult(toolId, {
          artifacts: [optimized.artifact], artifactCount: 1,
          policy: "Ricodifica con perdita dei soli JPEG RGB 8 bit incorporati e verificabili. Testo e vettori conservati nei controlli locali; resa visiva non identica pixel per pixel.",
          analysis: optimized.analysis,
        });
        if (abortController.signal.aborted) throw new DOMException("Operation cancelled", "AbortError");
        setResult(prepared);
        setStatus("done");
        return;
      }
      if (toolId === "pdf-compression-lite" && compressionProfile === "scan-flate-to-jpeg") {
        const { recompressPdfScannedImages } = await import("../../../engines/pdf/scan-image-aware");
        const source = files[0];
        if (source === undefined) throw new Error("INVALID_INPUT: Scegli un PDF da ottimizzare.");
        const optimized = await recompressPdfScannedImages(new Uint8Array(await source.arrayBuffer()), {
          quality: Number(compressionJpegQuality),
          ...(scanResizePolicy === "verified-dpi" ? { targetDpi: Number(scanTargetDpi) } : { maxLongestEdgePx: Number(scanMaxEdge) }),
          grayscale: scanGrayscale,
        }, abortController.signal);
        const prepared = await preparePdfResult(toolId, {
          artifacts: [optimized.artifact], artifactCount: 1,
          policy: "Ricodifica locale con perdita dei raster Flate 8 bit RGB/grigi idonei. Testo/vettori e flussi pagina verificati; JPEG originali e raster non supportati restano invariati.",
          analysis: optimized.analysis, warnings: optimized.analysis.warnings,
        });
        if (abortController.signal.aborted) throw new DOMException("Operation cancelled", "AbortError");
        setResult(prepared);
        setStatus("done");
        return;
      }
      const run = await toolRuntime.run(toolId, buildInput(), {}, abortController.signal);
      if (!run.ok) {
        if (run.code === "CANCELLED") throw new DOMException(run.message, "AbortError");
        throw new Error(run.message);
      }
      const prepared = await preparePdfResult(toolId, run.value);
      if (abortController.signal.aborted) throw new DOMException("Operation cancelled", "AbortError");
      setResult(prepared);
      setStatus("done");
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === "AbortError"
        ? "Operazione annullata. Non è stato prodotto alcun risultato."
        : friendlyToolErrorIt(caught));
      setStatus("idle");
    } finally {
      if (controller.current === abortController) controller.current = null;
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    await execute();
  }

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setFiles([]);
    setMergePagePlan(null);
    setPages("");
    setOrder("");
    setOrderHistory([]);
    setGroups("");
    setRotation("90");
    setDeleteMode("extract");
    setPasswordMode("check");
    setTextExtractionMode("content-order");
    setImageDedupe(true);
    setQuery("");
    setContextCharacters("120");
    setMaxResults("100");
    setCaseSensitive(false);
    setImageBackground("#ffffff");
    setImageQuality("0.92");
    setPdfImageMime("image/png");
    setPdfImageScale("2");
    setCompressionProfile("structural-only");
    setCompressionJpegQuality("0.6");
    setCompressionPreset("balanced");
    setScanMaxEdge("1600");
    setScanTargetDpi("150");
    setScanResizePolicy("pixel-edge");
    setScanGrayscale(false);
    setImageRotations("");
    setShowThumbnails(false);
    setShowVisualCompare(false);
    setSelectionPageCount(0);
    setActiveSelectionGroup(0);
    setPdfPageSize("original");
    setPdfPageOrientation("auto");
    setPdfImageFit("contain");
    setPdfMarginMm("0");
    setPdfCompositionMode("pages");
    setContactSheetColumns("3");
    setResult(null);
    setError("");
    setStatus("idle");
  }

  const isWorking = status === "working";
  function updateVisualOrder(next: readonly number[]) {
    setOrderHistory((history) => [...history, order].slice(-20));
    setOrder(next.join(", "));
    setResult(null);
  }
  function undoVisualOrder() {
    const last = orderHistory.at(-1);
    if (last === undefined) return;
    setOrder(last);
    setOrderHistory((history) => history.slice(0, -1));
    setResult(null);
  }
  const isPageSelector = optionMode === "delete-extract" || optionMode === "groups" && !(toolId === "pdf-split" && pdfSplitMode === "size-limit");
  let selectionGroups: number[][] = [];
  let selectionError = "";
  if (isPageSelector && selectionPageCount > 0) {
    try {
      selectionGroups = (optionMode === "groups" ? groups : pages).trim() === ""
        ? []
        : optionMode === "groups"
          ? parsePdfPageGroups(groups, selectionPageCount)
          : [parsePdfPageSelection(pages, selectionPageCount)];
    } catch (caught) {
      selectionError = caught instanceof Error ? caught.message : "Selezione pagine non valida";
    }
  }
  const visibleSelectedPages = [...new Set(selectionGroups.flat())];
  let rotationPages: number[] = [];
  let rotationError = "";
  if (optionMode === "rotation" && selectionPageCount > 0 && pages.trim() !== "") {
    try {
      rotationPages = parsePdfPageSelection(pages, selectionPageCount);
    } catch (caught) {
      rotationError = caught instanceof Error ? caught.message : "Selezione pagine non valida";
    }
  } else if (optionMode === "rotation") {
    rotationPages = parseNumbers(pages);
  }
  function chooseVisualSelection(page: number) {
    if (selectionError !== "") return;
    const chosen = selectionGroups.length > 0 ? selectionGroups.map((group) => [...group]) : [[]];
    const groupIndex = Math.max(0, Math.min(activeSelectionGroup, chosen.length - 1));
    const current = chosen[groupIndex]!;
    const position = current.indexOf(page);
    if (position >= 0) current.splice(position, 1);
    else current.push(page);
    current.sort((a, b) => a - b);
    if (optionMode === "groups") {
      // Preserve all other groups while editing just the selected group.
      setGroups(chosen.filter((group) => group.length > 0).map((group) => group.join(", ")).join("; "));
      setActiveSelectionGroup(Math.max(0, Math.min(groupIndex, chosen.filter((group) => group.length > 0).length - 1)));
    } else {
      setPages(current.join(", "));
    }
    setResult(null);
  }
  const gutterState = isWorking
    ? "running"
    : result !== null
      ? "success"
      : error.startsWith("Operazione annullata")
        ? "cancelled"
        : error !== ""
          ? "error"
          : "idle";
  const publicCopy = TOOL_COPY_IT[toolId];
  const publicTitle = publicCopy?.name ?? toolId;
  const publicDescription = publicCopy?.summary ?? "";
  const actionLabel = PDF_ACTION_IT[toolId];
  const comparison = result !== null && toolId === "pdf-compare-lite" && result.raw.comparison !== null
    && typeof result.raw.comparison === "object" && "alignment" in result.raw.comparison
    ? result.raw.comparison as unknown as PdfCompareResult : null;
  const formsAudit = toolId === "pdf-form-inspector" && result !== null && result.raw.audit
    ? result.raw.audit as unknown as PdfFormAnnotationAudit : undefined;
  const flattenVerification = toolId === "pdf-flatten" && result !== null && result.raw.verification
    ? result.raw.verification as unknown as PdfFlattenVerification : undefined;
  return (
    <form class="tool-operation" onSubmit={submit} noValidate>
      <section class="tool-form-card">
        <p class="file-note">{publicDescription}</p>
        {inputMode === "pair" ? (
          <div class="field-grid">
            <label class="field"><span>Primo PDF</span><input type="file" accept={accept} onChange={(event) => choose(event, 0)} disabled={isWorking} /></label>
            <label class="field"><span>Secondo PDF</span><input type="file" accept={accept} onChange={(event) => choose(event, 1)} disabled={isWorking} /></label>
          </div>
        ) : (
          <label class="field">
            <span>{inputMode === "multi" ? "File" : publicTitle}</span>
            <input type="file" accept={accept} multiple={inputMode === "multi" || toolId === "pdf-compression-lite" && compressionProfile === "target-best-effort"}
              onChange={(event) => choose(event)} disabled={isWorking} />
            <small>Elaborazione su questo dispositivo, senza caricamenti né elaborazione remota alternativa.</small>
          </label>
        )}
        {files.length > 0 && <p class="file-note" role="status">{files.map((file) => `${file.name} · ${(file.size / 1024).toFixed(1)} KiB`).join(" · ")}</p>}
        {toolId === "pdf-merge" && files.length > 0 && (
          <PdfMergeOrganizer files={files} onChange={(reordered) => { setFiles(reordered); setResult(null); }}
            pagePlan={mergePagePlan} onPlanChange={(plan) => { setMergePagePlan(plan); setResult(null); }}
            disabled={isWorking} />
        )}
        {optionMode === "pages" && <label class="field"><span>Pagine</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="1, 3, 5" disabled={isWorking} /></label>}
        {optionMode === "groups" && toolId === "pdf-split" && <label class="field"><span>Metodo divisione PDF</span>
          <select value={pdfSplitMode} onChange={(event) => { setPdfSplitMode(event.currentTarget.value as "manual" | "size-limit"); setResult(null); }} disabled={isWorking}>
            <option value="manual">Gruppi di pagine manuali</option>
            <option value="size-limit">Massimo byte per parte (misura reale)</option>
          </select>
        </label>}
        {optionMode === "groups" && pdfSplitMode === "size-limit" && toolId === "pdf-split" ? (
          <label class="field"><span>Dimensione massima di ciascun PDF (KiB)</span>
            <input type="number" min="1" max="20480" step="1" value={pdfSplitMaxKiB}
              onInput={(event) => { setPdfSplitMaxKiB(event.currentTarget.value); setResult(null); }} disabled={isWorking} />
            <small>Ogni PDF viene ricostruito e misurato sui byte effettivi. Se persino una pagina supera il limite, l'operazione viene rifiutata indicando pagina e dimensione minima rilevata: non vengono omesse pagine per rispettare il limite.</small>
          </label>
        ) : optionMode === "groups" ? (
          <label class="field"><span>Gruppi di pagine</span><input value={groups} onInput={(event) => { setGroups(event.currentTarget.value); setResult(null); }} placeholder="1-2; 3-4" disabled={isWorking} /></label>
        ) : null}
        {optionMode === "order" && <label class="field"><span>Nuovo ordine delle pagine</span><input value={order} onInput={(event) => { setOrder(event.currentTarget.value); setOrderHistory([]); }} placeholder="3, 1, 2" disabled={isWorking} /></label>}
        {optionMode === "rotation" && <div class="field-grid"><label class="field"><span>Pagine</span><input value={pages} onInput={(event) => { setPages(event.currentTarget.value); setResult(null); }} placeholder="1-3, 5" disabled={isWorking} /></label><label class="field"><span>Rotazione</span><select value={rotation} onChange={(event) => { setRotation(event.currentTarget.value); setResult(null); }} disabled={isWorking}><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label></div>}
        {optionMode === "rotation" && files[0] !== undefined && (
          <div class="actions" data-pdf-rotation-helpers>
            <button type="button" disabled={isWorking} onClick={() => { setPages("tutte"); setResult(null); }}>Seleziona tutte le pagine</button>
            <button type="button" disabled={isWorking || selectionPageCount < 1} onClick={() => {
              const selected = new Set(rotationPages);
              const inverse = Array.from({ length: selectionPageCount }, (_, index) => index + 1).filter((page) => !selected.has(page));
              setPages(inverse.join(", ")); setResult(null);
            }}>Inverti pagine da ruotare</button>
            {rotationError !== "" && <p role="alert">{rotationError}</p>}
          </div>
        )}
        {optionMode === "delete-extract" && <div class="field-grid"><label class="field"><span>Pagine</span><input value={pages} onInput={(event) => { setPages(event.currentTarget.value); setResult(null); }} placeholder="1, 3" disabled={isWorking} /></label><label class="field"><span>Operazione</span><select value={deleteMode} onChange={(event) => { setDeleteMode(event.currentTarget.value as "delete" | "extract"); setResult(null); }} disabled={isWorking}><option value="extract">Estrai le pagine selezionate</option><option value="delete">Elimina le pagine selezionate</option></select></label></div>}
        {isPageSelector && files[0] !== undefined && (
          <section class="field" aria-label="Selettore pagine PDF" data-pdf-page-selection>
            <div class="actions">
              <button type="button" disabled={isWorking || (optionMode === "delete-extract" && deleteMode === "delete")} onClick={() => {
                if (optionMode === "groups") setGroups("tutte"); else setPages("tutte");
                setResult(null);
              }}>Tutte le pagine</button>
              <button type="button" disabled={isWorking} onClick={() => {
                if (optionMode === "groups") setGroups("blocchi:2"); else setPages("ogni:2");
                setResult(null);
              }}>
                {optionMode === "groups" ? "Blocchi da 2 pagine" : "Ogni 2ª pagina"}
              </button>
              {optionMode === "delete-extract" && selectionPageCount > 0 && (
                <button type="button" disabled={isWorking || visibleSelectedPages.length === selectionPageCount} onClick={() => {
                  const selected = new Set(visibleSelectedPages);
                  setPages(Array.from({ length: selectionPageCount }, (_, index) => index + 1).filter((page) => !selected.has(page)).join(", "));
                  setResult(null);
                }}>Inverti selezione</button>
              )}
              <button type="button" disabled={isWorking} onClick={() => setShowThumbnails((previous) => !previous)}>
                {showThumbnails ? "Chiudi selezione miniature" : "Seleziona con miniature (facoltativo)"}
              </button>
            </div>
            <small>{optionMode === "groups" ? 'Un gruppo per PDF, separato da punto e virgola: "1-2; 3-5", "blocchi:2" o "tutte".' : 'Seleziona "1-3, 5", "ogni:2" (pagine 2,4,6…) o "tutte".'}</small>
            {selectionError !== "" && <p role="alert" data-pdf-selection-error>{selectionError}</p>}
            {selectionPageCount > 0 && selectionError === "" && selectionGroups.length > 0 && (
              <div data-pdf-selection-preview aria-live="polite">
                <p class="file-note">{selectionPageCount} pagine originali · {visibleSelectedPages.length} pagine selezionate</p>
                {optionMode === "groups" && (
                  <>
                    <p class="file-note">{selectionGroups.length} PDF previsti · suffissi: {selectionGroups.slice(0, 8).map((_, index) => `-part-${String(index + 1).padStart(2, "0")}.pdf`).join(", ")}{selectionGroups.length > 8 ? "…" : ""}{selectionGroups.length > 1 ? " · ZIP pdf-divisi.zip con tutte le parti" : ""}</p>
                    <label class="field"><span>Gruppo da modificare nelle miniature</span>
                      <select aria-label="Gruppo da modificare" value={Math.min(activeSelectionGroup, selectionGroups.length - 1)}
                        onChange={(event) => setActiveSelectionGroup(Number(event.currentTarget.value))} disabled={isWorking}>
                        {selectionGroups.map((group, index) => <option key={index} value={index}>Parte {index + 1} — {group.join(", ")}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {optionMode === "delete-extract" && <p class="file-note">{deleteMode === "delete" ? selectionPageCount - visibleSelectedPages.length : visibleSelectedPages.length} pagine nel risultato PDF.</p>}
              </div>
            )}
            {showThumbnails && (
              <PdfThumbnailPicker file={files[0]} selectedPages={visibleSelectedPages}
                onPageCount={(count) => setSelectionPageCount(count)}
                {...(selectionError !== "" || isWorking ? {} : { onPickPage: chooseVisualSelection })}
              />
            )}
          </section>
        )}
        {optionMode === "password" && <label class="field"><span>Modalità</span><select value={passwordMode} onChange={(event) => setPasswordMode(event.currentTarget.value as "check" | "remove")} disabled={isWorking}><option value="check">Controlla soltanto la cifratura</option><option value="remove">Crea una copia sicura se il PDF non è cifrato</option></select></label>}
        {(optionMode === "order" || optionMode === "rotation") && files[0] !== undefined && (
          <div class="field" data-pdf-preview-toggle>
            <button type="button" onClick={() => setShowThumbnails((current) => !current)} disabled={isWorking}>{showThumbnails ? "Chiudi miniature pagine" : "Apri miniature pagine (facoltativo)"}</button>
            {showThumbnails && (
              <PdfThumbnailPicker
                file={files[0]}
                selectedPages={optionMode === "order" ? parseNumbers(order) : rotationPages}
                previewRotation={optionMode === "rotation" ? Number(rotation) as 0 | 90 | 180 | 270 : 0}
                {...(optionMode === "rotation" ? { onPageCount: (count: number) => setSelectionPageCount(count) } : {})}
                onPickPage={(page) => {
                  if (optionMode === "order") {
                    const chosen = parseNumbers(order);
                    updateVisualOrder(chosen.includes(page) ? chosen.filter((value) => value !== page) : [...chosen, page]);
                  } else {
                    const next = rotationPages.includes(page) ? rotationPages.filter((value) => value !== page) : [...rotationPages, page].sort((a, b) => a - b);
                    setPages(next.join(", "));
                  }
                  setResult(null);
                }}
              />
            )}
            {optionMode === "order" ? <small>Seleziona ogni pagina una sola volta nell'ordine desiderato. Il motore rifiuta sequenze incomplete.</small> : <small>Le pagine selezionate mostrano la rotazione scelta; clicca di nuovo per deselezionarle.</small>}
          </div>
        )}
        {optionMode === "order" && !isWorking && parseNumbers(order).length > 0 && (
          new Set(parseNumbers(order)).size !== parseNumbers(order).length
            ? <p role="alert">L'ordine contiene numeri di pagina duplicati. Correggili prima di utilizzare l'organizzatore visuale.</p>
            : <PdfVisualOrder order={parseNumbers(order)} onChange={updateVisualOrder} undo={undoVisualOrder} canUndo={orderHistory.length > 0} />
        )}
        {optionMode === "text-extraction" && (
          <div class="field-grid">
            <label class="field"><span>Pagine (facoltativo)</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="es. 1, 3, 5 · vuoto = tutte" disabled={isWorking} /></label>
            <label class="field"><span>Modalità testo</span><select value={textExtractionMode} onChange={(event) => setTextExtractionMode(event.currentTarget.value as "content-order" | "operator-lines")} disabled={isWorking}><option value="content-order">Ordine degli operatori, testo compatto</option><option value="operator-lines">Ordine degli operatori, una stringa per riga</option></select><small>Non viene inventato un ordine visuale: entrambe le modalità seguono l'ordine dei contenuti PDF supportati.</small></label>
          </div>
        )}
        {optionMode === "image-extraction" && (
          <div class="field-grid">
            <label class="field"><span>Pagine (facoltativo)</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="es. 2, 4 · vuoto = tutte" disabled={isWorking} /></label>
            <label class="field"><span>Duplicati</span><select value={imageDedupe ? "dedupe" : "occurrences"} onChange={(event) => setImageDedupe(event.currentTarget.value === "dedupe")} disabled={isWorking}><option value="dedupe">Un file per oggetto, conserva tutte le occorrenze</option><option value="occurrences">Un file per ogni occorrenza pagina/risorsa</option></select><small>Si esportano solo byte JPEG originali con singolo filtro DCTDecode; filtri non supportati vengono elencati.</small></label>
          </div>
        )}
        {optionMode === "images-to-pdf" && (
          <>
            <div class="field-grid">
              <label class="field"><span>Composizione</span><select value={pdfCompositionMode} onChange={(event) => setPdfCompositionMode(event.currentTarget.value as "pages" | "contact-sheet")} disabled={isWorking}><option value="pages">Una immagine per pagina</option><option value="contact-sheet">Contact sheet su una pagina</option></select></label>
              <label class="field"><span>Colonne contact sheet</span><input type="number" min="1" max="8" step="1" value={contactSheetColumns} onInput={(event) => setContactSheetColumns(event.currentTarget.value)} disabled={isWorking || pdfCompositionMode !== "contact-sheet"} /></label>
            </div>
            <div class="field-grid">
              <label class="field"><span>Ordine immagini (facoltativo)</span><input value={order} onInput={(event) => setOrder(event.currentTarget.value)} placeholder="es. 3, 1, 2 · vuoto = selezione" disabled={isWorking} /><small>Se compilato, deve contenere ogni immagine una volta.</small></label>
              <label class="field"><span>Rotazioni per immagine</span><input value={imageRotations} onInput={(event) => setImageRotations(event.currentTarget.value)} placeholder="es. 1:90, 3:270" disabled={isWorking} /><small>Indici dopo il riordino; valori ammessi 0/90/180/270°.</small></label>
            </div>
            <div class="field-grid">
              <label class="field"><span>Formato pagina</span><select value={pdfPageSize} onChange={(event) => setPdfPageSize(event.currentTarget.value as "original" | "a4" | "letter")} disabled={isWorking}><option value="original">Dimensione immagine</option><option value="a4">A4</option><option value="letter">Letter</option></select></label>
              <label class="field"><span>Orientamento</span><select value={pdfPageOrientation} onChange={(event) => setPdfPageOrientation(event.currentTarget.value as "auto" | "portrait" | "landscape")} disabled={isWorking}><option value="auto">Automatico</option><option value="portrait">Verticale</option><option value="landscape">Orizzontale</option></select></label>
            </div>
            <div class="field-grid">
              <label class="field"><span>Adattamento</span><select value={pdfImageFit} onChange={(event) => setPdfImageFit(event.currentTarget.value as "contain" | "cover")} disabled={isWorking}><option value="contain">Contieni (nessun taglio)</option><option value="cover">Riempi (ritaglio ai bordi)</option></select></label>
              <label class="field"><span>Margine (mm)</span><input type="number" min="0" max="100" step="1" value={pdfMarginMm} onInput={(event) => setPdfMarginMm(event.currentTarget.value)} disabled={isWorking} /></label>
            </div>
            <div class="field-grid">
              <label class="field"><span>Sfondo per trasparenza</span><input type="color" value={imageBackground} onInput={(event) => setImageBackground(event.currentTarget.value)} disabled={isWorking} /><small>PNG/WebP/HEIC con alpha vengono appiattiti su questo colore prima dell'incorporamento nel PDF.</small></label>
              <label class="field"><span>Qualità ricodifica</span><input type="number" min="0.1" max="1" step="0.01" value={imageQuality} onInput={(event) => setImageQuality(event.currentTarget.value)} disabled={isWorking} /><small>I JPEG originali vengono incorporati senza ricodifica; questa qualità vale solo per gli altri formati.</small></label>
            </div>
            {imagePreviewUrl !== "" && (
              <section class="field" data-images-pdf-preview aria-label="Anteprima adattamento immagine nel PDF">
                <span>Anteprima pagina</span>
                <div
                  style={{
                    width: "min(100%, 340px)",
                    aspectRatio: pdfPageSize === "a4"
                      ? pdfPageOrientation === "landscape" ? "297 / 210" : "210 / 297"
                      : pdfPageSize === "letter"
                        ? pdfPageOrientation === "landscape" ? "11 / 8.5" : "8.5 / 11"
                        : "1 / 1",
                    padding: `${Math.min(28, Math.max(0, Number(pdfMarginMm) || 0))}px`,
                    border: "1px solid var(--border)",
                    background: imageBackground,
                    overflow: "hidden",
                  }}
                >
                  <img src={imagePreviewUrl} alt="Prima immagine selezionata nel layout PDF" style={{ width: "100%", height: "100%", objectFit: pdfImageFit, display: "block" }} />
                </div>
                <small>{pdfCompositionMode === "contact-sheet" ? `La contact sheet finale userà ${contactSheetColumns || "3"} colonne; questa anteprima mostra sfondo, margine e fit della pagina.` : `Anteprima ${pdfImageFit}: ${pdfPageSize === "original" ? "pagina basata sull'immagine" : pdfPageSize.toUpperCase()}, margine ${pdfMarginMm || "0"} mm.`}</small>
              </section>
            )}
          </>
        )}
        {optionMode === "pdf-to-images" && (
          <>
            <div class="field-grid">
              <label class="field"><span>Pagine (facoltativo)</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="es. 1-3, 5 · vuoto = tutte" disabled={isWorking} /><small>Intervalli e pagine singole nell'ordine indicato; pagine non valide o ripetute vengono rifiutate.</small></label>
              <label class="field"><span>Formato uscita</span><select value={pdfImageMime} onChange={(event) => setPdfImageMime(event.currentTarget.value as "image/jpeg" | "image/png" | "image/webp")} disabled={isWorking}><option value="image/png">PNG</option><option value="image/jpeg">JPG/JPEG</option><option value="image/webp">WebP</option></select><small>WebP richiede il supporto del browser; in assenza viene rifiutato, senza creare un PNG con estensione WebP.</small></label>
            </div>
            <div class="field-grid">
              <label class="field"><span>Scala render</span><input type="number" min="0.5" max="4" step="0.25" value={pdfImageScale} onInput={(event) => setPdfImageScale(event.currentTarget.value)} disabled={isWorking} /><small>1× ≈ 72 DPI, 2× ≈ 144 DPI, 4× ≈ 288 DPI.</small></label>
              <label class="field"><span>Qualità JPG/WebP</span><input type="number" min="0.1" max="1" step="0.01" value={imageQuality} onInput={(event) => setImageQuality(event.currentTarget.value)} disabled={isWorking} /><small>Ignorata per PNG. Ogni pagina viene renderizzata realmente, non vengono estratti soltanto gli oggetti JPEG.</small></label>
            </div>
            <label class="field"><span>Sfondo raster</span><input type="color" value={imageBackground} onInput={(event) => setImageBackground(event.currentTarget.value)} disabled={isWorking} /><small>Lo sfondo scelto viene applicato soltanto alle pagine renderizzate in immagine; il PDF sorgente non cambia.</small></label>
          </>
        )}
        {toolId === "pdf-compression-lite" && (
          <section class="field" aria-label="Profilo di compressione PDF">
            <label class="field"><span>Profilo di compressione</span>
              <select value={compressionProfile} onChange={(event) => {
                const next = event.currentTarget.value as "structural-only" | "jpeg-rgb-reencode" | "scan-flate-to-jpeg" | "target-best-effort";
                setCompressionProfile(next);
                setResult(null);
                // A compression profile is an option on the already-selected
                // document, not an instruction to discard it. When leaving
                // batch mode, only the first PDF is eligible for single-file
                // profiles, and the visible file list reflects that choice.
                if (next !== "target-best-effort") setFiles((current) => current.slice(0, 1));
                setError("");
              }} disabled={isWorking}>
                <option value="structural-only">Pulizia strutturale (predefinita)</option>
                <option value="jpeg-rgb-reencode">Ricodifica JPEG incorporati (con perdita)</option>
                <option value="scan-flate-to-jpeg">Scansioni Flate/PNG incorporati (con perdita)</option>
                <option value="target-best-effort">Sotto un limite KiB/MiB (tentativi e batch locale, senza garanzia)</option>
              </select>
            </label>
            {compressionProfile === "target-best-effort" && (
              <>
                <label class="field"><span>Dimensione massima PDF in {pdfTargetUnit} (1–8192 KiB, massimo 8 MiB)</span>
                  <input type="number" min={pdfTargetUnit === "KiB" ? "1" : "0.0009765625"} max={pdfTargetUnit === "KiB" ? "8192" : "8"} step={pdfTargetUnit === "KiB" ? "1" : "any"} value={pdfTargetKiB}
                    onInput={(event) => { setPdfTargetKiB(event.currentTarget.value); setResult(null); }} disabled={isWorking} />
                </label>
                <label class="field"><span>Unità del limite PDF</span>
                  <select aria-label="Unità del limite PDF" value={pdfTargetUnit} disabled={isWorking}
                    onChange={(event) => { const unit = event.currentTarget.value as "KiB" | "MiB";
                      if (unit !== pdfTargetUnit) { const bytes = Number(pdfTargetKiB) * (pdfTargetUnit === "MiB" ? 1024 * 1024 : 1024);
                        setPdfTargetKiB(Number.isFinite(bytes) ? String(bytes / (unit === "MiB" ? 1024 * 1024 : 1024)) : "");
                        setPdfTargetUnit(unit); setResult(null); } }}>
                    <option value="KiB">KiB</option><option value="MiB">MiB</option>
                  </select>
                </label>
                <p class="file-note">Carica 1–4 PDF (massimo 8 MiB ciascuno, 20 MiB complessivi). I tentativi ricomprimono JPEG/Flate dai sorgenti, controllano i byte PDF finali e si fermano quando il limite è realmente rispettato. Non viene promessa la dimensione richiesta. I PDF non raggiunti rimangono disponibili come best effort; lo ZIP contiene solo i PDF verificati sotto il limite. I singoli file con errori non bloccano gli altri.</p>
              </>
            )}
            {compressionProfile !== "structural-only" && compressionProfile !== "target-best-effort" && (
              <>
                <label class="field"><span>Intensità compressione immagine (preset con perdita dichiarata)</span>
                  <select aria-label="Intensità compressione PDF" value={compressionPreset} disabled={isWorking}
                    onChange={(event) => {
                      const chosen = event.currentTarget.value as "high-quality" | "balanced" | "strong" | "custom";
                      setCompressionPreset(chosen);
                      if (chosen === "high-quality") { setCompressionJpegQuality("0.85"); setScanMaxEdge("2048"); setScanTargetDpi("300"); }
                      if (chosen === "balanced") { setCompressionJpegQuality("0.6"); setScanMaxEdge("1600"); setScanTargetDpi("150"); }
                      if (chosen === "strong") { setCompressionJpegQuality("0.35"); setScanMaxEdge("960"); setScanTargetDpi("96"); }
                      setResult(null);
                    }}>
                    <option value="high-quality">Alta qualità: JPEG 0,85 · scansioni 2048 px / 300 DPI verificati</option>
                    <option value="balanced">Bilanciato: JPEG 0,60 · scansioni 1600 px / 150 DPI verificati</option>
                    <option value="strong">Forte: JPEG 0,35 · scansioni 960 px / 96 DPI verificati</option>
                    <option value="custom">Personalizzato: valori modificati manualmente</option>
                  </select>
                </label>
                <label class="field"><span>Qualità JPEG (0,35–0,85)</span>
                  <input type="number" min="0.35" max="0.85" step="0.05" value={compressionJpegQuality}
                    onInput={(event) => { setCompressionJpegQuality(event.currentTarget.value); setCompressionPreset("custom"); setResult(null); }} disabled={isWorking} />
                </label>
                {compressionProfile === "scan-flate-to-jpeg" ? (
                  <>
                    <label class="field"><span>Politica di ricampionamento</span>
                      <select value={scanResizePolicy} onChange={(event) => { setScanResizePolicy(event.currentTarget.value as "pixel-edge" | "verified-dpi"); setResult(null); }} disabled={isWorking}>
                        <option value="pixel-edge">Limite in pixel (compatibile con pagine complesse)</option>
                        <option value="verified-dpi">DPI effettivi certificati solo su immagini semplici</option>
                      </select>
                    </label>
                    {scanResizePolicy === "verified-dpi" ? (
                      <label class="field"><span>DPI massimi di posizionamento (36–600)</span>
                        <input type="number" min="36" max="600" step="1" value={scanTargetDpi}
                          onInput={(event) => { setScanTargetDpi(event.currentTarget.value); setCompressionPreset("custom"); setResult(null); }} disabled={isWorking} />
                        <small>Se i DPI non sono ricavabili da tutti i contenuti pagina, il PDF viene rifiutato senza produrre un file. Le immagini ripetute mantengono la risoluzione necessaria al disegno più grande.</small>
                      </label>
                    ) : (
                      <label class="field"><span>Lato lungo massimo dell'immagine (pixel)</span>
                        <input type="number" min="256" max="4096" step="1" value={scanMaxEdge}
                          onInput={(event) => { setScanMaxEdge(event.currentTarget.value); setCompressionPreset("custom"); setResult(null); }} disabled={isWorking} />
                      </label>
                    )}
                    <label class="field"><input type="checkbox" checked={scanGrayscale}
                      onChange={(event) => { setScanGrayscale(event.currentTarget.checked); setResult(null); }} disabled={isWorking} /> Converti le immagini idonee in grigio</label>
                    <p class="file-note">Solo immagini Flate RGB/grigie a 8 bit, senza maschere. La modalità DPI usa misure effettive verificate e rifiuta PDF con layout complessi; la modalità pixel conserva i limiti dichiarati e non inventa i DPI. JPEG con perdita; testo, vettori e JPEG esistenti non vengono rasterizzati. Se cresce, restituisce l'originale.</p>
                  </>
                ) : <p class="file-note">Solo JPEG RGB 8 bit con filtro DCT unico e risorse immagine dirette: nessun downsample, grigio, PNG o JBIG2. Maschere, colori speciali e filtri multipli vengono saltati. La compressione JPEG è con perdita; il testo e i vettori vengono copiati senza rasterizzarli.</p>}
              </>
            )}
          </section>
        )}
        {optionMode === "multi-search" && (
          <>
            <label class="field">
              <span>Testo da cercare</span>
              <input aria-label="Testo da cercare" value={query} onInput={(event) => setQuery(event.currentTarget.value)} maxLength={256} disabled={isWorking} />
              <small>Ricerca letterale locale. La query è limitata a 256 caratteri.</small>
            </label>
            <div class="field-grid">
              <label class="field"><span>Contesto per lato</span><input aria-label="Contesto per lato" type="number" min="0" max="1000" step="1" value={contextCharacters} onInput={(event) => setContextCharacters(event.currentTarget.value)} disabled={isWorking} /></label>
              <label class="field"><span>Massimo risultati</span><input aria-label="Massimo risultati" type="number" min="1" max="500" step="1" value={maxResults} onInput={(event) => setMaxResults(event.currentTarget.value)} disabled={isWorking} /></label>
            </div>
            <label class="checkbox-field"><input aria-label="Maiuscole e minuscole distinte" type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.currentTarget.checked)} disabled={isWorking} /> <span>Distingui maiuscole e minuscole</span></label>
            <p class="file-note">Ogni file viene isolato: un PDF illeggibile, cifrato o privo di testo non interrompe gli altri. I file senza testo mostrano un handoff OCR esplicito solo come non disponibile finché il relativo strumento non esiste.</p>
          </>
        )}
        {optionMode === "pdf-to-markdown" && (
          <p class="file-note">L'export usa soltanto il testo page-scoped del motore PDF in ordine contenuti. I marker di pagina sono aggiunti come commenti Markdown; titoli, tabelle, colonne, immagini e stile non vengono ricostruiti.</p>
        )}
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions"><button class="primary" type="submit" disabled={isWorking}>{isWorking ? it(CONTROL.working) : actionLabel}</button>{isWorking && <button type="button" onClick={() => controller.current?.abort()}>{it(CONTROL.cancel)}</button>}<button type="button" onClick={reset} disabled={isWorking}>{it(CONTROL.reset)}</button></div>
      </section>
      <ToolResultPanel
        eyebrow={it(CONTROL.localResult)}
        placeholder={error === "" ? it(CONTROL.gutterIdle) : error}
        state={gutterState}
        busy={isWorking}
      >
        {result === null ? undefined : (
          <>
            <PdfResultV2
              toolId={toolId}
              result={result}
              sourceFiles={files}
              onReset={reset}
              onRetry={execute}
            />
            {(formsAudit !== undefined || flattenVerification !== undefined) && (
              <PdfFormAuditDetails
                {...(formsAudit === undefined ? {} : { audit: formsAudit })}
                {...(flattenVerification === undefined ? {} : { verification: flattenVerification })} />
            )}
            {comparison !== null && files[0] !== undefined && files[1] !== undefined && (
              <section class="field" aria-label="Analisi PDF per livelli" data-pdf-compare-layers>
                <strong>Allineamento delle pagine</strong>
                <p class="file-note" data-compare-page-summary>
                  Aggiunte {comparison.alignment.addedPages.length} · Rimosse {comparison.alignment.removedPages.length} ·
                  Riordinate {comparison.alignment.reorderedPairs.length} · Modificate {comparison.alignment.modifiedPairs.length} ·
                  Coppie invariate nei controlli limitati {comparison.alignment.unchangedPairs.length}
                </p>
                <ol class="status-list" data-pdf-compare-alignment>
                  {comparison.alignment.entries.slice(0, 40).map((entry, index) => (
                    <li key={index}>
                      {entry.kind === "added" ? "Aggiunta" : entry.kind === "removed" ? "Rimossa" : entry.kind === "reordered" ? "Spostata" : entry.kind === "modified" ? "Modificata" : "Invariata nei controlli limitati"}:
                      {entry.firstPage === null ? " —" : ` PDF A pagina ${entry.firstPage}`}
                      {entry.secondPage === null ? " —" : ` → PDF B pagina ${entry.secondPage}`}
                      {entry.geometryChanged ? " · geometria" : ""}
                      {entry.textChanged ? " · testo" : ""}
                      {entry.resourceCountChanged ? " · conteggi risorse" : ""}
                    </li>
                  ))}
                </ol>
                {comparison.alignment.entries.length > 40 && <small>Prime 40 corrispondenze mostrate su {comparison.alignment.entries.length}; il risultato copiabile include tutte le pagine.</small>}
                <strong>Struttura e testo</strong>
                <p class="file-note" data-compare-text-summary>
                  Struttura: {comparison.structure.status} ({comparison.structure.changedPairs.length} coppie differenti per geometria/conteggi risorse).
                  Testo estratto: {comparison.text.status} ({comparison.text.changedPairs.length} coppie differenti).
                </p>
                <p class="file-note">La struttura confronta geometria, rotazione e conteggi di immagini/annotazioni, non l'identità dei byte di ogni oggetto. Il testo estratto non ricostruisce OCR o impaginazione e non certifica l'uguaglianza visiva.</p>
                <button type="button" onClick={() => setShowVisualCompare((shown) => !shown)}>
                  {showVisualCompare ? "Chiudi confronto visivo" : "Apri confronto visivo delle miniature (facoltativo)"}
                </button>
                {showVisualCompare && <PdfVisualCompare first={files[0]} second={files[1]} comparison={comparison} />}
              </section>
            )}
          </>
        )}
      </ToolResultPanel>
    </form>
  );
}
