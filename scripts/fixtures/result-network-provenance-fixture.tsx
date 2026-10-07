import { render } from "preact";
import { useState } from "preact/hooks";
import { ReferenceResultProvenance } from "../../src/components/tools/shared/ReferenceResultProvenance";
import { ToolResultPanel } from "../../src/components/tools/shared/ToolResultPanel";
import { createReferenceResultProvenance, type ReferenceResultProvenance as ProvenanceModel } from "../../src/runtime/reference-result";

function NetworkFixture() {
  const [provenance, setProvenance] = useState<ProvenanceModel | null>(null);
  const [localError, setLocalError] = useState("");

  async function remoteLookup() {
    setLocalError("");
    try {
      const response = await fetch("/__result-v2-reference-fixture?code=reference-key-123", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("reference unavailable");
      await response.json();
      const now = new Date().toISOString();
      setProvenance(createReferenceResultProvenance({
        state: "remote-valid",
        authority: "Fonte ufficiale fixture",
        checkedAt: now,
        retrievedAt: now,
        validation: "remote-authoritative",
        network: "used",
        source: "endpoint ufficiale fixture",
        message: "Il record è stato confermato dalla fonte.",
      }));
    } catch {
      setProvenance(createReferenceResultProvenance({
        state: "unavailable",
        authority: "Fonte ufficiale fixture",
        checkedAt: new Date().toISOString(),
        validation: "none",
        network: "denied",
        message: "La fonte remota non è raggiungibile; nessun verdetto remoto è disponibile.",
      }));
    }
  }

  function localInvalid() {
    setProvenance(null);
    setLocalError("Valore locale non valido: il formato non supera i controlli.");
  }

  return (
    <main>
      <p data-reference-before-action>
        La verifica remota usa la rete solo dopo questa azione e invia la chiave di riferimento mostrata.
      </p>
      <div class="actions">
        <button type="button" onClick={() => void remoteLookup()}>Verifica fonte remota</button>
        <button type="button" onClick={localInvalid}>Simula errore locale</button>
      </div>
      <ToolResultPanel
        eyebrow="Esito"
        placeholder="Nessuna verifica eseguita."
        state={localError === "" ? provenance === null ? "idle" : provenance.state === "remote-valid" ? "success" : "warning" : "error"}
      >
        {localError !== "" ? <p data-local-invalid>{localError}</p> : provenance === null ? null : <ReferenceResultProvenance value={provenance} />}
      </ToolResultPanel>
    </main>
  );
}

const root = document.getElementById("app");
if (root === null) throw new Error("Missing result-network fixture root.");
render(<NetworkFixture />, root);
