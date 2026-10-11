import { useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import type { FilePrivacyOperation } from "../../../engines/file-privacy";
import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";
import { InlineError, ToolActions, ToolCancelButton, ToolOperation, ToolResetButton, ToolResultPanel, ToolSubmitButton } from "../shared";
import { CONTROL, it } from "../shared/controlLabels";
import { FilePrivacyResultV2, prepareFilePrivacyResult, type PreparedFilePrivacyResult } from "./FilePrivacyResultV2";

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
  return operation === "secret-token-pattern-scanner" || operation === "checksum-verifier" || operation === "ai-code-fence-bundle";
}

function operationUsesNames(operation: FilePrivacyOperation): boolean {
  return operation === "filename-sanitizer" || operation === "batch-rename-preview";
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
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);
  const [sensitiveContentReviewed, setSensitiveContentReviewed] = useState(false);
  const [result, setResult] = useState<PreparedFilePrivacyResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // A completed result belongs to the exact input/options that produced it.
  // Never display or offer actions for that result after any subsequent edit.
  function invalidateResult() {
    setResult(null);
    setError("");
  }

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
    setRecipientConfirmed(false);
    setSensitiveContentReviewed(false);
    setResult(null);
    setError("");
    setRunning(false);
  }

  function buildInput(): Record<string, unknown> {
    const parsedNames = names.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
    return {
      ...(operationNeedsFiles(operation) || operationUsesDiff(operation) ? { files } : {}),
      ...(operationUsesDiff(operation) ? { before: beforeFiles, after: afterFiles } : {}),
      ...(operationUsesText(operation) ? { expected: text } : {}),
      ...(operation === "ai-code-fence-bundle" ? { text } : {}),
      ...(operation === "secret-token-pattern-scanner" ? { text } : {}),
      ...(operationUsesNames(operation) ? (parsedNames.length > 0 ? { names: parsedNames } : files.length > 0 ? { files } : { names: parsedNames }) : {}),
      ...(operation === "batch-rename-preview" ? { pattern } : {}),
      ...(operation === "zero-byte-orphan-finder" ? { references } : {}),
      ...(operation === "client-handoff-index-generator" ? { includeHashes } : {}),
      ...(operation === "safe-share-checklist" ? { recipientConfirmed, sensitiveContentReviewed } : {}),
      ...((operation === "file-list-diff" || operation === "folder-compare") ? { compareHashes: includeHashes } : {}),
    };
  }

  async function runOperation() {
    if (controllerRef.current !== null) return;
    setError("");
    setResult(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    try {
      const input = buildInput();
      const { runFilePrivacyOperation } = await import("../../../engines/file-privacy");
      const next = await runFilePrivacyOperation(operation, input, controller.signal);
      const prepared = await prepareFilePrivacyResult(operation, next, input);
      if (!controller.signal.aborted && controllerRef.current === controller) {
        setResult(prepared);
        recordCompletedTool(operation);
      }
    } catch (caught) {
      if (!controller.signal.aborted && controllerRef.current === controller) setError(filePrivacyErrorIt(caught));
    } finally {
      if (controllerRef.current === controller) { controllerRef.current = null; setRunning(false); }
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    await runOperation();
  }

  const showFilePicker = operationNeedsFiles(operation) || operationUsesDiff(operation) || operationUsesNames(operation);
  const showSingleFilePicker = operation === "zip-contents-inspector" || operation === "archive-checksum-manifest" || operation === "file-size-analyzer";
  const showPastedText = operation === "secret-token-pattern-scanner" || operation === "ai-code-fence-bundle";
  const showNames = operationUsesNames(operation);
  const showExpected = operation === "checksum-verifier";
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
              disabled={running}
              multiple={!showSingleFilePicker}
              required={operation !== "secret-token-pattern-scanner" && !operationUsesNames(operation)}
              onChange={(event) => { invalidateResult(); setFiles(filesFromInput(event.currentTarget)); }}
              {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})}
            />
            <small>{files.length === 0 ? "Scegli file locali: il contenuto resta su questo dispositivo." : `${files.length} ${files.length === 1 ? "file selezionato" : "file selezionati"}`}</small>
          </label>
        )}
        {operationUsesDiff(operation) && (
          <div class="field-grid">
            <label class="field">
              <span>File prima della modifica</span>
              <input type="file" multiple required disabled={running} onChange={(event) => { invalidateResult(); setBeforeFiles(filesFromInput(event.currentTarget)); }} {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})} />
              <small>{beforeFiles.length} selezionati</small>
            </label>
            <label class="field">
              <span>File dopo la modifica</span>
              <input type="file" multiple required disabled={running} onChange={(event) => { invalidateResult(); setAfterFiles(filesFromInput(event.currentTarget)); }} {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})} />
              <small>{afterFiles.length} selezionati</small>
            </label>
          </div>
        )}
        {showPastedText && (
          <label class="field">
            <span>{operation === "ai-code-fence-bundle" ? "Risposta con code fence" : <>Testo da analizzare <em>facoltativo se hai selezionato dei file</em></>}</span>
            <textarea
              rows={8}
              disabled={running}
              value={text}
              onInput={(event) => { invalidateResult(); setText(event.currentTarget.value); }}
              placeholder={operation === "ai-code-fence-bundle" ? "Incolla qui i blocchi di codice delimitati da tre backtick." : "Incolla un breve testo oppure scegli un file di testo locale qui sopra."}
            />
          </label>
        )}
        {showExpected && (
          <label class="field">
            <span>Checksum attesi</span>
            <textarea rows={5} disabled={running} value={text} onInput={(event) => { invalidateResult(); setText(event.currentTarget.value); }} placeholder="sha256  path/to/file" />
            <small>Inserisci un hash SHA-256 e un percorso per riga. Maiuscole/minuscole esadecimali e spazi esterni vengono normalizzati.</small>
          </label>
        )}
        {showNames && (
          <>
            <label class="field">
              <span>{showFilePicker ? "Nomi file o nomi da trasformare" : "Nomi"}</span>
              <textarea rows={5} disabled={running} value={names} onInput={(event) => { invalidateResult(); setNames(event.currentTarget.value); }} placeholder="Un nome per riga" />
            </label>
            {operation === "batch-rename-preview" && (
              <label class="field">
                <span>Schema di rinomina</span>
                <input disabled={running} value={pattern} onInput={(event) => { invalidateResult(); setPattern(event.currentTarget.value); }} placeholder="{name}-{index}{ext}" />
                <small>Segnaposto: <code>{"{name}"}</code>, <code>{"{index}"}</code>, <code>{"{ext}"}</code>.</small>
              </label>
            )}
          </>
        )}
        {operation === "zero-byte-orphan-finder" && (
          <label class="field">
            <span>Percorsi referenziati <em>facoltativi</em></span>
            <textarea rows={5} disabled={running} value={references} onInput={(event) => { invalidateResult(); setReferences(event.currentTarget.value); }} placeholder="Un percorso referenziato per riga" />
          </label>
        )}
        {(operation === "client-handoff-index-generator" || operation === "file-list-diff" || operation === "folder-compare") && (
          <label class="check-field">
            <input type="checkbox" disabled={running} checked={includeHashes} onChange={(event) => { invalidateResult(); setIncludeHashes(event.currentTarget.checked); }} />
            <span>{operation === "client-handoff-index-generator" ? "Includi gli hash SHA-256 nell'indice di consegna" : "Confronta con SHA-256 i file della stessa dimensione"}</span>
          </label>
        )}
        {operation === "safe-share-checklist" && (
          <fieldset class="field">
            <legend>Conferme del contesto di condivisione</legend>
            <label class="check-field"><input type="checkbox" disabled={running} checked={recipientConfirmed} onChange={(event) => { invalidateResult(); setRecipientConfirmed(event.currentTarget.checked); }} /><span>Ho verificato destinatario o pubblico previsto.</span></label>
            <label class="check-field"><input type="checkbox" disabled={running} checked={sensitiveContentReviewed} onChange={(event) => { invalidateResult(); setSensitiveContentReviewed(event.currentTarget.checked); }} /><span>Ho riesaminato il contesto sensibile che non può essere dedotto automaticamente dal file.</span></label>
            <small>Queste conferme sono locali e non vengono salvate: completano, ma non sostituiscono, i controlli automatici.</small>
          </fieldset>
        )}
        <InlineError message={error} />
        <ToolActions>
          <ToolSubmitButton busy={running} busyLabel={it(CONTROL.working)}>Esegui in locale</ToolSubmitButton>
          {running && <ToolCancelButton onCancel={() => controllerRef.current?.abort()} />}
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={`${publicTitle} — risultato`} placeholder={publicDescription} busy={running} state={gutterState}>
        {result !== null && <FilePrivacyResultV2 operation={operation} prepared={result} onRetry={runOperation} onReset={reset} />}
      </ToolResultPanel>
    </ToolOperation>
  );
}
