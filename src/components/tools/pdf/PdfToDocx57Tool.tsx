import { useEffect, useRef, useState } from "preact/hooks";
import type { PdfDocx57Result } from "../../../engines/pdf/pdf-to-docx-57";
import { recordCompletedTool } from "../../../workbench/completed-tool";

export function PdfToDocx57Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PdfDocx57Result | null>(null);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!result) { setUrl(""); return; }
    const objectUrl = URL.createObjectURL(new Blob([result.bytes.slice().buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result]);
  useEffect(() => () => { generation.current++; abort.current?.abort(); }, []);

  function invalidate() {
    generation.current++;
    inFlight.current = false;
    abort.current?.abort(); abort.current = null;
    setBusy(false); setResult(null); setError("");
  }
  async function convert(event: Event) {
    event.preventDefault();
    if (!file || busy || inFlight.current) return;
    inFlight.current = true;
    setResult(null); setError(""); setBusy(true);
    const controller = new AbortController();
    const request = ++generation.current;
    abort.current = controller;
    try {
      const { pdfToDocx57 } = await import("../../../engines/pdf/pdf-to-docx-57");
      const output = await pdfToDocx57(file, controller.signal);
      if (!controller.signal.aborted && request === generation.current && output.bytes.length > 0) {
        setResult(output);
        // This optional DOCX mode belongs to the canonical PDF-to-Markdown route.
        // Only the catalogue ID, use count and timestamp enter Recenti.
        recordCompletedTool("pdf-to-markdown");
      }
    } catch (cause) {
      if (!controller.signal.aborted && request === generation.current) setError(cause instanceof Error ? cause.message : "Impossibile convertire PDF in Word.");
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        inFlight.current = false;
      }
      if (request === generation.current) setBusy(false);
    }
  }

  return <section data-pdf-docx-57 class="tool-surface" style={{ marginTop: "2rem" }}>
    <h2>PDF → Word DOCX modificabile (testo e tabelle semplici)</h2>
    <p>Nei PDF con testo selezionabile su una colonna, il testo diventa un documento Word modificabile. Le tabelle con griglie completamente tracciate diventano vere tabelle Word.
      Colonne affiancate, immagini e grafica non ricostruibile vengono rifiutate; font, stili e posizioni esatte non sono garantiti. Il risultato include provenienza PDF, SHA-256 e numero di pagina. Limite: 8 MiB e 12 pagine.</p>
    <form onSubmit={(event) => void convert(event)}>
      <label class="field"><span>PDF sorgente per Word</span><input type="file" aria-label="PDF sorgente per Word" accept=".pdf,application/pdf"
        onChange={(event) => { invalidate(); setFile(event.currentTarget.files?.[0] ?? null); }} /></label>
      <div class="actions"><button class="primary" disabled={busy || !file} type="submit">{busy ? "Converto e verifico DOCX…" : "Crea DOCX modificabile"}</button>
        <button type="button" disabled={!busy} onClick={invalidate}>Annulla</button></div>
    </form>
    {error && <p role="alert">{error} {error.includes("OCR_REQUIRED") && <a href="/tools/ocr-italiano-locale-246/">Apri OCR italiano locale (passaggio manuale)</a>}</p>}
    {result && url && <section data-pdf-docx-57-result aria-label="DOCX verificato">
      <p role="status">DOCX verificato: {result.pageCount} pagine e {result.tableCount} tabelle editabili, con provenienza identificabile. SHA-256 sorgente: {result.sourceSha256}.</p>
      <ul>{result.losses.map((note) => <li>{note}</li>)}</ul>
      <p><strong>Anteprima del testo estratto</strong></p>
      {result.textByPage.map(({ page, text }) => <details><summary>Pagina {page}</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text.slice(0, 600)}</pre></details>)}
      <a href={url} download={result.filename} data-pdf-docx-57-download>Scarica DOCX modificabile verificato</a>
    </section>}
  </section>;
}
