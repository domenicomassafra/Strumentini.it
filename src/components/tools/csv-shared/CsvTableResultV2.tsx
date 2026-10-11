import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ResultDeclaration } from "../../../catalog/manifest";
import { parseCsvTable } from "../../../engines/table/csv";
import { createBoundedTablePreview } from "../../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { readOutputFacts338 } from "../../../runtime/output-facts-338";
import { resolveResultActions } from "../../../runtime/result-actions";
import { requestBrowserDownload339 } from "../../../runtime/browser-download-339";
import { AUTO_DOWNLOAD_KEY_339, browserStorage339, changeAutoDownload339, readAutoDownload339 } from "../../../runtime/download-policy-339";
import {
  BoundedTableResultPreview,
  ResultActions,
  ResultBreakdown,
  ResultPrimaryAnswer,
  ResultProvenance,
  ToolResultPanel,
} from "../shared";
import type { AccessibleResultStatus } from "../shared/ResultAccessibility";

export interface CsvResultWarning {
  readonly code: string;
  readonly message: string;
  readonly row?: number;
}

export interface CsvResultMetric {
  readonly label: string;
  readonly value: string | number;
}

export interface CsvTableResultV2Props {
  readonly eyebrow: string;
  readonly placeholder: string;
  readonly state: AccessibleResultStatus;
  readonly output: string | null;
  readonly filename: string;
  readonly declaration: ResultDeclaration;
  readonly summaryLabel: string;
  readonly summaryValue: string;
  readonly metrics: readonly CsvResultMetric[];
  readonly warnings?: readonly CsvResultWarning[] | undefined;
  readonly provenance: string;
  readonly handoffTargetCount?: number;
  readonly onHandoff?: (() => void) | undefined;
  readonly onReset: () => void;
  readonly children?: ComponentChildren;
}

