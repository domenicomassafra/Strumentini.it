import { useRef, useState } from "preact/hooks";
import { recognizeLocalItalianOcr246, type OcrResult246 } from "../../../engines/ocr/local-italian-246";

/** Experimental local-only direct route. #271 blocks public production promotion. */
export function LocalItalianOcr246Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Seleziona un'immagine PNG stampata in italiano.");
  const [active, setActive] = useState(false);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [result, setResult] = useState<OcrResult246 | null>(null);
  const operation = useRef<AbortController | null>(null);

  const cancel = () => {
    operation.current?.abort();
    operation.current = null;
    setActive(false);
    setResult(null);
    setStatus("OCR annullato: i worker e i buffer locali vengono chiusi.");
  };

  async function recognize() {
    if (!file || active) return;
    const controller = new AbortController();
    operation.current = controller;
    setActive(true);
    setResult(null);
    setStatus("Avvio del worker OCR italiano locale: il primo caricamento può impiegare tempo.");
    try {
      const recognized = await recognizeLocalItalianOcr246(file, {
        signal: controller.signal,
        rotateClockwiseDegrees: rotation,
        onProgress: (phase, progress) => {
          if (operation.current === controller) {
            setStatus(`${phase} (${Math.round(progress * 100)}%)`);
          }
        },
      });
      if (operation.current !== controller) return;
      setResult(recognized);
      setStatus("OCR terminato sul dispositivo. Verifica il testo prima di riutilizzarlo.");
    } catch (error) {
      if (operation.current !== controller) return;
      const message = error instanceof Error ? error.message : "Errore OCR non classificato";
      setStatus(`OCR non completato: ${message}`);
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setActive(false);
      }
    }
  }

  function downloadTxt() {
    if (!result?.text) return;
    const url = URL.createObjectURL(new Blob([result.text], { type: "text/plain;charset=utf-8" }));
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ocr-italiano-246.txt";
      anchor.click();
    } finally { URL.revokeObjectURL(url); }
  }

  return (
    <section class="ocr246" aria-label="OCR locale italiano sperimentale">
      <label class="ocr246-label" for="ocr246-file">Immagine PNG sul tuo dispositivo (max 5 MiB, 2 megapixel)</label>
      <input id="ocr246-file" type="file" accept="image/png,.png" disabled={active}
        onChange={(event) => {
          cancel();
          const chosen = event.currentTarget.files?.[0] ?? null;
          setFile(chosen);
          setStatus(chosen ? `Pronto: ${chosen.name}` : "Nessuna immagine selezionata.");
        }} />
      <label class="ocr246-label" for="ocr246-rotation">Correzione manuale orientamento, in senso orario</label>
      <select id="ocr246-rotation" value={rotation} disabled={active}
        onChange={(event) => {
          const degrees = Number(event.currentTarget.value);
          if (degrees === 0 || degrees === 90 || degrees === 180 || degrees === 270) {
            setRotation(degrees);
            setResult(null);
            setStatus("Orientamento modificato: riesegui l'OCR italiano prima di usare il testo.");
          }
        }}>
        <option value="0">Nessuna rotazione</option>
        <option value="90">90° orario</option>
        <option value="180">180°</option>
        <option value="270">270° orario</option>
      </select>
      <div class="ocr246-controls">
        <button type="button" data-ocr-run disabled={!file || active} onClick={() => void recognize()}>
          {active ? "Riconoscimento in corso…" : "Estrai testo in italiano"}
        </button>
        <button type="button" data-ocr-cancel disabled={!active} onClick={cancel}>Annulla OCR</button>
      </div>
      <p class="ocr246-status" data-ocr-status role="status" aria-live="polite">{status}</p>
      {result && (
        <div class="ocr246-output" data-ocr-result>
          <h2>Testo riconosciuto</h2>
          <textarea readOnly aria-label="Testo OCR italiano" value={result.text} rows={7} />
          <p>
            Motore: Tesseract.js 7, lingua {result.language}. Origine: {result.image.name}, {result.image.width}×{result.image.height}px.
            {result.rotateClockwiseDegrees !== 0 ? ` Correzione manuale applicata: ${result.rotateClockwiseDegrees}° in senso orario.` : ""}
          </p>
          <p data-ocr-confidence>
            {result.confidence === null ? "Confidenza: non fornita dal motore." :
              `Indicatore di confidenza Tesseract: ${result.confidence.toFixed(1)} / 100 (non è una probabilità calibrata di correttezza).`}
          </p>
          <button type="button" disabled={!result.text} onClick={downloadTxt}>Scarica TXT locale</button>
        </div>
      )}
      <p class="ocr246-note">
        Elaborazione locale in browser, senza invio dell'immagine a servizi esterni. Caricamento differito di WASM e dati italiani dal sito.
        La rotazione è scelta da te, non stimata automaticamente: correggi l'orientamento e verifica il testo. Scansioni difficili e affidabilità su iOS Safari/Android Chrome fisici non sono ancora certificati (#271).
        I file HEIC/JPEG/PDF non sono supportati da questa versione.
      </p>
    </section>
  );
}
