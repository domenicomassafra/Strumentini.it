import { useEffect, useRef, useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { PdfArtifact } from "../../../engines/pdf";
import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";
import { friendlyToolErrorIt } from "../../../i18n/it/errors";
import { StatusMark, statusMarkLabel } from "../shared/StatusMark";
import { CONTROL, it } from "../shared/controlLabels";

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

const PDF_ACTION_IT: Readonly<Record<PdfToolId, string>> = {
  "pdf-merge": "Unisci PDF",
  "pdf-split": "Dividi PDF",
  "pdf-page-reorder": "Riordina pagine",
  "pdf-rotate": "Ruota pagine",
  "pdf-page-delete-extract": "Applica operazione alle pagine",
  "images-to-pdf": "Crea PDF",
  "pdf-to-images": "Estrai immagini",
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
};

const RESULT_KEY_IT: Readonly<Record<string, string>> = {
  artifacts: "file_generati",
  inspection: "analisi",
  capabilities: "capacità",
  pageCount: "numero_pagine",
  pages: "pagine",
  width: "larghezza",
  height: "altezza",
  rotation: "rotazione",
  encrypted: "cifrato",
  metadata: "metadati",
  links: "collegamenti",
  fields: "campi",
  images: "immagini",
  text: "testo",
  filename: "nome_file",
  size: "dimensione",
  sha256: "sha256",
  structure: "struttura",
  valid: "valido",
  equal: "uguali",
  differences: "differenze",
  warnings: "avvisi",
  warning: "avviso",
  json: "json",
};

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
    const localize = (entry: unknown): unknown => {
      if (entry instanceof Blob) return `[Dati binari: ${entry.size} byte]`;
      if (entry instanceof Uint8Array) return `[Byte: ${entry.byteLength}]`;
      if (Array.isArray(entry)) return entry.map(localize);
      if (entry === null || typeof entry !== "object") return entry;
      return Object.fromEntries(Object.entries(entry as Record<string, unknown>).map(([key, item]) => [
        RESULT_KEY_IT[key] ?? key,
        localize(item),
      ]));
    };
    return JSON.stringify(localize(value), null, 2);
  } catch {
    return "Risultato ricevuto.";
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

export function PdfTool({ toolId, title: _title, description: _description, actionLabel: _actionLabel, inputMode = "single", optionMode = "none", accept = "application/pdf,.pdf" }: PdfToolProps) {
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
  }, []);

  useEffect(() => () => {
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
      setError(caught instanceof DOMException && caught.name === "AbortError"
        ? "Operazione annullata. Non è stato prodotto alcun risultato."
        : friendlyToolErrorIt(caught));
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
  const gutterState = isWorking ? "running" : result === null ? "idle" : error !== "" ? "error" : "success";
  const publicCopy = TOOL_COPY_IT[toolId];
  const publicTitle = publicCopy?.name ?? toolId;
  const publicDescription = publicCopy?.summary ?? "";
  const actionLabel = PDF_ACTION_IT[toolId];
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
            <input type="file" accept={accept} multiple={inputMode === "multi"} onChange={(event) => choose(event)} disabled={isWorking} />
            <small>Elaborazione su questo dispositivo, senza caricamenti né elaborazione remota alternativa.</small>
          </label>
        )}
        {files.length > 0 && <p class="file-note" role="status">{files.map((file) => `${file.name} · ${(file.size / 1024).toFixed(1)} KiB`).join(" · ")}</p>}
        {optionMode === "pages" && <label class="field"><span>Pagine</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="1, 3, 5" disabled={isWorking} /></label>}
        {optionMode === "groups" && <label class="field"><span>Gruppi di pagine</span><input value={groups} onInput={(event) => setGroups(event.currentTarget.value)} placeholder="1-2; 3-4" disabled={isWorking} /></label>}
        {optionMode === "order" && <label class="field"><span>Nuovo ordine delle pagine</span><input value={order} onInput={(event) => setOrder(event.currentTarget.value)} placeholder="3, 1, 2" disabled={isWorking} /></label>}
        {optionMode === "rotation" && <div class="field-grid"><label class="field"><span>Pagine</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="1, 2" disabled={isWorking} /></label><label class="field"><span>Rotazione</span><select value={rotation} onChange={(event) => setRotation(event.currentTarget.value)} disabled={isWorking}><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label></div>}
        {optionMode === "delete-extract" && <div class="field-grid"><label class="field"><span>Pagine</span><input value={pages} onInput={(event) => setPages(event.currentTarget.value)} placeholder="1, 3" disabled={isWorking} /></label><label class="field"><span>Operazione</span><select value={deleteMode} onChange={(event) => setDeleteMode(event.currentTarget.value as "delete" | "extract")} disabled={isWorking}><option value="extract">Estrai le pagine selezionate</option><option value="delete">Elimina le pagine selezionate</option></select></label></div>}
        {optionMode === "password" && <label class="field"><span>Modalità</span><select value={passwordMode} onChange={(event) => setPasswordMode(event.currentTarget.value as "check" | "remove")} disabled={isWorking}><option value="check">Controlla soltanto la cifratura</option><option value="remove">Crea una copia sicura se il PDF non è cifrato</option></select></label>}
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions"><button class="primary" type="submit" disabled={isWorking}>{isWorking ? it(CONTROL.working) : actionLabel}</button>{isWorking && <button type="button" onClick={() => controller.current?.abort()}>{it(CONTROL.cancel)}</button>}<button type="button" onClick={reset} disabled={isWorking}>{it(CONTROL.reset)}</button></div>
      </section>
      <section class="result-panel gutter" data-state={gutterState} aria-live="polite" aria-atomic="true" aria-busy={isWorking ? "true" : "false"}>
        <p class="gutter-label eyebrow">{it(CONTROL.localResult)}</p>
        {result === null ? <p class="gutter-placeholder result-placeholder">{it(CONTROL.gutterIdle)}</p> : <>
          {inspection?.capabilities !== undefined && (
            <ul class="status-list">
              {inspection.capabilities.map((capability) => (
                <li key={capability.capability}>
                  <StatusMark kind={capability.available ? "ok" : "missing"} label={statusMarkLabel(capability.available ? "ok" : "missing")} />
                  {capability.available ? "Funzionalità disponibile" : "Funzionalità non disponibile"}
                </li>
              ))}
            </ul>
          )}
          {urls.length > 0 && <div class="actions">{urls.map((item) => <a class="button primary" href={item.url} download={item.filename} key={item.url}>{item.filename}</a>)}</div>}
          {typeof result.value === "object" && result.value !== null && typeof (result.value as { text?: unknown }).text === "string" && <textarea class="csv-preview" readOnly rows={8} value={(result.value as { text: string }).text} aria-label="Testo estratto" />}
          <details open><summary>Risultato strutturato</summary><pre class="csv-preview">{displayValue(result.value)}</pre></details>
        </>}
      </section>
    </form>
  );
}