export function CsvTableResultV2({
  eyebrow,
  placeholder,
  state,
  output,
  filename,
  declaration,
  summaryLabel,
  summaryValue,
  metrics,
  warnings = [],
  provenance,
  handoffTargetCount = 0,
  onHandoff,
  onReset,
  children,
}: CsvTableResultV2Props) {
  const [actionStatus, setActionStatus] = useState("");
  // Keep SSR and hydration initial markup OFF, then read browser storage after mount.
  const [autoDownload,setAutoDownload]=useState(false);
  const autoTriggered=useRef(false);
  const completeOutput = output;
  const table = completeOutput === null ? null : parseCsvTable(completeOutput);
  const bytes = completeOutput === null ? null : new TextEncoder().encode(completeOutput);
  const artifact = bytes === null ? null : createOutputArtifactDescriptor({
    kind: "structured",
    name: filename,
    mime: "text/csv",
    bytes,
    verification: {
      state: "verified",
      verifiedMime: "text/csv",
      method: "CSV engine serializer output parsed again by the shared CSV parser",
    },
    fidelity: "structural",
    fidelityNote: "Il download contiene il CSV completo prodotto dal motore locale.",
  });
  useEffect(()=>{
    if(output===null || state==="idle" || state==="running") autoTriggered.current=false;
  },[output,state]);
  useEffect(()=>{
    if(state!=="success" || !autoDownload || artifact===null || !artifact.download.ready || autoTriggered.current) return;
    autoTriggered.current=true;
    setActionStatus(requestBrowserDownload339(artifact)
      ? "Download automatico richiesto al browser. Se bloccato, usa Scarica risultato."
      : "Download automatico non disponibile. Puoi provare Scarica risultato.");
  },[state,autoDownload,output,filename]);
  useEffect(()=>{
    autoTriggered.current=state==="success";
    setAutoDownload(readAutoDownload339(browserStorage339()));
    const onStorage=(event:StorageEvent)=>{
      if(event.key!==AUTO_DOWNLOAD_KEY_339 && event.key!==null) return;
      autoTriggered.current=state==="success";
      setAutoDownload(readAutoDownload339(browserStorage339()));
    };
    window.addEventListener("storage",onStorage);
    return ()=>window.removeEventListener("storage",onStorage);
  },[state]);

  if (output === null || table === null || artifact === null) {
    return <ToolResultPanel eyebrow={eyebrow} placeholder={placeholder} state={state} />;
  }
  const preview = createBoundedTablePreview(artifact, table.header, table.rows, 8);
  const outputFacts = readOutputFacts338(artifact);
  const actions = resolveResultActions({
    declaration,
    primary: "download",
    hasCopyPayload: completeOutput !== "",
    artifact,
    resetReady: true,
    ...(handoffTargetCount > 0
      ? { handoff: { type: "table" as const, format: "csv" as const, compatibleTargets: handoffTargetCount } }
      : {}),
  });

  async function copy() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili. Puoi selezionare i dati dall'anteprima.");
      return;
    }
    try {
      await navigator.clipboard.writeText(completeOutput!);
      setActionStatus("CSV completo copiato.");
    } catch {
      setActionStatus("Il browser ha bloccato gli appunti. Puoi selezionare i dati dall'anteprima.");
    }
  }

  function download() {
    setActionStatus(requestBrowserDownload339(artifact)
      ? "Download richiesto al browser. Se non parte, controlla le autorizzazioni ai download."
      : "Download non disponibile: file non verificato o rifiutato dal browser.");
  }

  function chooseAutoDownload(enabled:boolean) {
    // Never auto-download an already displayed CSV when granting consent.
    autoTriggered.current=state==="success";
    const { saved, persistedEnabled }=changeAutoDownload339(browserStorage339(),enabled);
    setAutoDownload(persistedEnabled === true);
    setActionStatus(saved ? (enabled
      ? "Download automatico attivo per le prossime operazioni. Puoi disattivarlo in qualsiasi momento."
      : "Download automatico disattivato. Il download manuale resta disponibile.")
      : persistedEnabled === true
        ? "Impossibile revocare la preferenza: il download automatico è ancora attivo nel browser. Riprova o cancella le preferenze del sito."
        : enabled
          ? "Impossibile salvare la preferenza nel browser: download automatico non attivato."
          : "Impossibile confermare la revoca nel browser. Controlla le preferenze del sito prima di un'altra operazione.");
  }

  return (
    <ToolResultPanel eyebrow={eyebrow} placeholder={placeholder} state={state}>
      <div data-result-class="table" data-output-facts-338={outputFacts.state === "available" && outputFacts.format === "csv" ? "available" : "unavailable"}>
        <div data-result-slot="summary">
          <ResultPrimaryAnswer label={summaryLabel}>{summaryValue}</ResultPrimaryAnswer>
        </div>
        <div data-result-slot="issue-counts">
          <ResultBreakdown
            rows={[
              ...metrics.map((metric) => ({ label: metric.label, value: String(metric.value) })),
              { label: "Avvisi", value: String(warnings.length) },
            ]}
          />
        </div>
        {warnings.map((warning, index) => (
          <p class="gutter-note" data-state="warning" key={warning.code + "-" + String(warning.row ?? index)}>
            {warning.row === undefined ? "" : "Riga " + String(warning.row) + " · "}
            {warning.message}
          </p>
        ))}
        <div data-result-slot="table-preview">
          <BoundedTableResultPreview preview={preview} />
        </div>
        {outputFacts.state === "available" && outputFacts.format === "csv" && (
          <p class="file-note" aria-live="polite">
            CSV riletto: {String(outputFacts.csv.rows)} righe dati, {String(outputFacts.csv.columns)} colonne.
          </p>
        )}
        <ResultProvenance>{provenance}</ResultProvenance>
        <ResultActions
          actions={actions}
          onAction={{
            copy,
            download,
            ...(onHandoff === undefined ? {} : { handoff: onHandoff }),
            reset: onReset,
          }}
        />
        {declaration.capabilities.includes("download") && (
          <label class="checkbox-field" data-download-optin339>
            <input type="checkbox" checked={autoDownload} onChange={event=>chooseAutoDownload(event.currentTarget.checked)} />
            <span>Scarica automaticamente i prossimi risultati (facoltativo)</span>
          </label>
        )}
        {declaration.capabilities.includes("download") && <p class="file-note">Disattivato inizialmente. Il browser può bloccare download automatici: il pulsante manuale resta disponibile.</p>}
        {children}
        {actionStatus !== "" && <p class="file-note" role="status">{actionStatus}</p>}
      </div>
    </ToolResultPanel>
  );
}
