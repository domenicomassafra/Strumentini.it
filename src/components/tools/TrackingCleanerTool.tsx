import { useState } from "preact/hooks";
import { createBoundedTextPreview } from "../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../runtime/output-artifact";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { trackingCleanerManifest } from "../../tools/tracking-cleaner/manifest";
import type { TrackingCleanerOutput } from "../../tools/tracking-cleaner/types";
import {
  BoundedTextResultPreview,
  InlineError,
  ResultActions,
  ResultBreakdown,
  ResultInterpretation,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

interface TrackingCleanerBulkOutput {
  readonly rows: readonly {
    readonly sourceIndex: number;
    readonly sourceRow: number;
    readonly input: string;
    readonly value?: { readonly url: string; readonly dropped: readonly string[] };
    readonly error?: string;
  }[];
  readonly count: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly encodingPolicy: string;
  readonly duplicatePolicy: string;
  readonly engineVersion: string;
}

type CleanerResult = TrackingCleanerOutput | TrackingCleanerBulkOutput;

function isBulkResult(result: CleanerResult): result is TrackingCleanerBulkOutput {
  return "rows" in result;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TrackingCleanerTool() {
  const [url, setUrl] = useState("");
  const [bulk, setBulk] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<CleanerResult>(
    (signal: AbortSignal) => toolRuntime.run("tracking-cleaner", { url, bulk }, {}, signal),
    { formatError: () => "Inserisci un URL HTTP(S) valido." },
  );
  const result = operation.result;
  const bulkResult = result !== null && isBulkResult(result) ? result : null;
  const singleResult = result !== null && !isBulkResult(result) ? result : null;
  const text = bulkResult === null
    ? singleResult?.url ?? ""
    : bulkResult.rows.map((row) => row.value?.url ?? `Riga ${row.sourceRow}: ERRORE ${row.error ?? "INVALID_URL"}`).join("\n");
  const artifact = result === null ? null : createOutputArtifactDescriptor({
    kind: "text",
    name: "url-pulito.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode(text),
    verification: { state: "verified", verifiedMime: "text/plain", method: "local tracking-cleaner serializer" },
    fidelity: "lossless",
    fidelityNote: bulkResult === null
      ? "Il file contiene esattamente l'URL pulito mostrato nel risultato."
      : "Il file conserva le righe valide e annota gli errori con la riga sorgente.",
  });
  const preview = artifact === null ? null : createBoundedTextPreview(artifact, 8, "code");
  const actions = artifact === null ? [] : resolveResultActions({
    declaration: trackingCleanerManifest.result,
    primary: "copy",
    hasCopyPayload: text !== "",
    artifact,
    reuseReady: singleResult !== null,
    resetReady: true,
  });

  function submit(event: Event) {
    event.preventDefault();
    setActionStatus("");
    void operation.run();
  }

  function reset() {
    setUrl("");
    setBulk(false);
    setActionStatus("");
    operation.reset();
  }

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    await navigator.clipboard.writeText(text);
    setActionStatus("URL pulito copiato.");
  }

  function reuseResult() {
    if (singleResult === null) return;
    setUrl(singleResult.url);
    operation.reset();
    setActionStatus("L'URL pulito è stato riusato come nuovo input.");
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit}>
        <label class="field">
          <span>{bulk ? "URL da pulire, uno per riga" : "URL da pulire"}</span>
          <textarea aria-label="URL da pulire" rows={bulk ? 7 : 4} value={url} onInput={(event) => setUrl(event.currentTarget.value)} />
        </label>
        <label class="checkbox-field"><input aria-label="Modalità bulk tracking cleaner" type="checkbox" checked={bulk} onChange={(event) => setBulk(event.currentTarget.checked)} /> <span>Modalità bulk: conserva indice/riga sorgente e isola gli errori</span></label>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Rimuovi parametri di tracciamento</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder="Qui appariranno l'URL pulito e le chiavi rimosse." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && preview !== null && artifact !== null && (
          <div data-result-class="text-code">
            <ResultInterpretation state={bulkResult !== null && bulkResult.errorCount > 0 ? "warning" : "success"}>{bulkResult !== null ? `${bulkResult.successCount} URL puliti su ${bulkResult.count}; gli errori sono isolati per riga.` : singleResult?.dropped.length === 0 ? "L'URL era già privo dei parametri di tracciamento riconosciuti." : "I parametri di tracciamento riconosciuti sono stati rimossi preservando gli altri parametri e il frammento."}</ResultInterpretation>
            <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={preview} /></div>
            <div data-result-slot="counts"><ResultBreakdown label="Dettaglio" rows={bulkResult !== null ? [
              { label: "Righe", value: String(bulkResult.count) },
              { label: "Valide", value: String(bulkResult.successCount) },
              { label: "Errori", value: String(bulkResult.errorCount) },
            ] : [
              { label: "Parametri rimossi", value: singleResult?.dropped.length === 0 ? "Nessuno — URL già pulito" : singleResult?.dropped.join(", ") ?? "Nessuno" },
              { label: "Caratteri URL", value: String([...text].length) },
              { label: "Byte", value: String(artifact.byteLength) },
            ]} /></div>
            <p class="file-note">{result.duplicatePolicy} {result.encodingPolicy}</p>
            <ResultActions actions={actions} onAction={{ copy: copyResult, download: () => downloadText(artifact.download.filename, text), reuse: reuseResult, reset }} />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
