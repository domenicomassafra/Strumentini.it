import { useEffect, useRef, useState } from "preact/hooks";
import { inspectImageHeader } from "../../../engines/image/format";
import {
  computeResizePlan,
  lockedHeightForWidth,
  lockedWidthForHeight,
  scaleDimensionsByPercent,
} from "../../../engines/image/policy";
import type { ImageResizeProgress } from "../../../tools/image-resize/types";
import { ToolResultPanel } from "../shared";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import { ImageResultV2, prepareImageResult, type PreparedImageResult } from "../image-visual/ImageResultV2";

type ProcessingState = "idle" | "working" | "done";
type SizingMode = "pixels" | "percent";
interface ImageDimensions { width: number; height: number }

const HEADER_READ_BYTES = 2 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Operazione annullata. Nessuna immagine è stata caricata o salvata.";
  }
  const message = error instanceof Error ? error.message : "Image resize failed";
  if (/^(CORRUPT_IMAGE|TRUNCATED_IMAGE):/u.test(message)) {
    return "L'immagine è danneggiata o incompleta e non può essere decodificata in sicurezza.";
  }
  if (/^UNSUPPORTED_TYPE:/u.test(message)) {
    return "Scegli un'immagine JPEG, PNG o WebP.";
  }
  if (/^(IMAGE_TOO_LARGE|OUTPUT_TOO_LARGE|MEMORY_LIMIT):/u.test(message)) {
    return "L'immagine o il risultato richiesto supera il limite locale di sicurezza. Usa un file o dimensioni più piccole.";
  }
  if (/^UNSUPPORTED_BROWSER:/u.test(message)) {
    return "Questo browser non offre le API locali necessarie per elaborare l'immagine.";
  }
  if (/^(ENCODE_FAILED|OUTPUT_VALIDATION_FAILED):/u.test(message)) {
    return "Il browser non è riuscito a produrre e verificare un risultato valido. Prova JPEG o dimensioni più piccole.";
  }
  if (/^INVALID_INPUT:/u.test(message)) {
    return "Controlla file, dimensioni, modalità di adattamento, formato e qualità.";
  }
  return "Il ridimensionamento non è riuscito. Controlla il file e i parametri inseriti.";
}

async function readSourceDimensions(file: File): Promise<ImageDimensions> {
  const bytes = new Uint8Array(await file.slice(0, HEADER_READ_BYTES).arrayBuffer());
  const header = inspectImageHeader(bytes);
  return { width: header.width, height: header.height };
}

