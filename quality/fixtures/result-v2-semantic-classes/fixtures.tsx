import type { ComponentChildren } from "preact";
import { BatchResult } from "../../../src/components/tools/shared/BatchResult";
import { BoundedTableResultPreview, BoundedTextResultPreview } from "../../../src/components/tools/shared/BoundedResultPreview";
import { FileResultWorkspace } from "../../../src/components/tools/shared/FileResultWorkspace";
import { ReferenceResultProvenance } from "../../../src/components/tools/shared/ReferenceResultProvenance";
import { ResultActions } from "../../../src/components/tools/shared/ResultActions";
import {
  ResultAssumptions,
  ResultBreakdown,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "../../../src/components/tools/shared/ResultPrimitives";
import { ToolResultPanel } from "../../../src/components/tools/shared/ToolResultPanel";
import type { ResultV2SemanticFixture } from "../../../src/quality/result-v2-conformance";
import { summarizeBatchResult, type BatchResultItem } from "../../../src/runtime/batch-result";
import { createBoundedTablePreview, createBoundedTextPreview } from "../../../src/runtime/bounded-preview";
import { createFileResultItem, createFileResultWorkspace } from "../../../src/runtime/file-result";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor, type OutputArtifactKind } from "../../../src/runtime/output-artifact";
import { createReferenceResultProvenance } from "../../../src/runtime/reference-result";
import { resolveResultActions, type ResultActionContext, type ResultActionId } from "../../../src/runtime/result-actions";

const HANDLERS: Readonly<Record<ResultActionId, () => void>> = {
  copy: () => undefined,
  download: () => undefined,
  "download-all": () => undefined,
  share: () => undefined,
  reuse: () => undefined,
  retry: () => undefined,
  reset: () => undefined,
  handoff: () => undefined,
};

function artifact(kind: OutputArtifactKind, name: string, mime: string, text = "fixture output"): OutputArtifactDescriptor {
  return createOutputArtifactDescriptor({
    kind,
    name,
    mime,
    bytes: new TextEncoder().encode(text),
    verification: { state: "verified", verifiedMime: mime, method: "semantic conformance fixture verifier" },
    fidelity: kind === "image" ? "lossy" : kind === "pdf" ? "structural" : "lossless",
    fidelityNote: "Fixture bytes are verified before download actions are exposed.",
  });
}

const TEXT_ARTIFACT = artifact("text", "output.txt", "text/plain", "prima\nseconda\nterza");
const TABLE_ARTIFACT = artifact("structured", "table.csv", "text/csv", "nome,valore\nA,1\nB,2\nC,3");
const FILE_ARTIFACT = artifact("file", "result.bin", "application/octet-stream");
const IMAGE_ARTIFACT = artifact("image", "result.png", "image/png");
const PDF_ARTIFACT = artifact("pdf", "result.pdf", "application/pdf", "%PDF-fixture");

function actions(context: ResultActionContext): ComponentChildren {
  return <ResultActions actions={resolveResultActions(context)} onAction={HANDLERS} />;
}

function frame(resultClass: string, children: ComponentChildren, context: ResultActionContext): ComponentChildren {
  return (
    <ToolResultPanel eyebrow="Fixture Result v2" placeholder="Nessun risultato" state="success">
      <div data-result-class={resultClass}>
        {children}
        {actions(context)}
      </div>
    </ToolResultPanel>
  );
}

const calculatorActions: ResultActionContext = {
  declaration: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  primary: "copy",
  hasCopyPayload: true,
  resetReady: true,
};

const validatorActions: ResultActionContext = {
  declaration: { class: "validator", capabilities: ["copy", "retry", "reset", "provenance"] },
  primary: "copy",
  hasCopyPayload: true,
  retryReady: true,
  resetReady: true,
};

