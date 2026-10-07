import { useState } from "preact/hooks";
import type { ResultDeclaration } from "../../../catalog/manifest";
import { createBoundedTextPreview } from "../../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
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
  if (value === null) {
    return <ToolResultPanel eyebrow={eyebrow} placeholder={placeholder} state={state} busy={state === "running"} />;
  }

  const serialized = JSON.stringify(value, null, 2);
  const effectiveMetrics = metrics.length > 0 ? metrics : inferredStructuredMetrics(value);
  const artifact = createOutputArtifactDescriptor({
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
  JSON.parse(serialized);
  const preview = createBoundedTextPreview(artifact, 36, "code");
  const actions = resolveResultActions({
    declaration,
    primary: declaration.capabilities.includes("copy") ? "copy" : declaration.capabilities.includes("download") ? "download" : null,
    hasCopyPayload: serialized !== "",
    artifact,
    resetReady: true,
  });

  async function copy() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili. Puoi selezionare il risultato dall'anteprima.");
      return;
    }
    try {
      await navigator.clipboard.writeText(serialized);
      setActionStatus("Risultato completo copiato.");
    } catch {
      setActionStatus("Il browser ha bloccato gli appunti. Puoi selezionare il risultato dall'anteprima.");
    }
  }

  function download() {
    if (!artifact.download.ready) return;
    const url = URL.createObjectURL(new Blob([artifact.bytes.slice().buffer], { type: artifact.mime }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = artifact.name;
    anchor.click();
    URL.revokeObjectURL(url);
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
        {actionStatus !== "" && <p class="file-note" role="status">{actionStatus}</p>}
      </div>
    </ToolResultPanel>
  );
}
