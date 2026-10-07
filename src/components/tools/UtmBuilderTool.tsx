import { useState } from "preact/hooks";
import { createBoundedTextPreview } from "../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../runtime/output-artifact";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { utmBuilderManifest } from "../../tools/utm-builder/manifest";
import type { UtmBuilderOutput } from "../../tools/utm-builder/types";
import {
  BoundedTextResultPreview,
  InlineError,
  ResultActions,
  ResultBreakdown,
  ResultInterpretation,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

interface UtmBuilderBulkOutput {
  readonly rows: readonly {
    readonly sourceIndex: number;
    readonly sourceRow: number;
    readonly input: string;
    readonly value?: { readonly url: string };
    readonly error?: string;
  }[];
  readonly count: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly encodingPolicy: string;
  readonly duplicatePolicy: string;
  readonly engineVersion: string;
}

type BuilderResult = UtmBuilderOutput | UtmBuilderBulkOutput;

function isBulkResult(result: BuilderResult): result is UtmBuilderBulkOutput {
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

export function UtmBuilderTool() {
  const [baseUrl, setBaseUrl] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [bulk, setBulk] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<BuilderResult>(
    (signal: AbortSignal) => toolRuntime.run("utm-builder", { baseUrl, source, medium, campaign, bulk }, {}, signal),
    { formatError: () => "Inserisci un URL HTTP(S) valido e i valori di sorgente, mezzo e campagna." },
  );
  const result = operation.result;
  const bulkResult = result !== null && isBulkResult(result) ? result : null;
  const singleResult = result !== null && !isBulkResult(result) ? result : null;
  const text = bulkResult === null
    ? singleResult?.url ?? ""
    : bulkResult.rows.map((row) => row.value?.url ?? `Riga ${row.sourceRow}: ERRORE ${row.error ?? "INVALID_URL"}`).join("\n");
  const artifact = result === null ? null : createOutputArtifactDescriptor({
    kind: "text",
    name: "campagna-utm.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode(text),
    verification: { state: "verified", verifiedMime: "text/plain", method: "local UTM URL serializer" },
    fidelity: "lossless",
    fidelityNote: bulkResult === null
      ? "Il file contiene esattamente l'URL UTM mostrato nel risultato."
      : "Il file conserva l'ordine delle righe valide e annota gli errori con la riga sorgente.",
  });
  const preview = artifact === null ? null : createBoundedTextPreview(artifact, 8, "code");
  const actions = artifact === null ? [] : resolveResultActions({
    declaration: utmBuilderManifest.result,
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
    setBaseUrl("");
    setSource("");
    setMedium("");
    setCampaign("");
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
    setActionStatus("URL della campagna copiato.");
  }

  function reuseResult() {
    if (singleResult === null) return;
    setBaseUrl(singleResult.url);
    operation.reset();
    setActionStatus("L'URL generato è stato riusato come URL di destinazione.");
  }

  return (
    <ToolOperation className="single-column" busy={operation.isRunning}>
      <form onSubmit={submit}>
        <ToolFormCard>
          <label class="field"><span>{bulk ? "URL di destinazione, uno per riga" : "URL di destinazione"}</span><textarea aria-label="URL di destinazione" rows={bulk ? 7 : 2} value={baseUrl} onInput={(event) => setBaseUrl(event.currentTarget.value)} placeholder="https://example.com/pagina?ref=sito#dettagli" /></label>
          <label class="checkbox-field"><input aria-label="Modalità bulk UTM builder" type="checkbox" checked={bulk} onChange={(event) => setBulk(event.currentTarget.checked)} /> <span>Modalità bulk: applica gli stessi valori UTM a ogni URL e isola gli errori per riga</span></label>
          <div class="field-grid"><label class="field"><span>Sorgente</span><input aria-label="Sorgente" value={source} onInput={(event) => setSource(event.currentTarget.value)} /></label><label class="field"><span>Mezzo</span><input aria-label="Mezzo" value={medium} onInput={(event) => setMedium(event.currentTarget.value)} /></label></div>
          <label class="field"><span>Campagna</span><input aria-label="Campagna" value={campaign} onInput={(event) => setCampaign(event.currentTarget.value)} /></label>
          <InlineError message={operation.error} />
          <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Crea URL</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
        </ToolFormCard>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder="L'URL della campagna apparirà qui." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && preview !== null && artifact !== null && (
          <div data-result-class="text-code">
            <ResultInterpretation state={bulkResult !== null && bulkResult.errorCount > 0 ? "warning" : "success"}>{bulkResult === null ? "URL generato preservando i parametri non UTM e il frammento dell'indirizzo di partenza." : `${bulkResult.successCount} URL generati su ${bulkResult.count}; ogni errore resta associato alla riga sorgente.`}</ResultInterpretation>
            <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={preview} /></div>
            <div data-result-slot="counts"><ResultBreakdown label="Dettaglio" rows={bulkResult === null ? [{ label: "Caratteri URL", value: String([...text].length) }, { label: "Byte", value: String(artifact.byteLength) }] : [{ label: "Righe", value: String(bulkResult.count) }, { label: "Valide", value: String(bulkResult.successCount) }, { label: "Errori", value: String(bulkResult.errorCount) }]} /></div>
            <p class="file-note">{result.duplicatePolicy} {result.encodingPolicy}</p>
            <ResultActions actions={actions} onAction={{ copy: copyResult, download: () => downloadText(artifact.download.filename, text), reuse: reuseResult, reset }} />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
