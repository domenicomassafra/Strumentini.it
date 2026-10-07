import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { ResultDeclaration } from "../../../catalog/manifest";
import { parseCsvTable } from "../../../engines/table/csv";
import { createBoundedTablePreview } from "../../../runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
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
  if (output === null) {
    return <ToolResultPanel eyebrow={eyebrow} placeholder={placeholder} state={state} />;
  }

  const completeOutput = output;
  const table = parseCsvTable(completeOutput);
  const bytes = new TextEncoder().encode(completeOutput);
  const artifact = createOutputArtifactDescriptor({
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
  const preview = createBoundedTablePreview(artifact, table.header, table.rows, 8);
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
      await navigator.clipboard.writeText(completeOutput);
      setActionStatus("CSV completo copiato.");
    } catch {
      setActionStatus("Il browser ha bloccato gli appunti. Puoi selezionare i dati dall'anteprima.");
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
    <ToolResultPanel eyebrow={eyebrow} placeholder={placeholder} state={state}>
      <div data-result-class="table">
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
        {children}
        {actionStatus !== "" && <p class="file-note" role="status">{actionStatus}</p>}
      </div>
    </ToolResultPanel>
  );
}
