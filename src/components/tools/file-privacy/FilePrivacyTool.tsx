import { useRef, useState } from "preact/hooks";
import type { FilePrivacyOperation, FilePrivacyResult } from "../../../engines/file-privacy";
import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";
import { InlineError, ToolActions, ToolCancelButton, ToolOperation, ToolResetButton, ToolResultPanel, ToolSubmitButton } from "../shared";
import { CONTROL, it } from "../shared/controlLabels";

export interface FilePrivacyToolProps {
  operation: FilePrivacyOperation;
  title: string;
  description: string;
  directory?: boolean;
}

function filesFromInput(input: HTMLInputElement): File[] {
  return input.files === null ? [] : [...input.files];
}

// Every code the local file engine can raise must read as an instruction in
// Italian: a machine code is never shown to a visitor, and an unmapped code
// never leaks the internal vocabulary into the page.
const FILE_PRIVACY_ERROR_IT: Readonly<Record<string, string>> = {
  INVALID_INPUT: "Controlla i dati selezionati: almeno un file o un nome valido è necessario.",
  UNSUPPORTED_INPUT: "Questo tipo di file non è supportato da questo strumento.",
  FILE_TOO_LARGE: "La selezione supera il limite locale di dimensione previsto da questo strumento.",
  TOO_MANY_FILES: "Hai selezionato troppi file. Riduci la selezione.",
  TEXT_TOO_LARGE: "Il file di testo supera il limite locale previsto da questo strumento.",
  CORRUPT_ARCHIVE: "Non è stato possibile validare la struttura dell'archivio. Verifica che il file ZIP sia completo.",
  UNSUPPORTED_ARCHIVE: "Questo archivio usa una funzione che lo strumento non supporta.",
  ARCHIVE_TOO_LARGE: "L'archivio supera il limite locale previsto da questo strumento.",
  UNSAFE_ARCHIVE_PATH: "Un percorso è assoluto oppure contiene un segmento che risale alla cartella superiore.",
  HASH_FAILED: "Non è stato possibile calcolare l'hash SHA-256 su questo dispositivo.",
  IO_FAILED: "Non è stato possibile leggere i file selezionati. Riprova.",
  CANCELLED: "Operazione annullata.",
};

export function filePrivacyErrorIt(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
  if (code !== null) return FILE_PRIVACY_ERROR_IT[code] ?? "L'elaborazione locale non è riuscita. Controlla i file selezionati e riprova.";
  return error instanceof Error ? "L'operazione locale non è riuscita. Controlla i dati e riprova." : "L'operazione locale non è riuscita.";
}

function operationNeedsFiles(operation: FilePrivacyOperation): boolean {
  return operation !== "filename-sanitizer" && operation !== "batch-rename-preview";
}

function operationUsesDiff(operation: FilePrivacyOperation): boolean {
  return operation === "file-list-diff" || operation === "folder-compare";
}

function operationUsesText(operation: FilePrivacyOperation): boolean {
  return operation === "secret-token-pattern-scanner" || operation === "checksum-verifier";
}

function operationUsesNames(operation: FilePrivacyOperation): boolean {
  return operation === "filename-sanitizer" || operation === "batch-rename-preview";
}

