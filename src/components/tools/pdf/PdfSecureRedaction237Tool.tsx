import { useEffect, useRef, useState } from "preact/hooks";
import type { RedactionRegion237, RedactionProof237 } from "../../../engines/pdf/secure-raster-redaction-237";
import { assertSupportedSource237, validateRedactionPlan237 } from "../../../engines/pdf/secure-raster-redaction-237";
import { openPdfThumbnailSession } from "../../../engines/pdf/thumbnails";

interface Preview237 { readonly page: number; readonly url: string }
interface Ready237 { readonly blob: Blob; readonly name: string; readonly proof: RedactionProof237 }
const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;

/** DEV-only investigative route. Never a general-purpose/public security guarantee. */
export function PdfSecureRedaction237Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState(0);
  const [previews, setPreviews] = useState<readonly Preview237[]>([]);
  const [regions, setRegions] = useState<readonly RedactionRegion237[]>([]);
  const [page, setPage] = useState("1");
  const [left, setLeft] = useState("10");
  const [top, setTop] = useState("10");
  const [width, setWidth] = useState("25");
  const [height, setHeight] = useState("12");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Scegli un PDF locale entro 8 MiB, massimo quattro pagine.");
  const [result, setResult] = useState<Ready237 | null>(null);
  const current = useRef<AbortController | null>(null);

  const cancel = () => {
    current.current?.abort();
    current.current = null;
    setBusy(false);
    setResult(null);
  };

  useEffect(() => {
    if (file === null) { setPreviews([]); setPages(0); return; }
    let alive = true;
    const abort = new AbortController();
    let session: Awaited<ReturnType<typeof openPdfThumbnailSession>> | null = null;
    const urls: string[] = [];
    void (async () => {
      try {
        if (file.size > 8 * 1024 * 1024) throw new Error("REDACTION_REFUSED: PDF oltre 8 MiB.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (abort.signal.aborted) return;
        const count = assertSupportedSource237(bytes);
        session = await openPdfThumbnailSession(file, abort.signal);
        if (session.pageCount !== count) throw new Error("REDACTION_REFUSED: interpreti PDF non concordi.");
        if (!alive) return;
        setPages(count);
        for (let i = 1; i <= count; i++) {
          const rendered = await session.renderPage(i, 0, abort.signal);
          if (!alive) return;
          const url = URL.createObjectURL(rendered);
          urls.push(url);
          setPreviews((old) => [...old, { page: i, url }]);
        }
        if (alive) setStatus(`${count} pagine verificate in anteprima. Aggiungi da 1 a 12 rettangoli.`);
      } catch (error) {
        if (alive) { setStatus(`Anteprima rifiutata: ${error instanceof Error ? error.message : String(error)}`); setPages(0); setPreviews([]); }
      } finally { if (session) await session.close(); }
    })();
    return () => { alive = false; abort.abort(); urls.forEach(URL.revokeObjectURL); if (session) void session.close(); };
  }, [file]);

  useEffect(() => {
    if (result === null) return;
    // Changing a plan must invalidate a previously verified download.
    setResult(null);
  }, [regions]);

  useEffect(() => () => current.current?.abort(), []);

  function selectFile(event: Event) {
    cancel();
    setRegions([]);
    setPreviews([]);
    setPages(0);
    const selected = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    setFile(selected);
    setStatus(selected ? `Controllo il PDF ${selected.name}…` : "Nessun PDF selezionato.");
  }

  const add = () => {
    try {
      const candidate = { page: Number(page), left: Number(left) / 100, top: Number(top) / 100,
        width: Number(width) / 100, height: Number(height) / 100 };
      if ([left, top, width, height].some((text) => text.trim() === "")) throw new Error("Coordinate mancanti.");
      validateRedactionPlan237(pages, [...regions, candidate]);
      setRegions((old) => [...old, candidate]);
      setStatus(`Rettangolo ${regions.length + 1} aggiunto. Nessun PDF esportato.`);
    } catch (error) {
      setStatus(`Area rifiutata: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const run = async () => {
    if (!file || pages < 1 || busy || regions.length === 0) return;
    cancel();
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    setStatus("Oscuramento raster locale e verifica integrale del PDF esportato…");
    try {
      const { redactPdfRaster237 } = await import("../../../engines/pdf/secure-raster-redaction-237");
      const output = await redactPdfRaster237(file, regions, controller.signal);
      if (current.current !== controller) return;
      setResult({ blob: output.artifact.blob, name: output.artifact.filename, proof: output.proof });
      setStatus(`Esportazione verificata: ${output.proof.verifiedBlackPixels} pixel neri, nessun oggetto sorgente copiato.`);
    } catch (error) {
      if (current.current !== controller) return;
      setResult(null);
      setStatus(`REDACTION_REFUSED: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (current.current === controller) { current.current = null; setBusy(false); }
    }
  };

  const [downloadUrl, setDownloadUrl] = useState("");
  useEffect(() => {
    if (result === null) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(result.blob);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  return <section class="redaction237" aria-label="Verifica sperimentale oscuramento PDF" data-redaction237>
    <label class="field"><span>Documento da verificare (PDF locale; massimo 8 MiB)</span>
      <input type="file" accept="application/pdf,.pdf" onChange={selectFile} disabled={busy} />
    </label>
    <p role="note">Prototipo limitato: converte <strong>tutte</strong> le pagine in immagini RGB, eliminando testo selezionabile e vettori da tutto il documento. Non è un sostituto certificato dell'oscuramento professionale. PDF firmati, allegati, annotazioni e strutture complesse sono rifiutati.</p>
    {pages > 0 && <>
      <fieldset disabled={busy}><legend>Regione da rendere nera (coordinate in percentuale del foglio visibile)</legend>
        <div class="field-grid">
          <label class="field"><span>Pagina</span><select value={page} onChange={(event) => setPage(event.currentTarget.value)}>{Array.from({ length: pages }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}</select></label>
          {([ ["X sinistra", left, setLeft], ["Y alto", top, setTop], ["Larghezza", width, setWidth], ["Altezza", height, setHeight] ] as const).map(([name, value, setter]) =>
            <label class="field" key={name}><span>{name} (%)</span><input type="number" min="0" max="100" step="0.1" value={value} onInput={(event) => setter(event.currentTarget.value)} /></label>)}
        </div>
        <button type="button" onClick={add} disabled={regions.length >= 12}>Aggiungi area nera</button>
      </fieldset>
      <div class="redaction237-pages">{previews.map((preview) => <figure key={preview.page}>
        <div class="redaction237-preview"><img src={preview.url} alt={`Anteprima della pagina ${preview.page}`} />
          {regions.filter((r) => r.page === preview.page).map((r, i) => <span key={i} class="redaction237-box" style={{ left: percent(r.left), top: percent(r.top), width: percent(r.width), height: percent(r.height) }} aria-hidden="true" />)}
        </div><figcaption>Pagina {preview.page} — anteprima delle aree in nero (non è ancora esportazione)</figcaption>
      </figure>)}</div>
      {regions.length > 0 && <ol>{regions.map((r, i) => <li key={i}>
        Pagina {r.page}: x={percent(r.left)}, y={percent(r.top)}, larghezza={percent(r.width)}, altezza={percent(r.height)}.
        <button type="button" disabled={busy} onClick={() => { setRegions((old) => old.filter((_, index) => index !== i)); setResult(null); }}>Rimuovi area {i + 1}</button>
      </li>)}</ol>}
      <div class="actions"><button type="button" disabled={busy || regions.length === 0 || previews.length !== pages} onClick={() => void run()} data-redaction237-run>{busy ? "Verifica in corso…" : "Rimuovi le aree e verifica PDF"}</button>
        <button type="button" disabled={!busy} onClick={() => { cancel(); setStatus("Annullato: nessun PDF scaricabile."); }}>Annulla</button></div>
    </>}
    <p role="status" aria-live="polite" data-redaction237-status>{status}</p>
    {result !== null && downloadUrl !== "" && <div data-redaction237-proof>
      <p>Prova tecnica locale: {result.proof.pageCount} pagine; {result.proof.verifiedBlackPixels} pixel oscurati e controllati nel PDF ricostruito. Il file non contiene testo cercabile; il resto della pagina è rasterizzato.</p>
      <a href={downloadUrl} download={result.name}>Scarica PDF raster con aree rimosse</a>
    </div>}
  </section>;
}
