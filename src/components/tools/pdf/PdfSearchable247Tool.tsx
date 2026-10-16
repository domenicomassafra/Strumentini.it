import { useEffect, useRef, useState } from "preact/hooks";
import type { PdfSearchableResult247 } from "../../../engines/pdf/ocr-searchable-247.browser";

/** Direct, noindex experimental route. #246/#271 still block product promotion. */
export function PdfSearchable247Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("Scegli un PDF locale entro 8 MiB, massimo 3 pagine.");
  const [result, setResult] = useState<PdfSearchableResult247 | null>(null);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);

  const cancel = () => {
    current.current?.abort();
    current.current = null;
    setActive(false);
    setResult(null);
    setStatus("Conversione annullata, nessun PDF pronto per il download.");
  };
  const run = async () => {
    if (!file || active) return;
    const controller = new AbortController();
    current.current = controller;
    setActive(true);
    setResult(null);
    setStatus("Controllo pagine e avvio OCR locale sulle scansioni…");
    try {
      const { makeSearchableScannedPdf247 } = await import("../../../engines/pdf/ocr-searchable-247.browser");
      if (controller.signal.aborted) return;
      const produced = await makeSearchableScannedPdf247(file, controller.signal);
      if (current.current !== controller) return;
      setResult(produced);
      setStatus("Verificato in PDF.js: testo selezionabile e confronto dei pixel superato.");
    } catch (error) {
      if (current.current !== controller) return;
      setStatus(`Conversione rifiutata: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (current.current === controller) {
        current.current = null;
        setActive(false);
      }
    }
  };
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes)], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const downloadText = () => {
    if (!result) return;
    const text = result.pages.map((page) => `Pagina ${page.page}\n${page.text}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename.replace(/\.pdf$/iu, ".txt");
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return <section class="ocr247" aria-label="PDF scansionato con testo ricercabile (esperimento)">
    <label for="ocr247-file"><strong>PDF da questo dispositivo</strong> (max 8 MiB; fino a 3 pagine, 2 scansioni)</label>
    <input id="ocr247-file" type="file" accept=".pdf,application/pdf" disabled={active} onChange={(event) => {
      cancel();
      const selected = event.currentTarget.files?.[0] ?? null;
      setFile(selected);
      setStatus(selected ? `Pronto: ${selected.name}` : "Nessun PDF selezionato.");
    }} />
    <div class="ocr247-actions">
      <button type="button" data-ocr247-run disabled={!file || active} onClick={() => void run()}>{active ? "OCR in esecuzione…" : "Aggiungi testo selezionabile"}</button>
      <button type="button" data-ocr247-cancel disabled={!active} onClick={cancel}>Annulla</button>
    </div>
    <p data-ocr247-status role="status" aria-live="polite">{status}</p>
    {result && <div data-ocr247-result>
      <h2>PDF convertito e verificato</h2>
      <p>Contenuto originale mantenuto, testo OCR invisibile e selezionabile. Tolleranza: al massimo 0,05% dei pixel diversi e differenza massima di 3/255 per canale; ogni pagina confrontata mediante PDF.js.</p>
      <ul>{result.pages.map((page) => <li key={page.page}>
        Pagina {page.page}: {page.state === "OCR_ADDED"
          ? `OCR inserito (${page.wordCount} parole, confidenza Tesseract ${page.confidence?.toFixed(1) ?? "non disponibile"}/100, non calibrata)`
          : "testo PDF originale preservato, nessun nuovo OCR"}.
        Pixel modificati: {(page.differentPixelsRatio * 100).toFixed(4)}%; differenza massima {page.maxChannelDifference}/255.
      </li>)}</ul>
      {result.pages.map((page) => <label key={page.page} class="ocr247-text-page">
        <strong>Testo pagina {page.page} ({page.state === "OCR_ADDED" ? "riconosciuto dall'immagine" : "già presente nel PDF"})</strong>
        <textarea readOnly rows={5} aria-label={`Testo pagina ${page.page}`} value={page.text} />
      </label>)}
      <button type="button" onClick={downloadText}>Scarica testo TXT con numeri di pagina</button>
      <button type="button" onClick={download}>Scarica PDF OCR verificato</button>
    </div>}
    <p>Prototipo italiano per testo stampato orientato correttamente. Il livello OCR è creato soltanto se Tesseract restituisce coordinate valide, confidenza pagina almeno 75/100 e confidenza di ciascuna parola almeno 45/100; anche questi indicatori sono non calibrati e il testo potrebbe essere sbagliato. I PDF firmati, cifrati, ruotati o complessi vengono rifiutati. Le pagine con testo digitale preesistente vengono conservate e non ricevono OCR, anche quando contengono immagini con scritte.</p>
    <p>Il file resta nel browser: PDF.js, worker Tesseract e modello italiano sono caricati localmente su richiesta. La verifica su iOS Safari e Android Chrome fisici e le misure di memoria WASM/native necessarie all'approvazione (#271) restano aperte.</p>
  </section>;
}
