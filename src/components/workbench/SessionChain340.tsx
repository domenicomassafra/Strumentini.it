import { useEffect, useRef, useState } from "preact/hooks";
import { normalizeWhitespace, convertTextCase } from "../../engines/text-writing";
import { encodeBase64Bytes } from "../../engines/developer-web/encoding-crypto";
import {
  createSessionTaskHistory340,
  type SessionResultReceipt340,
  type TaskHandle340,
  type TaskFailureReason340,
} from "../../workbench/session-history-340";

const MAX_RESULT = 64 * 1024; // mobile-friendly, more conservative than engine's 1 MiB bound
const TOTAL = 3 * MAX_RESULT;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

type Phase = "idle" | "running" | "saved" | "cancelled" | "unavailable";
type Stage = { readonly phase: Phase; readonly detail: string; readonly receipt?: SessionResultReceipt340 };
const empty = (): Stage[] => [
  { phase: "idle", detail: "Da eseguire" },
  { phase: "idle", detail: "In attesa del risultato 1" },
  { phase: "idle", detail: "In attesa del risultato 2" },
];
const labels = ["Normalizza spazi", "Trasforma in maiuscolo", "Codifica Base64"] as const;
const ids = ["whitespace-normalizer", "case-converter", "base64-codec"] as const;

function explain(reason: TaskFailureReason340): string {
  if (reason === "quota-exceeded" || reason === "history-full") return "Limite memoria raggiunto: risultato non conservato. Quelli precedenti restano recuperabili.";
  if (reason === "missing-parent") return "Risultato precedente non disponibile o non verificato. Nessuna elaborazione eseguita.";
  if (reason === "hash-unavailable" || reason === "memory-unavailable") return "Memoria o verifica SHA-256 non disponibile: nessun risultato aggiunto.";
  return "Operazione non disponibile. Nessun risultato aggiunto; i precedenti restano intatti.";
}

/** An abortable scheduling window allows the user to cancel BEFORE an engine runs. */
function allowCancellation(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("cancelled", "AbortError")); return; }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", cancelled);
      resolve();
    }, 320);
    function cancelled(): void {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancelled);
      reject(new DOMException("cancelled", "AbortError"));
    }
    signal.addEventListener("abort", cancelled, { once: true });
  });
}

