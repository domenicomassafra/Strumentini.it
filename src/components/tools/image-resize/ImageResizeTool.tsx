import { useEffect, useRef, useState } from "preact/hooks";
import type { ImageResizeOutput, ImageResizeProgress } from "../../../tools/image-resize/types";

type ProcessingState = "idle" | "working" | "done";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Cancelled. No image was uploaded or saved.";
  }
  const message = error instanceof Error ? error.message : "Image resize failed";
  if (/^(CORRUPT_IMAGE|TRUNCATED_IMAGE):/u.test(message)) {
    return "This image is corrupt or incomplete and could not be decoded safely.";
  }
  if (/^UNSUPPORTED_TYPE:/u.test(message)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (/^(IMAGE_TOO_LARGE|OUTPUT_TOO_LARGE|MEMORY_LIMIT):/u.test(message)) {
    return "This image or requested output is above the local safety limit. Try a smaller source or dimensions.";
  }
  if (/^UNSUPPORTED_BROWSER:/u.test(message)) {
    return "This browser does not provide the local image APIs required by this tool.";
  }
  if (/^(ENCODE_FAILED|OUTPUT_VALIDATION_FAILED):/u.test(message)) {
    return "The browser could not produce and verify a valid output. Try JPEG or smaller dimensions.";
  }
  if (/^INVALID_INPUT:/u.test(message)) {
    return "Check the file, dimensions, fit mode, format, and quality.";
  }
  return message;
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
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }

    const abortController = new AbortController();
    controller.current = abortController;
    setStatus("working");
    setProgress({ phase: "header", label: "Preparing local image" });

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
          <span>Image</span>
          <input
            id="image-resize-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseFile}
            disabled={status === "working"}
            aria-describedby="image-resize-file-help"
          />
          <small id="image-resize-file-help">
            Choose from Files or Photos. JPEG, PNG, or WebP; processed only on this device.
          </small>
        </label>

        {file !== null && (
          <p class="result-placeholder">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}

        <div class="field-grid">
          <label class="field">
            <span>Width</span>
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
            <span>Height</span>
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
          <legend>Fit</legend>
          <label>
            <input
              type="radio"
              name="image-fit"
              checked={fit === "contain"}
              onChange={() => setFit("contain")}
              disabled={status === "working"}
            />
            Fit inside
          </label>
          <label>
            <input
              type="radio"
              name="image-fit"
              checked={fit === "cover"}
              onChange={() => setFit("cover")}
              disabled={status === "working"}
            />
            Crop to fill
          </label>
        </fieldset>

        <div class="field-grid">
          <label class="field">
            <span>Output format</span>
            <select
              value={outputMime}
              onChange={(event) => setOutputMime(event.currentTarget.value as "image/jpeg" | "image/webp")}
              disabled={status === "working"}
            >
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp" disabled={webpEncodeSupported === false}>WebP</option>
            </select>
            {webpEncodeSupported === false && (
              <small>WebP encoding is unavailable in this browser; JPEG remains fully local.</small>
            )}
          </label>
          <label class="field">
            <span>Quality</span>
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
            <strong>{progress.label}</strong> · stays on this device
          </p>
        )}
        {error !== "" && <p class="error" role="alert">{error}</p>}

        <div class="actions">
          <button
            class="primary"
            type="submit"
            aria-disabled={status === "working" ? "true" : undefined}
            aria-busy={status === "working" ? "true" : undefined}
            onClick={(event) => { if (status === "working") { event.preventDefault(); event.stopPropagation(); } }}
          >
            {status === "working" ? "Processing…" : "Resize"}
          </button>
          {status === "working" ? (
            <button type="button" onClick={cancel}>Cancel</button>
          ) : (
            <button type="button" onClick={reset}>Reset</button>
          )}
        </div>
      </form>

      <section class="result-panel" aria-label="Output" aria-live="polite" aria-atomic="false">
        <p class="eyebrow">Output</p>
        {result === null ? (
          <p class="result-placeholder">Your verified local output appears here.</p>
        ) : (
          <>
            <strong class="result-value">{result.outputWidth}×{result.outputHeight}</strong>
            <p>{result.filename}</p>
            <p>{formatBytes(result.blob.size)} · {result.outputMime}</p>
            <div class="actions">
              <a class="button primary" href={downloadUrl} download={result.filename}>Download</a>
            </div>
            <dl class="assumptions">
              <div>
                <dt>Input</dt>
                <dd>{result.sourceWidth}×{result.sourceHeight} · {result.inputMime}</dd>
              </div>
              <div>
                <dt>Memory preflight</dt>
                <dd>{formatBytes(result.estimatedDecodedBytes)} estimated decoded working set</dd>
              </div>
              <div>
                <dt>Orientation</dt>
                <dd>{result.orientationPolicy}</dd>
              </div>
              <div>
                <dt>Metadata</dt>
                <dd>{result.metadataPolicy}</dd>
              </div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
