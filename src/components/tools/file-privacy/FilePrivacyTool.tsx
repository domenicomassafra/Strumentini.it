import { useRef, useState } from "preact/hooks";
import type { FilePrivacyOperation, FilePrivacyResult } from "../../../engines/file-privacy";
import { FilePrivacyError, runFilePrivacyOperation } from "../../../engines/file-privacy";
import { InlineError, ToolActions, ToolCancelButton, ToolOperation, ToolResetButton, ToolResultPanel, ToolSubmitButton } from "../shared";

export interface FilePrivacyToolProps {
  operation: FilePrivacyOperation;
  title: string;
  description: string;
  directory?: boolean;
}

function filesFromInput(input: HTMLInputElement): File[] {
  return input.files === null ? [] : [...input.files];
}

function errorText(error: unknown): string {
  if (error instanceof FilePrivacyError) {
    if (error.code === "FILE_TOO_LARGE") return "The selection exceeds this tool's local size limit.";
    if (error.code === "TOO_MANY_FILES") return "Too many files were selected. Choose a smaller bounded selection.";
    if (error.code === "UNSAFE_ARCHIVE_PATH") return "A path was absolute or contained a parent-directory segment.";
    if (error.code === "CORRUPT_ARCHIVE") return "The archive directory could not be validated. Check that it is a complete ZIP file.";
    if (error.code === "CANCELLED") return "Operation cancelled.";
    return error.message.replace(/^[A-Z_]+:\s*/u, "");
  }
  return error instanceof Error ? error.message : "The local operation failed.";
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
  return JSON.stringify(output, null, 2);
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
  const [pattern, setPattern] = useState("{name}");
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
    setPattern("{name}");
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
      const next = await runFilePrivacyOperation(operation, input, controller.signal);
      if (!controller.signal.aborted) setResult(next);
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorText(caught));
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

  return (
    <ToolOperation busy={running}>
      <form onSubmit={submit} noValidate>
        {showFilePicker && !operationUsesDiff(operation) && (
          <label class="field">
            <span>{directory ? "Folder files" : "Files"}</span>
            <input
              type="file"
              multiple={!showSingleFilePicker}
              required={operation !== "secret-token-pattern-scanner" && !operationUsesNames(operation)}
              onChange={(event) => setFiles(filesFromInput(event.currentTarget))}
              {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})}
            />
            <small>{files.length === 0 ? "Choose local files; contents stay on this device." : `${files.length} file${files.length === 1 ? "" : "s"} selected`}</small>
          </label>
        )}
        {operationUsesDiff(operation) && (
          <div class="field-grid">
            <label class="field">
              <span>Before files</span>
              <input type="file" multiple required onChange={(event) => setBeforeFiles(filesFromInput(event.currentTarget))} {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})} />
              <small>{beforeFiles.length} selected</small>
            </label>
            <label class="field">
              <span>After files</span>
              <input type="file" multiple required onChange={(event) => setAfterFiles(filesFromInput(event.currentTarget))} {...(directory ? ({ webkitdirectory: true } as Record<string, boolean>) : {})} />
              <small>{afterFiles.length} selected</small>
            </label>
          </div>
        )}
        {showPastedText && (
          <label class="field">
            <span>Text to scan <em>optional when files are selected</em></span>
            <textarea rows={8} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="Paste a small text sample or choose a local text file above." />
          </label>
        )}
        {showExpected && (
          <label class="field">
            <span>Expected checksums</span>
            <textarea rows={5} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="sha256  path/to/file" />
            <small>One SHA-256 digest and path per line. Hex letter case and surrounding whitespace are normalized.</small>
          </label>
        )}
        {showNames && (
          <>
            <label class="field">
              <span>{showFilePicker ? "File names or names to transform" : "Names"}</span>
              <textarea rows={5} value={names} onInput={(event) => setNames(event.currentTarget.value)} placeholder="One name per line" />
            </label>
            {operation === "batch-rename-preview" && (
              <label class="field">
                <span>Rename pattern</span>
                <input value={pattern} onInput={(event) => setPattern(event.currentTarget.value)} placeholder="{name}-{index}" />
                <small>Placeholders: <code>{"{name}"}</code>, <code>{"{index}"}</code>, <code>{"{ext}"}</code>.</small>
              </label>
            )}
          </>
        )}
        {operation === "zero-byte-orphan-finder" && (
          <label class="field">
            <span>Referenced paths <em>optional</em></span>
            <textarea rows={5} value={references} onInput={(event) => setReferences(event.currentTarget.value)} placeholder="One referenced path per line" />
          </label>
        )}
        {(operation === "client-handoff-index-generator" || operation === "file-list-diff" || operation === "folder-compare") && (
          <label class="check-field">
            <input type="checkbox" checked={includeHashes} onChange={(event) => setIncludeHashes(event.currentTarget.checked)} />
            <span>{operation === "client-handoff-index-generator" ? "Include SHA-256 digests in the handoff index" : "Compare same-size files by SHA-256"}</span>
          </label>
        )}
        <InlineError message={error} />
        <ToolActions>
          <ToolSubmitButton busy={running} busyLabel="Working…">Run locally</ToolSubmitButton>
          {running && <ToolCancelButton onCancel={() => controllerRef.current?.abort()} />}
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={`${title} result`} placeholder={description} busy={running}>
        {result !== null && (
          <>
            {result.blob instanceof Blob && (
              <button class="primary" type="button" onClick={() => downloadBlob(result.blob as Blob, resultFilename)}>Download result</button>
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
