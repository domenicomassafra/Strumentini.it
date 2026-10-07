import { createOutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions, type ResultActionId } from "../../../runtime/result-actions";
import { ResultActions } from "./ResultActions";
import {
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "./ResultPrimitives";

const noopHandlers: Readonly<Record<ResultActionId, () => void>> = {
  copy: () => undefined,
  download: () => undefined,
  "download-all": () => undefined,
  share: () => undefined,
  reuse: () => undefined,
  retry: () => undefined,
  reset: () => undefined,
  handoff: () => undefined,
};

export function CalculatorResultV2Exemplar() {
  const actions = resolveResultActions({
    declaration: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
    primary: "copy",
    hasCopyPayload: true,
    resetReady: true,
  });
  return (
    <section class="result-panel gutter result-exemplar" data-exemplar="calculator">
      <ResultExplanation
        primary={<ResultPrimaryAnswer label="Totale">1.234,50 €</ResultPrimaryAnswer>}
        interpretation={<ResultInterpretation state="success">Il totale include le ipotesi mostrate sotto.</ResultInterpretation>}
        breakdown={<ResultBreakdown rows={[
          { label: "Imponibile", value: "1.000,00 €" },
          { label: "IVA", value: "234,50 €" },
        ]} />}
        assumptions={<ResultAssumptions items={[{ label: "Arrotondamento", value: "2 decimali" }]} />}
        provenance={<ResultProvenance>Calcolo locale deterministico</ResultProvenance>}
      />
      <ResultActions actions={actions} onAction={noopHandlers} />
    </section>
  );
}

export function ValidatorResultV2Exemplar() {
  const actions = resolveResultActions({
    declaration: { class: "validator", capabilities: ["copy", "reset", "provenance"] },
    primary: "copy",
    hasCopyPayload: true,
    resetReady: true,
  });
  return (
    <section class="result-panel gutter result-exemplar" data-exemplar="validator">
      <ResultExplanation
        primary={<ResultPrimaryAnswer label="Esito">Valido</ResultPrimaryAnswer>}
        interpretation={<ResultInterpretation state="success">La struttura supera tutti i controlli formali locali.</ResultInterpretation>}
        breakdown={<ResultBreakdown rows={[
          { label: "Formato", value: "Valido" },
          { label: "Checksum", value: "Coerente" },
        ]} />}
        provenance={<ResultProvenance>Verifica formale locale; nessuna verifica remota</ResultProvenance>}
      />
      <ResultActions actions={actions} onAction={noopHandlers} />
    </section>
  );
}

const transformArtifact = createOutputArtifactDescriptor({
  kind: "file",
  name: "risultato.txt",
  mime: "text/plain",
  bytes: new TextEncoder().encode("contenuto trasformato"),
  verification: { state: "verified", verifiedMime: "text/plain", method: "UTF-8 producer contract" },
  fidelity: "lossless",
  fidelityNote: "Il testo prodotto è conservato byte per byte.",
});

export function TransformResultV2Exemplar() {
  const actions = resolveResultActions({
    declaration: { class: "file", capabilities: ["download", "reset", "provenance"] },
    primary: "download",
    artifact: transformArtifact,
    resetReady: true,
  });
  return (
    <section class="result-panel gutter result-exemplar" data-exemplar="transform">
      <ResultExplanation
        primary={<ResultPrimaryAnswer label="File pronto">risultato.txt</ResultPrimaryAnswer>}
        interpretation={<ResultInterpretation state="success">Il file è stato verificato ed è pronto per il download.</ResultInterpretation>}
        breakdown={<ResultBreakdown rows={[
          { label: "Tipo verificato", value: transformArtifact.verification.verifiedMime ?? "—" },
          { label: "Dimensione", value: String(transformArtifact.byteLength) + " byte" },
        ]} />}
        provenance={<ResultProvenance>Trasformazione locale</ResultProvenance>}
      />
      <ResultActions actions={actions} onAction={noopHandlers} />
    </section>
  );
}
