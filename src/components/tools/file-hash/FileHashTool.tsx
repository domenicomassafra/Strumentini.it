import { useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import { FileHashError, checksumMatches, parseExpectedChecksum } from "../../../engines/file-hash";
import { hashBlobInWorker } from "../../../engines/file-hash/worker-client";
import {
  InlineError,
  ToolActions,
  ToolCancelButton,
  ToolOperation,
  ToolProgress,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
} from "../shared";
import { CONTROL, it } from "../shared/controlLabels";

interface CompletedHash {
  digestHex: string;
  bytesHashed: number;
  matchesExpected: boolean | null;
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "Calcolo dell'hash annullato.";
  if (error instanceof FileHashError) {
    if (error.code === "MALFORMED_CHECKSUM") return "Lo SHA-256 atteso deve contenere esattamente 64 caratteri esadecimali.";
    if (error.code === "UNSUPPORTED_ALGORITHM") return "Questo strumento supporta attualmente soltanto SHA-256.";
    if (error.code === "READ_FAILURE") return "Non è stato possibile leggere il file selezionato. Selezionalo di nuovo e riprova.";
    if (error.code === "WORKER_FAILURE") return "Il processo locale di calcolo dell'hash non è riuscito. Riprova.";
  }
  return "Il calcolo dell'hash non è riuscito.";
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

export function FileHashTool() {
  const [file, setFile] = useState<File | null>(null);
  const [expectedChecksum, setExpectedChecksum] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompletedHash | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const gutterState = running ? "running" : error !== "" ? "error" : result === null ? "idle" : "success";

  async function submit(event: Event) {
    event.preventDefault();
    if (controllerRef.current !== null) return;
    setError("");
    setResult(null);
    setProgress(0);
    if (file === null) {
      setError("Scegli un file su cui calcolare l'hash.");
      return;
    }

    let normalizedExpected: string | null = null;
    try {
      normalizedExpected = expectedChecksum.trim() === "" ? null : parseExpectedChecksum(expectedChecksum);
    } catch (caught) {
      setError(friendlyError(caught));
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    try {
      const hashed = await hashBlobInWorker(file, {
        signal: controller.signal,
        onProgress(update) {
          if (!controller.signal.aborted && controllerRef.current === controller) setProgress(update.fraction);
        },
      });
      if (controller.signal.aborted) return;
      if (controllerRef.current !== controller) return;
      setResult({
        digestHex: hashed.digestHex,
        bytesHashed: hashed.bytesHashed,
        matchesExpected: normalizedExpected === null ? null : checksumMatches(hashed.digestHex, normalizedExpected),
      });
      setProgress(1);
      recordCompletedTool("file-hash");
    } catch (caught) {
      if (controllerRef.current === controller && !controller.signal.aborted) setError(friendlyError(caught));
    } finally {
      if (controllerRef.current === controller) { controllerRef.current = null; setRunning(false); }
    }
  }

  function reset() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setFile(null);
    setExpectedChecksum("");
    setProgress(0);
    setResult(null);
    setError("");
    setRunning(false);
    const picker = document.getElementById("file-hash-picker") as HTMLInputElement | null;
    if (picker !== null) picker.value = "";
  }

  return (
    <ToolOperation busy={running}>
      <form onSubmit={submit} noValidate>
        <label class="field">
          <span>File</span>
          <input
            id="file-hash-picker"
            required
            type="file"
            disabled={running}
            onChange={(event) => {
              setFile(event.currentTarget.files?.item(0) ?? null);
              setResult(null);
              setError("");
              setProgress(0);
            }}
          />
          <small>{file === null ? "Qualsiasi tipo di file · elaborazione locale" : `${file.name} · ${formatBytes(file.size)}`}</small>
        </label>

        <label class="field">
          <span>SHA-256 atteso <em>facoltativo</em></span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellcheck={false}
            value={expectedChecksum}
            disabled={running}
            placeholder="64 caratteri esadecimali"
            onInput={(event) => {
              setExpectedChecksum(event.currentTarget.value);
              setResult(null);
            }}
            aria-describedby="checksum-help"
          />
          <small id="checksum-help">Vengono normalizzati soltanto gli spazi esterni e le maiuscole/minuscole delle cifre esadecimali.</small>
        </label>

        <ToolProgress
          value={progress}
          label="Avanzamento del calcolo"
          status={running ? `${Math.floor(progress * 100)}% completato` : result === null ? "Non avviato" : "100% completato"}
        />

        <InlineError message={error} />

        <ToolActions>
          <ToolSubmitButton busy={running} busyLabel={it(CONTROL.working)}>Calcola SHA-256</ToolSubmitButton>
          {running && <ToolCancelButton onCancel={() => controllerRef.current?.abort()} />}
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>

      <ToolResultPanel eyebrow="Risultato" placeholder={it(CONTROL.gutterIdle)} busy={running} state={gutterState}>
        {result !== null && (
          <>
            {result.matchesExpected !== null && (
              <strong class="gutter-value">{result.matchesExpected ? "Il checksum corrisponde" : "Il checksum non corrisponde"}</strong>
            )}
            <code style={{ overflowWrap: "anywhere" }}>{result.digestHex}</code>
            <dl class="assumptions">
              <div><dt>Algoritmo</dt><dd>SHA-256</dd></div>
              <div><dt>Byte elaborati</dt><dd>{formatBytes(result.bytesHashed)}</dd></div>
              <div><dt>Elaborazione</dt><dd>Processo locale · blocchi di dimensione limitata</dd></div>
            </dl>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
