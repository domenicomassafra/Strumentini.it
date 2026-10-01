import { useEffect, useRef, useState } from "preact/hooks";
import type { ImageResizeOutput, ImageResizeProgress } from "../../../tools/image-resize/types";
import { PreviousValue } from "../shared/PreviousValue";

type ProcessingState = "idle" | "working" | "done";

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

export function ImageResizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState("1200");
  const [height, setHeight] = useState("1200");
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [outputMime, setOutputMime] = useState<"image/jpeg" | "image/webp">("image/jpeg");
  const [webpEncodeSupported, setWebpEncodeSupported] = useState<boolean | null>(null);
  const [quality, setQuality] = useState("0.88");
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState<ImageResizeProgress | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImageResizeOutput | null>(null);
  const dimensions = result === null ? "" : `${result.outputWidth}×${result.outputHeight}`;
  const gutterState = status === "working"
    ? "running"
    : error !== "" ? "error" : result === null ? "idle" : "success";
  const [downloadUrl, setDownloadUrl] = useState("");
  const controller = useRef<AbortController | null>(null);

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

  useEffect(() => {
    return () => {
      if (downloadUrl !== "") URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  function clearOutput() {
    setResult(null);
    setDownloadUrl((current) => {
      if (current !== "") URL.revokeObjectURL(current);
      return "";
    });
  }

  function chooseFile(event: Event) {
    const selected = event.currentTarget instanceof HTMLInputElement
      ? event.currentTarget.files?.[0] ?? null
      : null;
    setFile(selected);
    setError("");
    setStatus("idle");
    setProgress(null);
    clearOutput();
  }

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    clearOutput();
    if (file === null) {
      setError("Scegli un'immagine JPEG, PNG o WebP.");
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
          width: Number(width),
          height: Number(height),
          fit,
          outputMime,
          quality: Number(quality),
        },
        abortController.signal,
        setProgress,
      );
      if (abortController.signal.aborted) return;
      setResult(output);
      setDownloadUrl(URL.createObjectURL(output.blob));
      setStatus("done");
      setProgress(null);
    } catch (caught) {
      setStatus("idle");
      setProgress(null);
      setError(friendlyError(caught));
    } finally {
      if (controller.current === abortController) controller.current = null;
    }
  }

  function cancel() {
    controller.current?.abort();
  }

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setFile(null);
    setWidth("1200");
    setHeight("1200");
    setFit("contain");
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
              onInput={(event) => setWidth(event.currentTarget.value)}
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
              onInput={(event) => setHeight(event.currentTarget.value)}
              disabled={status === "working"}
            />
          </label>
        </div>

        <fieldset class="segmented">
          <legend>Adattamento</legend>
          <label>
            <input
              type="radio"
              name="image-fit"
              checked={fit === "contain"}
              onChange={() => setFit("contain")}
              disabled={status === "working"}
            />
            Contieni nell'area
          </label>
          <label>
            <input
              type="radio"
              name="image-fit"
              checked={fit === "cover"}
              onChange={() => setFit("cover")}
              disabled={status === "working"}
            />
            Ritaglia per riempire
          </label>
        </fieldset>

        <div class="field-grid">
          <label class="field">
            <span>Formato di uscita</span>
            <select
              value={outputMime}
              onChange={(event) => setOutputMime(event.currentTarget.value as "image/jpeg" | "image/webp")}
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
              onInput={(event) => setQuality(event.currentTarget.value)}
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
          ) : (
            <button type="button" onClick={reset}>Reimposta</button>
          )}
        </div>
      </form>

      <section class="result-panel gutter" data-state={gutterState} aria-live="polite" aria-atomic="true">
        <p class="gutter-label eyebrow">Risultato</p>
        {/* Held outside the result branch: the tool clears its result while it
            recomputes, and the headline has to keep its state through that. */}
        <PreviousValue value={dimensions} retain={status === "working"} />
        {result === null ? (
          <p class="result-placeholder">Il risultato locale verificato apparirà qui.</p>
        ) : (
          <>
            <p>{result.filename}</p>
            <p>{formatBytes(result.blob.size)} · {result.outputMime}</p>
            <div class="actions">
              <a class="button primary" href={downloadUrl} download={result.filename}>Scarica</a>
            </div>
            <dl class="assumptions">
              <div>
                <dt>Ingresso</dt>
                <dd>{result.sourceWidth}×{result.sourceHeight} · {result.inputMime}</dd>
              </div>
              <div>
                <dt>Memoria stimata</dt>
                <dd>{formatBytes(result.estimatedDecodedBytes)} stimati per l'elaborazione decodificata</dd>
              </div>
              <div>
                <dt>Orientamento</dt>
                <dd>Gestito localmente durante la decodifica</dd>
              </div>
              <div>
                <dt>Metadati</dt>
                <dd>Politica locale applicata al nuovo file</dd>
              </div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
