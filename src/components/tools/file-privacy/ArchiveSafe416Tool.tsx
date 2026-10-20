import { useEffect, useRef, useState } from "preact/hooks";
import type { Archive416Action, Archive416Output, Archive416Result } from "../../../engines/archive-safe";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import { InlineError, ToolActions, ToolCancelButton, ToolOperation, ToolResetButton, ToolResultPanel, ToolSubmitButton } from "../shared";

const REASONS: Readonly<Record<string, string>> = {
  INVALID_INPUT: "Seleziona file validi rispettando i limiti indicati.",
  UNSUPPORTED_ARCHIVE: "Formato o archivio annidato non supportato. ZIP64 e file cifrati sono rifiutati.",
  CORRUPT_ARCHIVE: "La struttura, il flusso compresso o il CRC32 non corrisponde: estrazione rifiutata.",
  UNSAFE_ARCHIVE_PATH: "Percorso ambiguo, link, percorso assoluto o duplicato: estrazione rifiutata.",
  ARCHIVE_TOO_LARGE: "Dimensione, numero di file o rapporto di espansione oltre il limite locale.",
  CANCELLED: "Operazione annullata.",
};

function download416(output: Archive416Output): void {
  const url = URL.createObjectURL(output.blob);
  try {
    const link = document.createElement("a");
    link.download = output.name;
    link.href = url;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }
}

export function ArchiveSafe416Tool() {
  const [action, setAction] = useState<Archive416Action>("create-zip");
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Archive416Result | null>(null);
  const [error, setError] = useState("");
  const active = useRef<Worker | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stop() {
    active.current?.terminate();
    active.current = null;
    if (deadline.current !== null) clearTimeout(deadline.current);
    deadline.current = null;
    setRunning(false);
  }
  useEffect(() => () => {
    active.current?.terminate();
    if (deadline.current !== null) clearTimeout(deadline.current);
  }, []);
  function reset() {
    stop();
    setFiles([]);
    setResult(null);
    setError("");
  }
  function cancel() {
    stop();
    setResult(null);
    setError("Operazione annullata: nessun file parziale disponibile.");
  }
  function selectAction(next: Archive416Action) {
    if (next === action) return;
    reset();
    setAction(next);
  }
  function chooseFiles(next: FileList | null) {
    setFiles(next ? Array.from(next) : []);
    setResult(null);
    setError("");
  }
  function submit(event: Event) {
    event.preventDefault();
    if (active.current || files.length === 0) return;
    setResult(null);
    setError("");
    setRunning(true);
    let worker: Worker;
    try {
      worker = new Worker(new URL("./archive-worker-416.ts", import.meta.url), { type: "module" });
    } catch {
      setError("Web Worker non disponibile su questo dispositivo.");
      setRunning(false);
      return;
    }
    active.current = worker;
    deadline.current = setTimeout(() => {
      if (active.current !== worker) return;
      stop();
      setError("Tempo massimo di elaborazione (15 secondi) superato. Nessun file prodotto.");
    }, 15_000);
    worker.onmessage = (message: MessageEvent<{ok: boolean; code?: string; result?: Archive416Result}>) => {
      if (active.current !== worker) return;
      stop();
      if (message.data.ok && message.data.result) {
        setResult(message.data.result);
        recordCompletedTool("zip-creator");
      } else setError(REASONS[message.data.code ?? ""] ?? "Archivio non valido o non verificabile.");
    };
    worker.onerror = () => {
      if (active.current !== worker) return;
      stop();
      setError("Il processo isolato non ha completato la verifica dell'archivio.");
    };
    worker.postMessage({ action, files });
  }
  const isExtract = action === "extract";

  return <ToolOperation busy={running}>
    <form onSubmit={submit}>
      <fieldset class="field" disabled={running}>
        <legend>Operazione archivio</legend>
        <label class="check-field"><input type="radio" name="archive416-mode" value="create-zip" checked={action === "create-zip"} onChange={() => selectAction("create-zip")} /> <span>Comprimi ZIP</span></label>
        <label class="check-field"><input type="radio" name="archive416-mode" value="create-gzip" checked={action === "create-gzip"} onChange={() => selectAction("create-gzip")} /> <span>Comprimi GZIP (un .gz per file)</span></label>
        <label class="check-field"><input type="radio" name="archive416-mode" value="extract" checked={isExtract} onChange={() => selectAction("extract")} /> <span>Estrai ZIP o GZIP</span></label>
      </fieldset>
      <label class="field">
        <span>{isExtract ? "Archivio da estrarre" : "File locali da comprimere"}</span>
        <input key={action} type="file" accept={isExtract ? ".zip,.gz" : undefined}
          disabled={running} required multiple={!isExtract}
          onChange={(event) => chooseFiles(event.currentTarget.files)} />
        <small>{isExtract
          ? "1 ZIP/GZIP fino a 12 MiB; massimo 32 file estratti, 8 MiB per voce, 24 MiB totali e rapporto 250:1."
          : "Massimo 32 file ZIP o 8 file GZIP; 8 MiB per file, 24 MiB totali. Compressione DEFLATE reale."}
          {" "}Tutto resta nel browser: nessun percorso viene creato sul dispositivo fino al download esplicito.</small>
      </label>
      <InlineError message={error} />
      <ToolActions>
        <ToolSubmitButton busy={running} disabled={files.length === 0} busyLabel="Verifica in corso…">Esegui in locale</ToolSubmitButton>
        {running && <ToolCancelButton onCancel={cancel} />}
        <ToolResetButton onClick={reset} disabled={running} />
      </ToolActions>
    </form>
    <ToolResultPanel eyebrow="Archivio verificato" placeholder="Scegli i file e avvia l'elaborazione."
      busy={running} state={error ? "error" : result ? "success" : "idle"}>
      {result && <div data-archive-416-result>
        <p>{result.entries.length} {result.entries.length === 1 ? "voce verificata" : "voci verificate"} · {result.format.toUpperCase()} · nessun file inviato in rete.</p>
        <ol>
          {result.entries.map((entry) => <li key={entry.name}>
            <strong>{entry.name}</strong> — completato, {entry.sourceBytes} → {entry.resultBytes} byte ({entry.method})
          </li>)}
        </ol>
        <p>File disponibili solo dopo la verifica completa di ogni voce.</p>
        <ul>
          {result.outputs.map((output) => <li key={output.name}>
            <button type="button" data-archive-416-download onClick={() => download416(output)}>
              Scarica {output.name} ({output.bytes} byte)
            </button>
          </li>)}
        </ul>
      </div>}
    </ToolResultPanel>
  </ToolOperation>;
}
