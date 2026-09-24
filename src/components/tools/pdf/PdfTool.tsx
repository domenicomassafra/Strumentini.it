import { useEffect, useRef, useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { PdfArtifact } from "../../../engines/pdf";

export type PdfToolId =
  | "pdf-merge"
  | "pdf-split"
  | "pdf-page-reorder"
  | "pdf-rotate"
  | "pdf-page-delete-extract"
  | "images-to-pdf"
  | "pdf-to-images"
  | "pdf-text-extraction"
  | "pdf-metadata-inspector"
  | "pdf-metadata-remover"
  | "pdf-page-size-inspector"
  | "pdf-page-count-verifier"
  | "pdf-password-check-remove"
  | "pdf-flatten"
  | "pdf-form-inspector"
  | "pdf-link-extractor"
  | "pdf-image-extractor"
  | "pdf-compare-lite"
  | "pdf-compression-lite"
  | "document-handoff-manifest";

type InputMode = "single" | "multi" | "pair";
type OptionMode = "none" | "pages" | "groups" | "order" | "rotation" | "delete-extract" | "password";

export interface PdfToolProps {
  readonly toolId: PdfToolId;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly inputMode?: InputMode;
  readonly optionMode?: OptionMode;
  readonly accept?: string;
}

interface ToolResult {
  readonly value: unknown;
}

function parseNumbers(value: string): number[] {
  return value.split(/[\s,;]+/u).filter(Boolean).map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function parseGroups(value: string): number[][] {
  return value.split(";").map((part) => part.split(/[\s,]+/u).filter(Boolean).flatMap((item) => {
    const range = /^(\d+)\s*-\s*(\d+)$/u.exec(item);
    if (range === null) return [Number(item)];
    const start = Number(range[1]);
    const end = Number(range[2]);
    return start <= end ? Array.from({ length: end - start + 1 }, (_, index) => start + index) : [];
  })).filter((group) => group.length > 0);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  try {
    return JSON.stringify(value, (_key, item: unknown) => {
      if (item instanceof Blob) return `[Blob ${item.size} bytes]`;
      if (item instanceof Uint8Array) return `[Bytes ${item.byteLength}]`;
      return item;
    }, 2);
  } catch {
    return "Result received.";
  }
}

function artifactList(value: unknown): PdfArtifact[] {
  if (typeof value !== "object" || value === null) return [];
  const artifacts = (value as { artifacts?: unknown }).artifacts;
  return Array.isArray(artifacts) ? artifacts.filter((item): item is PdfArtifact => typeof item === "object" && item !== null && "blob" in item && "filename" in item) : [];
}

function isInspection(value: unknown): value is { inspection?: { capabilities?: readonly { capability: string; available: boolean; reason?: string }[] } } {
  return typeof value === "object" && value !== null && "inspection" in value;
}

export function PdfTool({ toolId, title, description, actionLabel, inputMode = "single", optionMode = "none", accept = "application/pdf,.pdf" }: PdfToolProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState("");
  const [order, setOrder] = useState("");
  const [groups, setGroups] = useState("");
  const [rotation, setRotation] = useState("90");
  const [deleteMode, setDeleteMode] = useState<"delete" | "extract">("extract");
  const [passwordMode, setPasswordMode] = useState<"check" | "remove">("check");
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
  const controller = useRef<AbortController | null>(null);
  const [urls, setUrls] = useState<readonly { filename: string; url: string }[]>([]);

  const inspection = isInspection(result?.value) ? result.value.inspection : undefined;

  useEffect(() => () => {
    controller.current?.abort();
    for (const item of urls) URL.revokeObjectURL(item.url);
  }, [urls]);

  function clearUrls() {
    setUrls((current) => {
      for (const item of current) URL.revokeObjectURL(item.url);
      return [];
    });
  }

  function choose(event: Event, index = 0) {
    const input = event.currentTarget as HTMLInputElement;
    const selected = input.files === null ? [] : [...input.files];
    if (inputMode === "multi") {
      setFiles(selected);
    } else {
      setFiles((current) => {
        const next = [...current];
        const first = selected[0];
        if (first !== undefined) next[index] = first;
        return next.filter((item): item is File => item !== undefined);
      });
    }
    clearUrls();
    setResult(null);
    setError("");
    setStatus("idle");
  }

  function buildInput(): unknown {
    if (inputMode === "pair") return { first: files[0], second: files[1] };
    if (inputMode === "multi") return { files };
    if (optionMode === "pages") return { file: files[0], pages: parseNumbers(pages), ...(toolId === "pdf-page-delete-extract" ? { mode: deleteMode } : {}) };
    if (optionMode === "groups") return { file: files[0], groups: parseGroups(groups) };
    if (optionMode === "order") return { file: files[0], order: parseNumbers(order) };
    if (optionMode === "rotation") return { file: files[0], rotations: Object.fromEntries(parseNumbers(pages).map((page) => [page, Number(rotation)])) };
    if (optionMode === "delete-extract") return { file: files[0], pages: parseNumbers(pages), mode: deleteMode };
    if (optionMode === "password") return { file: files[0], mode: passwordMode };
    return { file: files[0] };
  }

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    clearUrls();
    setResult(null);
    if (inputMode === "pair" && files.length < 2) {
      setError("Choose two local PDF files.");
      return;
    }
    if (inputMode !== "pair" && files.length === 0) {
      setError("Choose a local file first.");
      return;
    }
    const abortController = new AbortController();
    controller.current = abortController;
    setStatus("working");
    try {
      const run = await toolRuntime.run(toolId, buildInput(), {}, abortController.signal);
      if (!run.ok) throw new Error(run.message);
      setResult({ value: run.value });
      setStatus("done");
      const outputArtifacts = artifactList(run.value);
      if (outputArtifacts.length > 0) {
        setUrls(outputArtifacts.map((artifact) => ({ filename: artifact.filename, url: URL.createObjectURL(artifact.blob) })));
      } else if (typeof run.value === "object" && run.value !== null && typeof (run.value as { json?: unknown }).json === "string") {
        const json = (run.value as { json: string }).json;
        setUrls([{ filename: "document-handoff.json", url: URL.createObjectURL(new Blob([json], { type: "application/json" })) }]);
      }
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === "AbortError" ? "Operation cancelled. No output was produced." : caught instanceof Error ? caught.message : "The local PDF operation failed.");
      setStatus("idle");
    } finally {
      if (controller.current === abortController) controller.current = null;
    }
  }

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setFiles([]);
    setPages("");
    setOrder("");
    setGroups("");
    setRotation("90");
    setDeleteMode("extract");
    setPasswordMode("check");
    setResult(null);
    setError("");
    setStatus("idle");
    clearUrls();
  }

  const isWorking = status === "working";
  return (
    <form class="tool-operation" onSubmit={submit} noValidate>
      <section class="tool-form-card">
        <p class="file-note">{description}</p>
        {inputMode === "pair" ? (
          <div class="field-grid">
            <label class="field"><span>First PDF</span><input type="file" accept={accept} onChange={(event) => choose(event, 0)} disabled={isWorking} /></label>
            <label class="field"><span>Second PDF</span><input type="file" accept={accept} onChange={(event) => choose(event, 1)} disabled={isWorking} /></label>
          </div>
        ) : (
          <label class="field">
            <span>{inputMode === "multi" ? "Files" : title}</span>
            <input type="file" accept={accept} multiple={inputMode === "multi"} onChange={(event) => choose(event)} disabled={isWorking} />
            <small>Processed on this device; no upload or remote fallback.</small>
          </label>
        )}
        {files.length > 0 && <p class="file-note" role="status">{files.map((file) => `${file.name} · ${(file.size / 1024).toFixed(1)} KiB`).join(" · ")}</p>}
        {optionMode === "pages" && <label class="field"><span>Pages</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="1, 3, 5" disabled={isWorking} /></label>}
        {optionMode === "groups" && <label class="field"><span>Page groups</span><input value={groups} onInput={(event) => setGroups(event.currentTarget.value)} placeholder="1-2; 3-4" disabled={isWorking} /></label>}
        {optionMode === "order" && <label class="field"><span>New page order</span><input value={order} onInput={(event) => setOrder(event.currentTarget.value)} placeholder="3, 1, 2" disabled={isWorking} /></label>}
        {optionMode === "rotation" && <div class="field-grid"><label class="field"><span>Pages</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="1, 2" disabled={isWorking} /></label><label class="field"><span>Rotation</span><select value={rotation} onChange={(event) => setRotation(event.currentTarget.value)} disabled={isWorking}><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label></div>}
        {optionMode === "delete-extract" && <div class="field-grid"><label class="field"><span>Pages</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="1, 3" disabled={isWorking} /></label><label class="field"><span>Operation</span><select value={deleteMode} onChange={(event) => setDeleteMode(event.currentTarget.value as "delete" | "extract")} disabled={isWorking}><option value="extract">Extract selected pages</option><option value="delete">Delete selected pages</option></select></label></div>}
        {optionMode === "password" && <label class="field"><span>Mode</span><select value={passwordMode} onChange={(event) => setPasswordMode(event.currentTarget.value as "check" | "remove")} disabled={isWorking}><option value="check">Check encryption only</option><option value="remove">Create a safe copy when unencrypted</option></select></label>}
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions"><button class="primary" type="submit" disabled={isWorking}>{isWorking ? "Working locally…" : actionLabel}</button>{isWorking && <button type="button" onClick={() => controller.current?.abort()}>Cancel</button>}<button type="button" onClick={reset} disabled={isWorking}>Reset</button></div>
      </section>
      <section class="result-panel" aria-live="polite" aria-atomic="true">
        <p class="eyebrow">Local result</p>
        {result === null ? <p class="result-placeholder">The verified local result and capability notes appear here.</p> : <>
          {inspection?.capabilities !== undefined && <ul class="file-note">{inspection.capabilities.map((capability) => <li key={capability.capability}>{capability.available ? "✓" : "!"} {capability.capability}{capability.reason === undefined ? "" : ` — ${capability.reason}`}</li>)}</ul>}
          {urls.length > 0 && <div class="actions">{urls.map((item) => <a class="button primary" href={item.url} download={item.filename} key={item.url}>{item.filename}</a>)}</div>}
          {typeof result.value === "object" && result.value !== null && typeof (result.value as { text?: unknown }).text === "string" && <textarea class="csv-preview" readOnly rows={8} value={(result.value as { text: string }).text} aria-label="Extracted text" />}
          <details open><summary>Machine-readable result</summary><pre class="csv-preview">{displayValue(result.value)}</pre></details>
        </>}
      </section>
    </form>
  );
}
