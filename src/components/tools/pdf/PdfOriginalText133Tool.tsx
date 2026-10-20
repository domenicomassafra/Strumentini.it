import { useEffect, useRef, useState } from "preact/hooks";
import { editPdfOriginalTextInWorker133 } from "../../../engines/pdf/edit-original-text-worker-client-133";
import { PDF_LIMITS } from "../../../engines/pdf/types";
import { DownloadLink } from "../marketing-media/DownloadLink";

interface PreparedEdit {
  readonly blob: Blob;
  readonly pageCount: number;
  readonly font: string;
}

export function PdfOriginalText133Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState("1");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreparedEdit | null>(null);
  const active = useRef<AbortController | null>(null);

  function clearResult() {
    setResult(null);
    setError("");
  }
  function cancel() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setError("Operazione annullata. Nessun PDF esportato.");
  }
  function choose(event: Event) {
    cancel();
    setError("");
    setFile((event.currentTarget as HTMLInputElement).files?.[0] ?? null);
    setResult(null);
  }
  useEffect(() => () => { active.current?.abort(); }, []);

  async function submit(event: Event) {
    event.preventDefault();
    if (busy || !file || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (file.size > PDF_LIMITS.maxBytes) throw new Error("PDF oltre 25 MiB.");
      const edited = await editPdfOriginalTextInWorker133(file, { page: Number(page), before, after }, controller.signal);
      if (controller.signal.aborted || active.current !== controller) return;
      setResult({
        blob: new Blob([Uint8Array.from(edited.bytes)], { type: "application/pdf" }),
        font: edited.font,
        pageCount: edited.pageCount,
      });
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError((cause instanceof Error ? cause.message : "PDF non supportato")
          + ". Originale conservato. Nessun PDF generato.");
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  return <section class="tool-operation" id="modifica-testo-originale" data-pdf-original-text-133>
    <section class="tool-form-card">
      <h2>Modifica testo originale PDF · casi semplici</h2>
      <p>Modifica una singola stringa già presente nella pagina, usando il font Courier originale.
        La nuova stringa deve avere lo stesso numero di caratteri ASCII. Ogni pagina deve contenere una sola stringa Courier semplice. Non viene aggiunto un overlay.</p>
      <p>File cifrati, firmati, con annotazioni, form, font diversi, testo suddiviso, stream compressi o layout ambiguo sono rifiutati.
        Nessun upload: il file resta nel browser. Questa funzione limitata non estende la certificazione del riordino pagine.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label class="field"><span>PDF originale (massimo 25 MiB)</span>
          <input type="file" accept="application/pdf,.pdf" aria-label="PDF originale da modificare"
            onChange={choose} disabled={busy} />
        </label>
        <label class="field"><span>Pagina da modificare (da 1)</span>
          <input type="number" min="1" step="1" value={page} aria-label="Pagina testo originale"
            onInput={(event) => { setPage(event.currentTarget.value); clearResult(); }} disabled={busy} />
        </label>
        <label class="field"><span>Testo originale esatto</span>
          <input type="text" value={before} maxLength={128} aria-label="Testo originale esatto"
            onInput={(event) => { setBefore(event.currentTarget.value); clearResult(); }} disabled={busy} />
        </label>
        <label class="field"><span>Nuovo testo, stessa lunghezza</span>
          <input type="text" value={after} maxLength={128} aria-label="Testo sostitutivo"
            onInput={(event) => { setAfter(event.currentTarget.value); clearResult(); }} disabled={busy} />
        </label>
        <div class="actions">
          <button type="submit" disabled={busy || !file || !before || !after}>Modifica e verifica PDF</button>
          {busy && <button type="button" onClick={cancel}>Annulla</button>}
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Elaborazione locale del documento…</p>}
      {result && <section role="status" data-pdf-original-text-result>
        <h3>PDF verificato e pronto</h3>
        <p>{result.pageCount} pagine. Font {result.font} mantenuto; avanzamento dei glifi invariato.
          Testo originale sostituito in una copia, file sorgente immutato.</p>
        <DownloadLink blob={result.blob} filename="pdf-testo-modificato.pdf">Scarica PDF modificato</DownloadLink>
      </section>}
    </section>
  </section>;
}
