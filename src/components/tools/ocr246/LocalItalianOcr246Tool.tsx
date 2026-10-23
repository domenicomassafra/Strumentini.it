import { useEffect, useRef, useState } from "preact/hooks";
import { recognizeLocalOcr395, type OcrLanguage395, type OcrResult395 } from "../../../engines/ocr/language-395";
import { prepareOcrTextExport395 } from "../../../engines/ocr/correction-395";

/** Experimental local-only direct route. #271 blocks public production promotion. */
export function LocalItalianOcr246Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Seleziona un'immagine PNG stampata in italiano o inglese.");
  const [active, setActive] = useState(false);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [language, setLanguage] = useState<OcrLanguage395>("ita");
  const [result, setResult] = useState<OcrResult395 | null>(null);
  const [editedText, setEditedText] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const operation = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!file || !result) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, result]);

  const cancel = () => {
    operation.current?.abort();
    operation.current = null;
    setActive(false);
    setResult(null);
    setEditedText("");
    setStatus("OCR annullato: i worker e i buffer locali vengono chiusi.");
  };

  async function recognize() {
    if (!file || active) return;
    const controller = new AbortController();
    operation.current = controller;
    setActive(true);
    setResult(null);
    setEditedText("");
    setStatus("Avvio OCR locale: il modello della lingua scelta viene caricato solo ora.");
    try {
      const recognized = await recognizeLocalOcr395(file, language, {
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
      setEditedText(recognized.text);
      setStatus("Bozza OCR locale non verificata: confronta la scansione e correggi il testo prima dell'uso.");
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
    if (!result || !editedText.trim()) return;
    const exportDraft = prepareOcrTextExport395(result, editedText);
    const url = URL.createObjectURL(new Blob([exportDraft.text], { type: "text/plain;charset=utf-8" }));
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = language === "ita" ? "ocr-italiano-246.txt" : "ocr-english-395.txt";
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
      <label class="ocr246-label" for="ocr395-language">Lingua di riconoscimento</label>
      <select id="ocr395-language" value={language} aria-describedby="ocr395-language-note" disabled={active}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (next !== "ita" && next !== "eng") return;
          operation.current?.abort();
          operation.current = null;
          setLanguage(next);
          setResult(null);
          setEditedText("");
          setStatus("Lingua cambiata: riesegui l'OCR prima di usare il testo.");
        }}>
        <option value="ita">Italiano (modello disponibile nel sito)</option>
        <option value="eng">English (download del modello solo all'avvio dell'OCR inglese)</option>
      </select>
      <p id="ocr395-language-note">Entrambi i modelli provengono dal sito. Il modello inglese viene richiesto soltanto quando avvii il riconoscimento inglese.</p>
      <label class="ocr246-label" for="ocr246-rotation">Correzione manuale orientamento, in senso orario</label>
      <select id="ocr246-rotation" value={rotation} disabled={active}
        onChange={(event) => {
          const degrees = Number(event.currentTarget.value);
          if (degrees === 0 || degrees === 90 || degrees === 180 || degrees === 270) {
            setRotation(degrees);
            setResult(null);
            setEditedText("");
            setStatus("Orientamento modificato: riesegui l'OCR prima di usare il testo.");
          }
        }}>
        <option value="0">Nessuna rotazione</option>
        <option value="90">90° orario</option>
        <option value="180">180°</option>
        <option value="270">270° orario</option>
      </select>
      <div class="ocr246-controls">
        <button type="button" data-ocr-run disabled={!file || active} onClick={() => void recognize()}>
          {active ? "Riconoscimento in corso…" : language === "ita" ? "Estrai testo in italiano" : "Extract English text"}
        </button>
        <button type="button" data-ocr-cancel disabled={!active} onClick={cancel}>Annulla OCR</button>
      </div>
      <p class="ocr246-status" data-ocr-status role="status" aria-live="polite">{status}</p>
      {result && (
        <div class="ocr246-output" data-ocr-result>
          <h2>Scansione e trascrizione da correggere</h2>
          <div class="ocr395-review">
            {previewUrl && <figure>
              <img data-ocr-original-preview src={previewUrl} alt={`Scansione originale non modificata: ${result.image.name}`} />
              <figcaption>Originale inalterato. Non sono disponibili coordinate affidabili delle singole parole.</figcaption>
            </figure>}
            <div>
              <label class="ocr246-label" for="ocr395-edit">Modifica la trascrizione confrontandola con la scansione</label>
              <textarea id="ocr395-edit" aria-label={language === "ita" ? "Testo OCR italiano" : "English OCR text"} value={editedText} maxLength={100_000} rows={7}
                onInput={(event) => setEditedText(event.currentTarget.value)} />
              <p data-ocr-correction>{editedText !== result.text
                ? "Testo corretto manualmente: confidenza OCR riferita solo al testo originario."
                : "Bozza automatica da verificare: nessuna conferma di accuratezza."}</p>
            </div>
          </div>
          <p>
            Motore: Tesseract.js 7, lingua {result.language}. Origine: {result.image.name}, {result.image.width}×{result.image.height}px.
            {result.rotateClockwiseDegrees !== 0 ? ` Correzione manuale applicata: ${result.rotateClockwiseDegrees}° in senso orario.` : ""}
          </p>
          <p data-ocr-confidence>
            {result.confidence === null ? "Confidenza: non fornita dal motore." :
              `Indicatore di confidenza Tesseract sul riconoscimento iniziale: ${result.confidence.toFixed(1)} / 100 (non è una probabilità calibrata di correttezza né valuta le correzioni).`}
          </p>
          <button type="button" disabled={!editedText.trim()} onClick={downloadTxt}>Scarica TXT locale</button>
        </div>
      )}
      <p class="ocr246-note">
        Elaborazione locale in browser, senza invio dell'immagine a servizi esterni. Caricamento differito di WASM e del modello italiano o inglese dal sito, soltanto all’avvio della lingua scelta.
        La rotazione è scelta da te, non stimata automaticamente: correggi l'orientamento e verifica il testo. Scansioni difficili e affidabilità su iOS Safari/Android Chrome fisici non sono ancora certificati (#271).
        I file HEIC/JPEG/PDF non sono supportati da questa versione.
      </p>
    </section>
  );
}