function resultText(result: FilePrivacyResult | null): string {
  if (result === null) return "";
  const output: Record<string, unknown> = { ...result };
  delete output.operation;
  if (output.blob instanceof Blob) delete output.blob;
  const keys: Readonly<Record<string, string>> = {
    filename: "nome_file",
    files: "file",
    count: "quantità",
    total: "totale",
    size: "dimensione",
    totalBytes: "byte_totali",
    hash: "hash",
    digest: "hash",
    sha256: "sha256",
    manifest: "manifest",
    warnings: "avvisi",
    warning: "avviso",
    findings: "risultati",
    matches: "corrispondenze",
    duplicates: "duplicati",
    missing: "mancanti",
    changed: "modificati",
    added: "aggiunti",
    removed: "rimossi",
    renamed: "rinominati",
    entries: "voci",
    path: "percorso",
    name: "nome",
    original: "originale",
    sanitized: "ripulito",
    risk: "rischio",
    risks: "rischi",
    valid: "valido",
  };
  const localize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(localize);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [keys[key] ?? key, localize(item)]));
  };
  return JSON.stringify(localize(output), null, 2);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function FilePrivacyTool({ operation, title, description, directory = false }: FilePrivacyToolProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [names, setNames] = useState("");
  const [pattern, setPattern] = useState("{name}{ext}");
  const [references, setReferences] = useState("");
  const [includeHashes, setIncludeHashes] = useState(true);
  const [result, setResult] = useState<FilePrivacyResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  function reset() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setFiles([]);
    setBeforeFiles([]);
    setAfterFiles([]);
    setText("");
    setNames("");
    setPattern("{name}{ext}");
    setReferences("");
    setResult(null);
    setError("");
    setRunning(false);
  }

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    setResult(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    try {
      const parsedNames = names.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
      const input: Record<string, unknown> = {
        ...(operationNeedsFiles(operation) || operationUsesDiff(operation) ? { files } : {}),
        ...(operationUsesDiff(operation) ? { before: beforeFiles, after: afterFiles } : {}),
        ...(operationUsesText(operation) ? { expected: text } : {}),
        ...(operation === "secret-token-pattern-scanner" ? { text } : {}),
        ...(operationUsesNames(operation) ? (parsedNames.length > 0 ? { names: parsedNames } : files.length > 0 ? { files } : { names: parsedNames }) : {}),
        ...(operation === "batch-rename-preview" ? { pattern } : {}),
        ...(operation === "zero-byte-orphan-finder" ? { references } : {}),
        ...(operation === "client-handoff-index-generator" ? { includeHashes } : {}),
        ...((operation === "file-list-diff" || operation === "folder-compare") ? { compareHashes: includeHashes } : {}),
      };
      const { runFilePrivacyOperation } = await import("../../../engines/file-privacy");
      const next = await runFilePrivacyOperation(operation, input, controller.signal);
      if (!controller.signal.aborted) setResult(next);
    } catch (caught) {
      if (!controller.signal.aborted) setError(filePrivacyErrorIt(caught));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setRunning(false);
    }
  }

  const showFilePicker = operationNeedsFiles(operation) || operationUsesDiff(operation) || operationUsesNames(operation);
  const showSingleFilePicker = operation === "zip-contents-inspector" || operation === "archive-checksum-manifest";
  const showPastedText = operation === "secret-token-pattern-scanner";
  const showNames = operationUsesNames(operation);
  const showExpected = operation === "checksum-verifier";
  const resultFilename = typeof result?.filename === "string" ? result.filename : `${operation}.txt`;
  const gutterState = running ? "running" : error !== "" ? "error" : result === null ? "idle" : "success";
  const publicCopy = TOOL_COPY_IT[operation];
  const publicTitle = publicCopy?.name ?? title;
  const publicDescription = publicCopy?.summary ?? description;

  return (
    <ToolOperation busy={running}>
      <form onSubmit={submit} noValidate>
        {showFilePicker && !operationUsesDiff(operation) && (
          <label class="field">
            <span>{directory ? "File della cartella" : "File"}</span>
            <input
              type="file"
              multiple={!showSingleFilePicker}
              required={operation !== "secret-token-pattern-scanner" && !operationUsesNames(operation)}
              onChange={(event) => setFiles(filesFromInput(event.currentTarget))}
              {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})}
            />
            <small>{files.length === 0 ? "Scegli file locali: il contenuto resta su questo dispositivo." : `${files.length} ${files.length === 1 ? "file selezionato" : "file selezionati"}`}</small>
          </label>
        )}
        {operationUsesDiff(operation) && (
          <div class="field-grid">
            <label class="field">
              <span>File prima della modifica</span>
              <input type="file" multiple required onChange={(event) => setBeforeFiles(filesFromInput(event.currentTarget))} {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})} />
              <small>{beforeFiles.length} selezionati</small>
            </label>
            <label class="field">
              <span>File dopo la modifica</span>
              <input type="file" multiple required onChange={(event) => setAfterFiles(filesFromInput(event.currentTarget))} {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})} />
              <small>{afterFiles.length} selezionati</small>
            </label>
          </div>
        )}
        {showPastedText && (
          <label class="field">
            <span>Testo da analizzare <em>facoltativo se hai selezionato dei file</em></span>
            <textarea rows={8} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="Incolla un breve testo oppure scegli un file di testo locale qui sopra." />
          </label>
        )}
        {showExpected && (
          <label class="field">
            <span>Checksum attesi</span>
            <textarea rows={5} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="sha256  path/to/file" />
            <small>Inserisci un hash SHA-256 e un percorso per riga. Maiuscole/minuscole esadecimali e spazi esterni vengono normalizzati.</small>
          </label>
        )}
        {showNames && (
          <>
            <label class="field">
              <span>{showFilePicker ? "Nomi file o nomi da trasformare" : "Nomi"}</span>
              <textarea rows={5} value={names} onInput={(event) => setNames(event.currentTarget.value)} placeholder="Un nome per riga" />
            </label>
            {operation === "batch-rename-preview" && (
              <label class="field">
                <span>Schema di rinomina</span>
                <input value={pattern} onInput={(event) => setPattern(event.currentTarget.value)} placeholder="{name}-{index}{ext}" />
                <small>Segnaposto: <code>{"{name}"}</code>, <code>{"{index}"}</code>, <code>{"{ext}"}</code>.</small>
              </label>
            )}
          </>
        )}
        {operation === "zero-byte-orphan-finder" && (
          <label class="field">
            <span>Percorsi referenziati <em>facoltativi</em></span>
            <textarea rows={5} value={references} onInput={(event) => setReferences(event.currentTarget.value)} placeholder="Un percorso referenziato per riga" />
          </label>
        )}
        {(operation === "client-handoff-index-generator" || operation === "file-list-diff" || operation === "folder-compare") && (
          <label class="check-field">
            <input type="checkbox" checked={includeHashes} onChange={(event) => setIncludeHashes(event.currentTarget.checked)} />
            <span>{operation === "client-handoff-index-generator" ? "Includi gli hash SHA-256 nell'indice di consegna" : "Confronta con SHA-256 i file della stessa dimensione"}</span>
          </label>
        )}
        <InlineError message={error} />
        <ToolActions>
          <ToolSubmitButton busy={running} busyLabel={it(CONTROL.working)}>Esegui in locale</ToolSubmitButton>
          {running && <ToolCancelButton onCancel={() => controllerRef.current?.abort()} />}
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={`${publicTitle} — risultato`} placeholder={publicDescription} busy={running} state={gutterState}>
        {result !== null && (
          <>
            {result.blob instanceof Blob && (
              <div class="actions"><button class="primary" type="button" onClick={() => downloadBlob(result.blob as Blob, resultFilename)}>{it(CONTROL.download)}</button></div>
            )}
            {typeof result.manifest === "string" && <pre class="result-code">{result.manifest}</pre>}
            {typeof result.markdown === "string" && <pre class="result-code">{result.markdown}</pre>}
            {typeof result.json === "string" && <pre class="result-code">{result.json}</pre>}
            <pre class="result-code">{resultText(result)}</pre>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