/** Local Workbench demo, not the persisted Recenti list: only this mounted page owns its bytes. */
export default function SessionChain340() {
  const history = useRef(createSessionTaskHistory340({ maxResultBytes: MAX_RESULT, maxTotalBytes: TOTAL }));
  const active = useRef<{ index: number; handle: TaskHandle340 } | null>(null);
  const generation = useRef(0);
  const receipts = useRef<Array<SessionResultReceipt340 | undefined>>([undefined, undefined, undefined]);
  const [source, setSource] = useState("");
  const [stages, setStages] = useState<Stage[]>(empty);
  const [recovered, setRecovered] = useState("");
  const [readback, setReadback] = useState("");

  useEffect(() => () => {
    generation.current++;
    active.current?.handle.cancel();
    active.current = null;
    history.current.dispose();
  }, []);

  function update(index: number, phase: Phase, detail: string, receipt?: SessionResultReceipt340): void {
    setStages((previous) => previous.map((stage, position) => position === index
      ? { phase, detail, ...(receipt === undefined ? {} : { receipt }) } : stage));
  }

  async function run(index: number): Promise<void> {
    if (active.current !== null || receipts.current[index] !== undefined ||
      (index > 0 && receipts.current[index - 1] === undefined)) return;
    const current = generation.current;
    const before = index === 0 ? source : "";
    // Reject oversized user inputs before invoking any potentially costly engine.
    if (index === 0 && encoder.encode(before).byteLength > MAX_RESULT) {
      update(index, "unavailable", explain("quota-exceeded"));
      return;
    }
    const parent = index === 0 ? undefined : receipts.current[index - 1];
    const handle = history.current.run({
      toolId: ids[index]!,
      ...(parent === undefined ? {} : { previous: parent }),
      execute: async (input, signal) => {
        await allowCancellation(signal);
        if (signal.aborted) throw new DOMException("cancelled", "AbortError");
        if (index === 0) return encoder.encode(normalizeWhitespace({ text: before }).output);
        if (input === undefined) throw new Error("Missing verified previous bytes");
        if (index === 1) return encoder.encode(convertTextCase({ text: decoder.decode(input), mode: "upper" }).output);
        return encoder.encode(encodeBase64Bytes(input));
      },
    });
    active.current = { index, handle };
    update(index, "running", "Elaborazione locale in corso. Puoi annullare questo task.");
    const outcome = await handle.finished;
    if (generation.current !== current) return;
    if (active.current?.handle === handle) active.current = null;
    if (outcome.status === "saved") {
      receipts.current[index] = outcome.receipt;
      update(index, "saved", `${outcome.receipt.bytes} byte conservati nella memoria di questa pagina.`, outcome.receipt);
    } else if (outcome.status === "cancelled") {
      update(index, "cancelled", "Operazione annullata. Nessun risultato conservato.");
    } else {
      update(index, "unavailable", explain(outcome.reason));
    }
  }

  function cancel(index: number): void {
    if (active.current?.index !== index) return;
    active.current.handle.cancel();
    active.current = null;
    update(index, "cancelled", "Operazione annullata. Nessun risultato conservato.");
  }

  async function restore(index: number): Promise<void> {
    const receipt = receipts.current[index];
    if (receipt === undefined) return;
    const current = generation.current;
    const result = await history.current.recover(receipt);
    if (generation.current !== current) return;
    if (result.status !== "recovered") {
      setReadback("Recupero rifiutato: il risultato non è più presente o l'hash non coincide.");
      setRecovered("");
      return;
    }
    try {
      const value = decoder.decode(result.bytes);
      setRecovered(value);
      setReadback(`Recuperati e verificati ${result.bytes.byteLength} byte dal task ${index + 1} (SHA-256 verificato).`);
    } catch {
      setReadback("Byte recuperati non validi come UTF-8: nessun testo mostrato.");
      setRecovered("");
    }
  }

  function clear(): void {
    generation.current++;
    active.current?.handle.cancel();
    active.current = null;
    history.current.dispose();
    history.current = createSessionTaskHistory340({ maxResultBytes: MAX_RESULT, maxTotalBytes: TOTAL });
    receipts.current = [undefined, undefined, undefined];
    setStages(empty());
    setRecovered("");
    setReadback("Cronologia della pagina svuotata. Nessuna operazione precedente è stata annullata.");
  }

  return (
    <section class="session340" data-session340 aria-labelledby="session340-title">
      <div class="section-head">
        <div>
          <h2 class="section-title" id="session340-title">Catena di tre operazioni locali</h2>
          <p class="section-sub">Normalizza spazi → maiuscolo → Base64. Tre motori reali, con recupero verificato tramite SHA-256.</p>
        </div>
      </div>
      <p class="session340-notice">I risultati restano <strong>solo in questa pagina</strong>, non nei Recenti o nel tuo account. <strong>Ricaricando o cambiando pagina spariscono</strong>: non esiste ripristino né annullamento degli effetti passati. Nessun upload. Massimo tre risultati, 64 KiB ciascuno, 192 KiB complessivi.</p>
      <label class="session340-label" for="session340-input">Testo di partenza</label>
      <textarea id="session340-input" rows={3} value={source} onInput={(event) => setSource(event.currentTarget.value)} placeholder="Scrivi un testo da trasformare" />
      <ol class="session340-list">
        {labels.map((label, index) => {
          const stage = stages[index]!;
          const enabled = active.current === null && stage.receipt === undefined &&
            (index === 0 || receipts.current[index - 1] !== undefined);
          return <li key={label} data-session340-stage>
            <strong>{index + 1}. {label}</strong>
            <p role="status" aria-live="polite">{stage.detail}</p>
            <div class="session340-actions">
              <button type="button" disabled={!enabled} onClick={() => { void run(index); }}>Esegui {index + 1}</button>
              <button type="button" disabled={stage.phase !== "running"} onClick={() => cancel(index)}>Annulla {index + 1}</button>
              <button type="button" disabled={stage.receipt === undefined} onClick={() => { void restore(index); }}>Recupera {index + 1}</button>
            </div>
            {stage.receipt !== undefined && <div data-session340-receipt class="session340-proof">
              <span>SHA-256: <code data-session340-sha>{stage.receipt.sha256}</code></span>
              {stage.receipt.parentSha256 !== undefined && <span>Hash del risultato precedente: <code data-session340-parent>{stage.receipt.parentSha256}</code></span>}
            </div>}
          </li>;
        })}
      </ol>
      <label class="session340-label" for="session340-output">Risultato recuperato (sola lettura)</label>
      <textarea id="session340-output" rows={3} readOnly value={recovered} data-session340-output />
      <p role="status" aria-live="polite" data-session340-readback>{readback || "Premi Recupera dopo un'operazione riuscita per verificare e leggere i byte locali."}</p>
      <button type="button" class="session340-clear" onClick={clear}>Svuota cronologia di questa pagina</button>
    </section>
  );
}
