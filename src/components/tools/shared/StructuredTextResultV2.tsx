import { useEffect, useRef, useState } from "preact/hooks";
import type { ResultDeclaration } from "../../../catalog/manifest";
import { createBoundedTextPreview } from "../../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
import { AUTO_DOWNLOAD_KEY_339, browserStorage339, changeAutoDownload339, readAutoDownload339 } from "../../../runtime/download-policy-339";
import { requestBrowserDownload339 } from "../../../runtime/browser-download-339";
import { BoundedTextResultPreview } from "./BoundedResultPreview";
import { ResultActions } from "./ResultActions";
import { ResultBreakdown, ResultPrimaryAnswer, ResultProvenance } from "./ResultPrimitives";
import { ToolResultPanel } from "./ToolResultPanel";
import type { AccessibleResultStatus } from "./ResultAccessibility";

export interface StructuredTextMetric {
  readonly label: string;
  readonly value: string | number;
}

export interface StructuredTextResultV2Props {
  readonly eyebrow: string;
  readonly placeholder: string;
  readonly state: AccessibleResultStatus;
  readonly value: unknown | null;
  readonly declaration: ResultDeclaration;
  readonly summaryLabel: string;
  readonly summaryValue: string;
  readonly metrics: readonly StructuredTextMetric[];
  readonly provenance: string;
  readonly filename: string;
  readonly onReset: () => void;
}

function summarizeStructuredValue(value: unknown): string {
  if (value === null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "Nessun valore";
    const visible = value.slice(0, 4).map((entry) => summarizeStructuredValue(entry));
    return visible.join(" · ") + (value.length > visible.length ? " · +" + String(value.length - visible.length) : "");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Readonly<Record<string, unknown>>)
      .filter(([key]) => key !== "engineVersion")
      .slice(0, 4);
    if (entries.length === 0) return "Oggetto senza campi visibili";
    return entries.map(([key, entry]) => key + ": " + summarizeStructuredValue(entry)).join(" · ");
  }
  return String(value);
}

function inferredStructuredMetrics(value: unknown): readonly StructuredTextMetric[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [{ label: "Valore", value: summarizeStructuredValue(value) }];
  }
  return Object.entries(value as Readonly<Record<string, unknown>>)
    .filter(([key]) => key !== "engineVersion")
    .slice(0, 8)
    .map(([key, entry]) => ({ label: key, value: summarizeStructuredValue(entry) }));
}

export function StructuredTextResultV2({
  eyebrow,
  placeholder,
  state,
  value,
  declaration,
  summaryLabel,
  summaryValue,
  metrics,
  provenance,
  filename,
  onReset,
}: StructuredTextResultV2Props) {
  const [actionStatus, setActionStatus] = useState("");
  // Match SSR's default-OFF markup; mount effect restores browser consent.
  const [autoDownload, setAutoDownload] = useState(false);
  const autoTriggered = useRef(false);
  const serialized = value === null ? null : JSON.stringify(value, null, 2);
  const artifact = serialized === null ? null : createOutputArtifactDescriptor({
    kind: "structured",
    name: filename,
    mime: "application/json",
    bytes: new TextEncoder().encode(serialized),
    verification: {
      state: "verified",
      verifiedMime: "application/json",
      method: "JSON.stringify output reparsed by JSON.parse",
    },
    fidelity: "structural",
    fidelityNote: "Il file contiene l'intero risultato strutturato prodotto dal motore locale.",
  });
  if (serialized !== null) JSON.parse(serialized);

  useEffect(() => {
    if (value === null || state === "running" || state === "idle") autoTriggered.current = false;
  }, [state, value]);
  useEffect(() => {
    if (state !== "success" || !autoDownload || artifact === null || !artifact.download.ready || autoTriggered.current) return;
    autoTriggered.current = true;
    if (requestBrowserDownload339(artifact)) {
      setActionStatus("Download automatico richiesto al browser. Se viene bloccato, usa Scarica risultato.");
    } else {
      setActionStatus("Download automatico non disponibile. Puoi provare Scarica risultato.");
    }
  }, [state, autoDownload, serialized, filename]);

  useEffect(() => {
    autoTriggered.current = state === "success";
    setAutoDownload(readAutoDownload339(browserStorage339()));
    const listener = (event: StorageEvent) => {
      if (event.key !== AUTO_DOWNLOAD_KEY_339 && event.key !== null) return;
      autoTriggered.current = state === "success";
      setAutoDownload(readAutoDownload339(browserStorage339()));
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [state]);

  if (value === null) {
    return <ToolResultPanel eyebrow={eyebrow} placeholder={placeholder} state={state} busy={state === "running"} />;
  }

  const effectiveMetrics = metrics.length > 0 ? metrics : inferredStructuredMetrics(value);
  const preview = createBoundedTextPreview(artifact!, 36, "code");
  const actions = resolveResultActions({
    declaration,
    primary: declaration.capabilities.includes("copy") ? "copy" : declaration.capabilities.includes("download") ? "download" : null,
    hasCopyPayload: serialized !== "",
    artifact: artifact!,
    resetReady: true,
  });

  async function copy() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili. Puoi selezionare il risultato dall'anteprima.");
      return;
    }
    try {
      await navigator.clipboard.writeText(serialized!);
      setActionStatus("Risultato completo copiato.");
    } catch {
      setActionStatus("Il browser ha bloccato gli appunti. Puoi selezionare il risultato dall'anteprima.");
    }
  }

  function download() {
    if (!requestBrowserDownload339(artifact!)) setActionStatus("Download non disponibile: il file non è verificato o il browser lo ha bloccato.");
    else setActionStatus("Download richiesto al browser. Se non parte, controlla le autorizzazioni ai download.");
  }

  function chooseAutoDownload(enabled: boolean) {
    // Selecting auto after a completed result never surprises the user by
    // downloading that already-visible output. Only subsequent runs qualify.
    autoTriggered.current = state === "success";
    const { saved, persistedEnabled } = changeAutoDownload339(browserStorage339(), enabled);
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
    <ToolResultPanel eyebrow={eyebrow} placeholder={placeholder} state={state} busy={state === "running"}>
      <div data-result-class="text-code">
        <ResultPrimaryAnswer label={summaryLabel}>{summaryValue}</ResultPrimaryAnswer>
        <div data-result-slot="counts">
          <ResultBreakdown rows={effectiveMetrics.map((metric) => ({ label: metric.label, value: String(metric.value) }))} />
        </div>
        <ResultProvenance>{provenance}</ResultProvenance>
        <details data-result-secondary-raw>
          <summary>Risultato strutturato completo</summary>
          <div data-result-slot="selectable-output">
            <BoundedTextResultPreview preview={preview} />
          </div>
        </details>
        <ResultActions
          actions={actions}
          onAction={{
            ...(declaration.capabilities.includes("copy") ? { copy } : {}),
            ...(declaration.capabilities.includes("download") ? { download } : {}),
            reset: onReset,
          }}
        />
        {declaration.capabilities.includes("download") && (
          <label class="checkbox-field" data-download-optin339>
            <input type="checkbox" checked={autoDownload} onChange={(event) => chooseAutoDownload(event.currentTarget.checked)} />
            <span>Scarica automaticamente i prossimi risultati (facoltativo)</span>
          </label>
        )}
        {declaration.capabilities.includes("download") && <p class="file-note">Disattivato inizialmente. Il browser può bloccare download automatici: il pulsante manuale resta sempre disponibile.</p>}
        {actionStatus !== "" && <p class="file-note" role="status">{actionStatus}</p>}
      </div>
    </ToolResultPanel>
  );
}
