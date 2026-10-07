import { useState } from "preact/hooks";
import { createReferenceResultProvenance, type ReferenceResultProvenance as ReferenceProvenance } from "../../../runtime/reference-result";
import { ReferenceResultProvenance } from "../shared/ReferenceResultProvenance";

interface LocalVatResult {
  readonly valid?: boolean;
  readonly normalized?: string;
}

interface ViesPayload {
  readonly state?: "remote-valid" | "remote-invalid" | "unavailable";
  readonly valid?: boolean | null;
  readonly authority?: string;
  readonly source?: string;
  readonly retrievedAt?: string;
  readonly reason?: string;
}

function localVat(value: unknown): LocalVatResult {
  return typeof value === "object" && value !== null ? value as LocalVatResult : {};
}

export function ViesVerificationPanel({ localResult }: { readonly localResult: unknown }) {
  const local = localVat(localResult);
  const [busy, setBusy] = useState(false);
  const [remote, setRemote] = useState<ReferenceProvenance | null>(null);
  if (local.valid !== true || typeof local.normalized !== "string" || !/^\d{11}$/u.test(local.normalized)) return null;

  async function verify() {
    if (busy) return;
    setBusy(true);
    const fallbackAt = new Date().toISOString();
    try {
      const response = await fetch("/api/vies/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vatNumber: local.normalized }),
      });
      if (!response.ok) throw new Error(`HTTP_${String(response.status)}`);
      const payload = await response.json() as ViesPayload;
      const checkedAt = payload.retrievedAt ?? fallbackAt;
      if (payload.state === "remote-valid" || payload.state === "remote-invalid") {
        setRemote(createReferenceResultProvenance({
          state: payload.state,
          authority: payload.authority ?? "European Commission — VIES",
          checkedAt,
          retrievedAt: checkedAt,
          validation: "remote-authoritative",
          network: "used",
          ...(payload.source === undefined ? {} : { source: payload.source }),
          message: payload.state === "remote-valid"
            ? "La partita IVA risulta valida nella risposta VIES appena recuperata."
            : "La partita IVA risulta non valida nella risposta VIES appena recuperata.",
        }));
      } else {
        setRemote(createReferenceResultProvenance({
          state: "unavailable",
          authority: payload.authority ?? "European Commission — VIES",
          checkedAt,
          validation: "none",
          network: "denied",
          ...(payload.source === undefined ? {} : { source: payload.source }),
          message: `VIES non disponibile (${payload.reason ?? "risposta non disponibile"}). Il checksum locale resta valido.`,
        }));
      }
    } catch {
      setRemote(createReferenceResultProvenance({
        state: "unavailable",
        authority: "European Commission — VIES",
        checkedAt: fallbackAt,
        validation: "none",
        network: "denied",
        source: "https://ec.europa.eu/taxation_customs/vies/",
        message: "VIES non raggiungibile. Il checksum locale resta valido e non viene reinterpretato.",
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="tool-card" data-vies-verification>
      <h3>Verifica opzionale su VIES</h3>
      <p class="file-note" data-vies-network-boundary>
        Il controllo formale sopra è già concluso in locale. Solo premendo il pulsante seguente la Partita IVA verrà inviata tramite Strumentini al servizio VIES della Commissione europea.
      </p>
      <button type="button" onClick={() => void verify()} disabled={busy} data-vies-submit>
        {busy ? "Verifica VIES in corso…" : "Verifica su VIES"}
      </button>
      {remote === null ? null : <ReferenceResultProvenance value={remote} />}
    </section>
  );
}