const textActions: ResultActionContext = {
  declaration: { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  primary: "copy",
  hasCopyPayload: true,
  artifact: TEXT_ARTIFACT,
  reuseReady: true,
  resetReady: true,
};

const tableActions: ResultActionContext = {
  declaration: { class: "table", capabilities: ["copy", "download", "handoff", "reset"] },
  primary: "download",
  hasCopyPayload: true,
  artifact: TABLE_ARTIFACT,
  handoff: { type: "table", format: "csv", compatibleTargets: 1 },
  resetReady: true,
};

const fileActions: ResultActionContext = {
  declaration: { class: "file", capabilities: ["download", "retry", "reset", "before-after"] },
  primary: "download",
  artifact: FILE_ARTIFACT,
  retryReady: true,
  resetReady: true,
};

const imageActions: ResultActionContext = {
  declaration: { class: "image", capabilities: ["download", "reset", "before-after"] },
  primary: "download",
  artifact: IMAGE_ARTIFACT,
  resetReady: true,
};

const pdfActions: ResultActionContext = {
  declaration: { class: "pdf", capabilities: ["download", "reset", "before-after"] },
  primary: "download",
  artifact: PDF_ARTIFACT,
  resetReady: true,
};

const batchActions: ResultActionContext = {
  declaration: { class: "batch", capabilities: ["download-all", "retry", "reset", "batch"] },
  primary: "download-all",
  downloadAllReady: true,
  retryReady: true,
  resetReady: true,
};

const referenceActions: ResultActionContext = {
  declaration: { class: "reference-network", capabilities: ["copy", "retry", "reset", "provenance"] },
  primary: "copy",
  hasCopyPayload: true,
  retryReady: true,
  resetReady: true,
};

const fileWorkspace = createFileResultWorkspace([
  createFileResultItem({
    id: "done",
    source: { name: "source.bin", byteLength: 20, detectedMime: "application/octet-stream" },
    status: "success",
    artifact: FILE_ARTIFACT,
    beforeBytes: 20,
    afterBytes: FILE_ARTIFACT.byteLength,
  }),
  createFileResultItem({
    id: "progress",
    source: { name: "pending.bin", byteLength: 30 },
    status: "running",
    progress: 0.5,
  }),
  createFileResultItem({
    id: "failed",
    source: { name: "failed.bin", byteLength: 5 },
    status: "error",
    message: "Input non valido.",
  }),
  createFileResultItem({
    id: "cancelled",
    source: { name: "cancelled.bin", byteLength: 5 },
    status: "cancelled",
  }),
], { location: "LOCAL", network: "forbidden" });

const imageWorkspace = createFileResultWorkspace([
  createFileResultItem({
    id: "image-ok",
    source: { name: "source.jpg", byteLength: 30, detectedMime: "image/jpeg" },
    status: "success",
    artifact: IMAGE_ARTIFACT,
    beforeBytes: 30,
    afterBytes: IMAGE_ARTIFACT.byteLength,
  }),
  createFileResultItem({
    id: "image-warning",
    source: { name: "warning.jpg", byteLength: 40, detectedMime: "image/jpeg" },
    status: "warning",
    message: "Qualità ridotta per rispettare il profilo scelto.",
  }),
], { location: "LOCAL", network: "forbidden" });

const pdfWorkspace = createFileResultWorkspace([
  createFileResultItem({
    id: "pdf-ok",
    source: { name: "source.pdf", byteLength: 40, detectedMime: "application/pdf" },
    status: "success",
    artifact: PDF_ARTIFACT,
    beforeBytes: 40,
    afterBytes: PDF_ARTIFACT.byteLength,
  }),
  createFileResultItem({
    id: "pdf-partial",
    source: { name: "partial.pdf", byteLength: 50, detectedMime: "application/pdf" },
    status: "partial",
    message: "Una pagina non è stata inclusa.",
  }),
], { location: "LOCAL", network: "forbidden" });

const batchItems: readonly BatchResultItem[] = [
  { id: "ok-a", label: "a.bin", status: "success", artifact: FILE_ARTIFACT },
  { id: "ok-b", label: "b.bin", status: "success", artifact: artifact("file", "second.bin", "application/octet-stream", "second fixture output") },
  { id: "error", label: "bad.bin", status: "error", message: "Input non valido." },
  { id: "cancelled", label: "cancelled.bin", status: "cancelled" },
  { id: "unsupported", label: "unsupported.bin", status: "unsupported", retryable: false },
];
void summarizeBatchResult(batchItems);

const referenceProvenance = [
  createReferenceResultProvenance({
    state: "local-valid",
    authority: "Fonte ufficiale di fixture",
    checkedAt: "2026-10-05T20:00:00Z",
    validation: "local-formal",
    network: "not-used",
    message: "Formato locale coerente; nessuna verifica remota.",
  }),
  createReferenceResultProvenance({
    state: "remote-valid",
    authority: "Fonte ufficiale di fixture",
    checkedAt: "2026-10-05T20:00:00Z",
    retrievedAt: "2026-10-05T20:01:00Z",
    validation: "remote-authoritative",
    network: "used",
    source: "Endpoint ufficiale di fixture",
    message: "Record confermato dalla fonte remota.",
  }),
  createReferenceResultProvenance({
    state: "remote-invalid",
    authority: "Fonte ufficiale di fixture",
    checkedAt: "2026-10-05T20:00:00Z",
    retrievedAt: "2026-10-05T20:02:00Z",
    validation: "remote-authoritative",
    network: "used",
    source: "Endpoint ufficiale di fixture",
    message: "Record respinto dalla fonte remota.",
  }),
  createReferenceResultProvenance({
    state: "stale",
    authority: "Fonte ufficiale di fixture",
    checkedAt: "2026-09-01T00:00:00Z",
    validation: "none",
    network: "not-used",
    message: "Snapshot oltre la finestra di freschezza.",
  }),
  createReferenceResultProvenance({
    state: "unavailable",
    authority: "Fonte ufficiale di fixture",
    checkedAt: "2026-10-05T20:00:00Z",
    validation: "none",
    network: "denied",
    message: "Fonte remota non disponibile.",
  }),
] as const;

export const RESULT_V2_SEMANTIC_FIXTURES = [
  {
    class: "calculator",
    actionContext: calculatorActions,
    render: () => frame("calculator", <>
      <div data-result-slot="primary"><ResultPrimaryAnswer label="Totale" unit="€">1.234,50</ResultPrimaryAnswer></div>
      <div data-result-slot="interpretation"><ResultInterpretation state="success">Il totale rispetta le ipotesi dichiarate.</ResultInterpretation></div>
      <div data-result-slot="breakdown"><ResultBreakdown rows={[{ label: "Dimensione del risultato completo verificato localmente", value: "1.000,00 €" }, { label: "Quota", value: "234,50 €" }]} /></div>
      <div data-result-slot="assumptions"><ResultAssumptions items={[{ label: "Arrotondamento", value: "2 decimali" }]} /></div>
      <div data-result-slot="provenance"><ResultProvenance>Calcolo locale deterministico</ResultProvenance></div>
    </>, calculatorActions),
  },
  {
    class: "validator",
    actionContext: validatorActions,
    render: () => frame("validator", <>
      <div data-result-slot="primary"><ResultPrimaryAnswer label="Esito">Non valido</ResultPrimaryAnswer></div>
      <div data-result-slot="interpretation"><ResultInterpretation state="error">La regola formale alla posizione 4 non è rispettata.</ResultInterpretation></div>
      <div data-result-slot="checks"><ResultBreakdown label="Controlli eseguiti" rows={[{ label: "Regola fallita", value: "Carattere 4" }, { label: "Cosa prova", value: "Solo validità formale locale" }]} /></div>
      <div data-result-slot="provenance"><ResultProvenance>Nessuna verifica remota o certificazione ufficiale</ResultProvenance></div>
    </>, validatorActions),
  },
  {
    class: "text-code",
    actionContext: textActions,
    render: () => frame("text-code", <>
      <div data-result-slot="selectable-output"><BoundedTextResultPreview preview={createBoundedTextPreview(TEXT_ARTIFACT, 2, "code")} /></div>
      <div data-result-slot="counts"><ResultBreakdown rows={[{ label: "Righe", value: "3" }, { label: "Byte", value: String(TEXT_ARTIFACT.byteLength) }]} /></div>
    </>, textActions),
  },
  {
    class: "table",
    actionContext: tableActions,
    render: () => frame("table", <>
      <div data-result-slot="summary"><ResultPrimaryAnswer label="Tabella">3 righe · 2 colonne</ResultPrimaryAnswer></div>
      <div data-result-slot="issue-counts"><ResultBreakdown rows={[{ label: "Avvisi", value: "1" }, { label: "Errori", value: "0" }]} /></div>
      <div data-result-slot="table-preview"><BoundedTableResultPreview preview={createBoundedTablePreview(TABLE_ARTIFACT, ["nome", "valore"], [["A", "1"], ["B", "2"], ["C", "3"]], 2)} /></div>
    </>, tableActions),
  },
  {
    class: "file",
    actionContext: fileActions,
    render: () => frame("file", <div data-result-slot="file-workspace"><FileResultWorkspace workspace={fileWorkspace} /></div>, fileActions),
  },
  {
    class: "image",
    actionContext: imageActions,
    render: () => frame("image", <>
      <figure data-result-slot="visual-preview" aria-label="Anteprima immagine"><img alt="Anteprima immagine risultante" src="data:image/png;base64,iVBORw0KGgo=" /></figure>
      <div data-result-slot="media-metrics"><ResultBreakdown label="Dati immagine" rows={[{ label: "Dimensioni", value: "1200 × 800 px" }, { label: "Formato", value: "PNG" }, { label: "Dimensione", value: `${IMAGE_ARTIFACT.byteLength} byte` }]} /></div>
      <div data-result-slot="file-workspace"><FileResultWorkspace workspace={imageWorkspace} /></div>
    </>, imageActions),
  },
  {
    class: "pdf",
    actionContext: pdfActions,
    render: () => frame("pdf", <>
      <section data-result-slot="page-preview" aria-label="Anteprima pagine PDF"><button type="button" data-page-preview-control>Pagina 1 · anteprima</button></section>
      <div data-result-slot="operation-summary"><ResultBreakdown label="Riepilogo PDF" rows={[{ label: "Pagine output", value: "1" }, { label: "Dimensione output", value: `${PDF_ARTIFACT.byteLength} byte` }]} /></div>
      <div data-result-slot="file-workspace"><FileResultWorkspace workspace={pdfWorkspace} /></div>
    </>, pdfActions),
  },
  {
    class: "batch",
    actionContext: batchActions,
    render: () => frame("batch", <div data-result-slot="batch-summary"><BatchResult items={batchItems} /></div>, batchActions),
  },
  {
    class: "reference-network",
    actionContext: referenceActions,
    render: () => frame("reference-network", <div data-result-slot="reference-provenance">{referenceProvenance.map((value) => (
      <div data-result-variant-state={value.state} key={value.state}><ReferenceResultProvenance value={value} /></div>
    ))}</div>, referenceActions),
  },
] as const satisfies readonly ResultV2SemanticFixture[];
