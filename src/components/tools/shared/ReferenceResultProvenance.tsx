import type { ReferenceResultProvenance as ReferenceResultProvenanceModel } from "../../../runtime/reference-result";

const STATE_LABEL: Readonly<Record<ReferenceResultProvenanceModel["state"], string>> = {
  "local-valid": "Validità formale locale",
  "remote-valid": "Valido secondo la fonte remota",
  "remote-invalid": "Non valido secondo la fonte remota",
  stale: "Dati da aggiornare",
  unavailable: "Fonte non disponibile",
};

const STATE_TONE: Readonly<Record<ReferenceResultProvenanceModel["state"], "success" | "warning" | "error" | "info">> = {
  "local-valid": "info",
  "remote-valid": "success",
  "remote-invalid": "error",
  stale: "warning",
  unavailable: "warning",
};

export function ReferenceResultProvenance({ value }: { readonly value: ReferenceResultProvenanceModel }) {
  return (
    <section aria-label="Provenienza e verifica">
      <p class="gutter-note" data-state={STATE_TONE[value.state]}>{STATE_LABEL[value.state]}: {value.message}</p>
      <dl class="gutter-rows">
        <div><dt>Autorità</dt><dd>{value.authority}</dd></div>
        <div><dt>Controllato</dt><dd><time dateTime={value.checkedAt}>{value.checkedAt}</time></dd></div>
        {value.retrievedAt === undefined ? null : (
          <div><dt>Recuperato</dt><dd><time dateTime={value.retrievedAt}>{value.retrievedAt}</time></dd></div>
        )}
        <div><dt>Confine rete</dt><dd>{value.network === "used" ? "Fonte consultata in rete" : value.network === "denied" ? "Rete non disponibile" : "Nessuna rete usata"}</dd></div>
        <div><dt>Tipo di verifica</dt><dd>{value.validation === "remote-authoritative" ? "Verifica remota autorevole" : value.validation === "local-formal" ? "Controllo formale locale" : "Nessuna verifica"}</dd></div>
      </dl>
      {value.source === undefined ? null : <p class="provenance">Fonte: {value.source}</p>}
    </section>
  );
}