export function ImageResizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceDimensions, setSourceDimensions] = useState<ImageDimensions | null>(null);
  const [sizingMode, setSizingMode] = useState<SizingMode>("pixels");
  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("1200");
  const [percent, setPercent] = useState("50");
  const [lockAspect, setLockAspect] = useState(false);
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [noUpscale, setNoUpscale] = useState(true);
  const [outputMime, setOutputMime] = useState<"image/jpeg" | "image/webp">("image/jpeg");
  const [webpEncodeSupported, setWebpEncodeSupported] = useState<boolean | null>(null);
  const [quality, setQuality] = useState("0.88");
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState<ImageResizeProgress | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreparedImageResult | null>(null);
  const gutterState = status === "working"
    ? "running"
    : error !== "" ? "error" : result === null ? "idle" : "success";
  const controller = useRef<AbortController | null>(null);
  const previewRequest = useRef(0);

  function resolveTargetDimensions(dimensions = sourceDimensions): ImageDimensions | null {
    if (sizingMode === "percent") {
      if (dimensions === null) return null;
      return scaleDimensionsByPercent(dimensions.width, dimensions.height, Number(percent));
    }
    return { width: Number(width), height: Number(height) };
  }

  const targetDimensions = (() => {
    try {
      return resolveTargetDimensions();
    } catch {
      return null;
    }
  })();
  const previewPlan = (() => {
    if (sourceDimensions === null || targetDimensions === null) return null;
    try {
      return computeResizePlan(
        sourceDimensions.width,
        sourceDimensions.height,
        targetDimensions.width,
        targetDimensions.height,
        fit,
        noUpscale,
      );
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const supported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
    setWebpEncodeSupported(supported);
    if (!supported) setOutputMime("image/jpeg");
  }, []);

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  function clearOutput() {
    setResult(null);
  }

  function updateSetting(action: () => void) {
    action();
    clearOutput();
  }

  async function chooseFile(event: Event) {
    const selected = event.currentTarget instanceof HTMLInputElement
      ? event.currentTarget.files?.[0] ?? null
      : null;
    const requestId = previewRequest.current + 1;
    previewRequest.current = requestId;
    setFile(selected);
    setSourceDimensions(null);
    setError("");
    setStatus("idle");
    setProgress(null);
    clearOutput();
    if (selected === null) return;
    try {
      const dimensions = await readSourceDimensions(selected);
      if (previewRequest.current !== requestId) return;
      setSourceDimensions(dimensions);
      if (sizingMode === "pixels" && lockAspect) {
        const numericWidth = Number(width);
        if (Number.isFinite(numericWidth) && numericWidth > 0) {
          setHeight(String(lockedHeightForWidth(numericWidth, dimensions.width, dimensions.height)));
        }
      }
    } catch {
      // The submit path owns the user-facing validation error. A failed header
      // preview only means the live estimate is unavailable.
    }
  }

  function updateWidth(value: string) {
    setWidth(value);
    clearOutput();
    if (!lockAspect || sourceDimensions === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return;
    setHeight(String(lockedHeightForWidth(numeric, sourceDimensions.width, sourceDimensions.height)));
  }

  function updateHeight(value: string) {
    setHeight(value);
    clearOutput();
    if (!lockAspect || sourceDimensions === null) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return;
    setWidth(String(lockedWidthForHeight(numeric, sourceDimensions.width, sourceDimensions.height)));
  }

  function toggleAspectLock(checked: boolean) {
    setLockAspect(checked);
    clearOutput();
    if (!checked || sourceDimensions === null) return;
    const numericWidth = Number(width);
    if (!Number.isFinite(numericWidth) || numericWidth < 1) return;
    setHeight(String(lockedHeightForWidth(numericWidth, sourceDimensions.width, sourceDimensions.height)));
  }

  async function submit(event: Event) {
    event.preventDefault();
    await runResize();
  }

  async function runResize() {
    if (controller.current !== null) return;
    setError("");
    clearOutput();
    if (file === null) {
      setError("Scegli un'immagine JPEG, PNG o WebP.");
      return;
    }

    let dimensions = sourceDimensions;
    if (sizingMode === "percent" && dimensions === null) {
      try {
        dimensions = await readSourceDimensions(file);
        setSourceDimensions(dimensions);
      } catch (caught) {
        setError(friendlyError(caught));
        return;
      }
    }
    let target: ImageDimensions | null;
    try {
      target = resolveTargetDimensions(dimensions);
    } catch (caught) {
      setError(friendlyError(caught));
      return;
    }
    if (target === null) {
      setError("Non riesco a leggere le dimensioni dell'immagine per il ridimensionamento percentuale.");
      return;
    }

    const abortController = new AbortController();
    controller.current = abortController;
    setStatus("working");
    setProgress({ phase: "header", label: "Preparazione dell'immagine locale" });

    try {
      // The implementation stays out of the initial page bundle until the first operation.
      const { resizeImageLocal } = await import("../../../tools/image-resize/module");
      const output = await resizeImageLocal(
        {
          file,
          width: target.width,
          height: target.height,
          fit,
          noUpscale,
          outputMime,
          quality: Number(quality),
        },
        abortController.signal,
        setProgress,
      );
      if (abortController.signal.aborted) return;
      const verified = await prepareImageResult(output);
      if (abortController.signal.aborted || controller.current !== abortController) return;
      setResult(verified);
      setStatus("done");
      setProgress(null);
      recordCompletedTool("image-resize");
    } catch (caught) {
      if (controller.current !== abortController) return;
      setStatus("idle");
      setProgress(null);
      setError(friendlyError(caught));
    } finally {
      if (controller.current === abortController) controller.current = null;
    }
  }

  function cancel() {
    const activeController = controller.current;
    activeController?.abort();
    if (controller.current === activeController) controller.current = null;
    setStatus("idle");
    setProgress(null);
    setError("Operazione annullata. Nessuna immagine è stata caricata o salvata.");
  }

  function reset() {
    controller.current?.abort();
    controller.current = null;
    previewRequest.current += 1;
    setFile(null);
    setSourceDimensions(null);
    setSizingMode("pixels");
    setWidth("1200");
    setHeight("1200");
    setPercent("50");
    setLockAspect(false);
    setFit("contain");
    setNoUpscale(true);
    setOutputMime("image/jpeg");
    setQuality("0.88");
    setStatus("idle");
    setProgress(null);
    setError("");
    clearOutput();
    const input = document.querySelector<HTMLInputElement>("#image-resize-file");
    if (input !== null) input.value = "";
  }

  return (
    <div class="tool-operation">
      <form onSubmit={submit} noValidate>
        <label class="field">
          <span>Immagine</span>
          <input
            id="image-resize-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseFile}
            disabled={status === "working"}
            aria-describedby="image-resize-file-help"
          />
          <small id="image-resize-file-help">
            Scegli da File o Foto. JPEG, PNG o WebP; l'elaborazione avviene solo su questo dispositivo.
          </small>
        </label>

        {file !== null && (
          <p class="result-placeholder">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}

        <fieldset class="segmented">
          <legend>Dimensionamento</legend>
          <label>
            <input
              type="radio"
              name="image-sizing-mode"
              checked={sizingMode === "pixels"}
              onChange={() => updateSetting(() => setSizingMode("pixels"))}
              disabled={status === "working"}
            />
            Dimensioni in pixel
          </label>
          <label>
            <input
              type="radio"
              name="image-sizing-mode"
              checked={sizingMode === "percent"}
              onChange={() => updateSetting(() => setSizingMode("percent"))}
              disabled={status === "working"}
            />
            Percentuale
          </label>
        </fieldset>

        {sizingMode === "pixels" ? (
          <>
            <div class="field-grid">
              <label class="field">
                <span>Larghezza</span>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  step="1"
                  inputMode="numeric"
                  value={width}
                  onInput={(event) => updateWidth(event.currentTarget.value)}
                  disabled={status === "working"}
                />
              </label>
              <label class="field">
                <span>Altezza</span>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  step="1"
                  inputMode="numeric"
                  value={height}
                  onInput={(event) => updateHeight(event.currentTarget.value)}
                  disabled={status === "working"}
                />
              </label>
            </div>
            <label class="field">
              <span>
                <input
                  type="checkbox"
                  checked={lockAspect}
                  onChange={(event) => toggleAspectLock(event.currentTarget.checked)}
                  disabled={status === "working" || sourceDimensions === null}
                />{" "}
                Mantieni le proporzioni originali
              </span>
              <small>Quando attivo, modificare una dimensione aggiorna automaticamente l'altra.</small>
            </label>
          </>
        ) : (
          <label class="field">
            <span>Scala percentuale</span>
            <input
              type="number"
              min="1"
              max="500"
              step="1"
              inputMode="decimal"
              value={percent}
              onInput={(event) => updateSetting(() => setPercent(event.currentTarget.value))}
              disabled={status === "working"}
            />
            <small>100% mantiene le dimensioni originali; valori maggiori possono ingrandire se lo consenti.</small>
          </label>
        )}

        <fieldset class="segmented">
          <legend>Adattamento</legend>
          <label>
            <input
              type="radio"
              name="image-fit"
              checked={fit === "contain"}
              onChange={() => updateSetting(() => setFit("contain"))}
              disabled={status === "working"}
            />
            Contieni nell'area
          </label>
          <label>
            <input
              type="radio"
              name="image-fit"
              checked={fit === "cover"}
              onChange={() => updateSetting(() => setFit("cover"))}
              disabled={status === "working"}
            />
            Ritaglia per riempire
          </label>
        </fieldset>

        <p class="result-placeholder">
          {fit === "contain"
            ? "Contieni: mantiene tutta l'immagine e la fa entrare nell'area senza ritagliarla."
            : "Riempi e ritaglia: riempie l'area richiesta e ritaglia al centro quando il rapporto cambia."}
        </p>

        <label class="field">
          <span>
            <input
              type="checkbox"
              checked={noUpscale}
              onChange={(event) => updateSetting(() => setNoUpscale(event.currentTarget.checked))}
              disabled={status === "working"}
            />{" "}
            Non ingrandire oltre l'originale
          </span>
          <small>Se il target è più grande, il risultato resta al massimo alla risoluzione utile della sorgente.</small>
        </label>

        {sourceDimensions !== null && (
          <p class="result-placeholder" data-resize-estimate aria-live="polite">
            Originale {sourceDimensions.width}×{sourceDimensions.height}
            {previewPlan === null
              ? " · Inserisci dimensioni valide per vedere la stima."
              : ` · Stima ${previewPlan.outputWidth}×${previewPlan.outputHeight}${fit === "cover" ? " con ritaglio centrale" : " senza ritaglio"}${noUpscale && targetDimensions !== null && (previewPlan.outputWidth < targetDimensions.width || previewPlan.outputHeight < targetDimensions.height) ? " · ingrandimento bloccato" : ""}.`}
          </p>
        )}

        <div class="field-grid">
          <label class="field">
            <span>Formato di uscita</span>
            <select
              value={outputMime}
              onChange={(event) => updateSetting(() => setOutputMime(event.currentTarget.value as "image/jpeg" | "image/webp"))}
              disabled={status === "working"}
            >
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp" disabled={webpEncodeSupported === false}>WebP</option>
            </select>
            {webpEncodeSupported === false && (
              <small>La codifica WebP non è disponibile in questo browser; JPEG resta completamente locale.</small>
            )}
          </label>
          <label class="field">
            <span>Qualità</span>
            <input
              type="number"
              min="0.4"
              max="1"
              step="0.01"
              value={quality}
              onInput={(event) => updateSetting(() => setQuality(event.currentTarget.value))}
              disabled={status === "working"}
            />
          </label>
        </div>

        {progress !== null && (
          <p role="status" aria-live="polite">
            <strong>Elaborazione locale in corso</strong> · i dati restano su questo dispositivo
          </p>
        )}
        {error !== "" && <p class="error" role="alert">{error}</p>}

        <div class="actions">
          <button class="primary" type="submit" disabled={status === "working"}>
            {status === "working" ? "Elaborazione…" : "Ridimensiona"}
          </button>
          {status === "working" ? (
            <button type="button" onClick={cancel}>Annulla</button>
          ) : result === null ? (
            <button type="button" onClick={reset}>Reimposta</button>
          ) : null}
        </div>
      </form>

      {error === "" && (
        <ToolResultPanel
          eyebrow="Risultato"
          placeholder="Il risultato locale verificato apparirà qui."
          busy={status === "working"}
          state={gutterState}
        >
          {result !== null && <ImageResultV2 toolId="image-resize" result={result} sourceFiles={file === null ? [] : [file]} onReset={reset} onRetry={runResize} />}
        </ToolResultPanel>
      )}
    </div>
  );
}
