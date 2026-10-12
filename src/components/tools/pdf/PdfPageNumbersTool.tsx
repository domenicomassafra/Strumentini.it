import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { numberPdfPages, planPdfPageNumbers, type PdfNumberFont, type PdfNumberPosition } from "../../../engines/pdf/page-numbers";
import { openPdfThumbnailSession, pdfThumbnailWindow, type PdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import { pdfPageNumbersManifest } from "../../../tools/pdf-page-numbers/manifest";

type Thumb = { page: number; url: string };

const POSITIONS: readonly { value: PdfNumberPosition; label: string }[] = [
  { value: "top-left", label: "In alto a sinistra" },
  { value: "top-center", label: "In alto al centro" },
  { value: "top-right", label: "In alto a destra" },
  { value: "bottom-left", label: "In basso a sinistra" },
  { value: "bottom-center", label: "In basso al centro" },
  { value: "bottom-right", label: "In basso a destra" },
];

export function PdfPageNumbersTool() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pages, setPages] = useState("*");
  const [startNumber, setStartNumber] = useState("1");
  const [offset, setOffset] = useState("0");
  const [position, setPosition] = useState<PdfNumberPosition>("bottom-center");
  const [font, setFont] = useState<PdfNumberFont>("Helvetica");
  const [fontSize, setFontSize] = useState("12");
  const [margin, setMargin] = useState("24");
  const [output, setOutput] = useState<Blob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [writeError, setWriteError] = useState("");
  const [start, setStart] = useState(1);
  const [session, setSession] = useState<PdfThumbnailSession | null>(null);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [previewError, setPreviewError] = useState("");
  // A submit acquires this lock synchronously, before any RAF or Preact paint.
  // Changing the input, cancelling or unmounting invalidates the result even
  // if the previously scheduled async continuation later resolves.
  const generation = useRef(0);
  const inFlight = useRef(false);

  function invalidate() {
    generation.current += 1;
    inFlight.current = false;
    setRunning(false);
    setOutput(null);
    setWriteError("");
  }

  useEffect(() => () => {
    generation.current += 1;
    inFlight.current = false;
  }, []);

  const options = { pages, startNumber: Number(startNumber), offset: Number(offset),
    position, font, fontSize: Number(fontSize), margin: Number(margin) };
  const planResult = useMemo(() => {
    if (bytes === null) return { plan: null, error: "" };
    try { return { plan: planPdfPageNumbers(bytes, options), error: "" }; }
    catch (error) { return { plan: null, error: error instanceof Error ? error.message : "Opzioni numerazione non valide" }; }
  }, [bytes, pages, startNumber, offset, position, font, fontSize, margin]);
  const plan = planResult.plan;

  useEffect(() => {
    if (file === null) { setBytes(null); return; }
    let alive = true;
    void file.arrayBuffer().then((buffer) => {
      if (alive) { setBytes(new Uint8Array(buffer)); setLoadError(""); }
    }, (reason) => { if (alive) setLoadError(reason instanceof Error ? reason.message : "PDF non leggibile"); });
    return () => { alive = false; };
  }, [file]);

  useEffect(() => {
    if (file === null || bytes === null) { setSession(null); return; }
    let active = true;
    let current: PdfThumbnailSession | null = null;
    const controller = new AbortController();
    void openPdfThumbnailSession(file, controller.signal).then((ready) => {
      current = ready;
      if (!active) { void ready.close(); return; }
      setSession(ready);
      setPreviewError("");
    }, (error) => { if (active) setPreviewError(error instanceof Error ? error.message : "Anteprima non disponibile"); });
    return () => { active = false; controller.abort(); if (current !== null) void current.close(); };
    // PDF bytes and document identity only: changing the position should not re-open PDF.js.
  }, [file, bytes]);

  useEffect(() => {
    if (session === null || plan === null) { setThumbs([]); return; }
    let alive = true;
    const urls: string[] = [];
    const controller = new AbortController();
    setThumbs([]);
    void (async () => {
      for (const page of pdfThumbnailWindow(plan.pageCount, start)) {
        if (!alive) break;
        try {
          const blob = await session.renderPage(page, 0, controller.signal);
          if (!alive) break;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setThumbs((current) => [...current, { page, url }]);
        } catch (error) {
          if (alive) setPreviewError(error instanceof Error ? error.message : "Anteprima non disponibile");
        }
      }
    })();
    return () => { alive = false; controller.abort(); for (const url of urls) URL.revokeObjectURL(url); };
  }, [session, start, plan?.pageCount]);

  useEffect(() => {
    if (output === null) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(output);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [output]);

  function choose(event: Event) {
    const selected = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    invalidate();
    setBytes(null);
    setFile(selected);
    setLoadError("");
    setPreviewError("");
    setStart(1);
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (inFlight.current) return;
    if (bytes === null || plan === null) { invalidate(); return; }
    const operation = ++generation.current;
    inFlight.current = true;
    setOutput(null);
    setWriteError("");
    setRunning(true);
    try {
      // Yield so the "working" state paints before bounded CPU-only PDF rebuilding.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (operation !== generation.current) return;
      const result = numberPdfPages(bytes, options);
      if (operation !== generation.current) return;
      if (!(result.artifact.blob instanceof Blob) || result.artifact.blob.size < 100) {
        throw new Error("PDF numerato non disponibile");
      }
      setOutput(result.artifact.blob);
      // No bytes, file names, options, selected pages or PDF content are stored.
      recordCompletedTool(pdfPageNumbersManifest.id);
    } catch (error) {
      if (operation === generation.current) {
        setWriteError(error instanceof Error ? error.message : "Impossibile creare PDF numerato");
      }
    } finally {
      if (operation === generation.current) {
        inFlight.current = false;
        setRunning(false);
      }
    }
  }

  return (
    <form class="tool-operation" onSubmit={(event) => { void submit(event); }} data-pdf-page-numbers>
      <label class="field"><span>PDF locale da numerare</span>
        <input type="file" accept="application/pdf,.pdf" onChange={choose} />
      </label>
      <p class="file-note">I file restano nel browser. I numeri vengono inseriti in nuovi stream PDF: testo, vettori e immagini originali non sono rasterizzati.</p>
      <div class="field-grid">
        <label class="field"><span>Pagine da numerare</span>
          <input value={pages} onInput={(event) => { invalidate(); setPages(event.currentTarget.value); }} placeholder="*, 2-5, 7" />
          <small>* = tutte; es. 2-4,7. Intervalli ripetuti, invertiti o fuori documento sono rifiutati.</small>
        </label>
        <label class="field"><span>Posizione</span>
          <select value={position} onChange={(event) => { invalidate(); setPosition(event.currentTarget.value as PdfNumberPosition); }}>
            {POSITIONS.map(({ value, label }) => <option value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <div class="field-grid">
        <label class="field"><span>Numero iniziale</span><input type="number" min="1" max="9999" step="1" value={startNumber} onInput={(event) => { invalidate(); setStartNumber(event.currentTarget.value); }} /></label>
        <label class="field"><span>Offset numerazione</span><input type="number" min="-999" max="999" step="1" value={offset} onInput={(event) => { invalidate(); setOffset(event.currentTarget.value); }} /></label>
      </div>
      <div class="field-grid">
        <label class="field"><span>Font</span>
          <select value={font} onChange={(event) => { invalidate(); setFont(event.currentTarget.value as PdfNumberFont); }}>
            <option value="Helvetica">Helvetica</option><option value="Courier">Courier</option><option value="Times-Roman">Times Roman</option>
          </select>
        </label>
        <label class="field"><span>Dimensione font (pt)</span><input type="number" min="8" max="36" step="1" value={fontSize} onInput={(event) => { invalidate(); setFontSize(event.currentTarget.value); }} /></label>
        <label class="field"><span>Margine (pt)</span><input type="number" min="8" max="72" step="1" value={margin} onInput={(event) => { invalidate(); setMargin(event.currentTarget.value); }} /></label>
      </div>
      {loadError || planResult.error ? <p role="alert">{loadError || planResult.error}</p> : null}
      {plan !== null ? (
        <section aria-label="Anteprima numerazione su geometria reale" data-number-plan>
          <p role="status">{plan.selectedPages.length} pagine di {plan.pageCount} selezionate; numeri: {plan.placements.slice(0, 5).map((entry) => `pag. ${entry.page} → ${entry.label}`).join(", ")}{plan.placements.length > 5 ? "…" : ""}</p>
          <div class="actions" aria-label="Navigazione anteprime">
            <button type="button" disabled={start <= 1} onClick={() => setStart((value) => Math.max(1, value - 4))}>Anteprime precedenti</button>
            <label>Da pagina <input type="number" min="1" max={plan.pageCount} value={start} onInput={(event) => {
              const value = Number(event.currentTarget.value);
              if (Number.isInteger(value) && value >= 1 && value <= plan.pageCount) setStart(value);
            }} /></label>
            <button type="button" disabled={start + 4 > plan.pageCount} onClick={() => setStart((value) => Math.min(plan.pageCount, value + 4))}>Anteprime successive</button>
          </div>
          {previewError ? <p role="alert">Anteprima PDF.js: {previewError}</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 152px), 1fr))", gap: "0.75rem" }}>
            {pdfThumbnailWindow(plan.pageCount, start).map((page) => {
              const placement = plan.placements.find((item) => item.page === page);
              const thumb = thumbs.find((item) => item.page === page);
              return (
                <div data-number-preview-page={page} style={{ minWidth: 0 }}>
                  <div style={{ position: "relative", maxWidth: "176px", margin: "0 auto", aspectRatio: placement ? `${placement.displayWidth}/${placement.displayHeight}` : undefined }}>
                    {thumb ? <img src={thumb.url} alt={`Contenuto originale pagina ${page}`} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} /> : <span>Anteprima pagina {page}…</span>}
                    {thumb && placement ? <svg data-number-overlay-page={page} aria-label={`Numero ${placement.label} nella posizione ${position}`} viewBox={`0 0 ${placement.displayWidth} ${placement.displayHeight}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                      <text x={placement.x} y={placement.displayHeight - placement.y} fontFamily={placement.font} fontSize={placement.fontSize} fill="#b12626">{placement.label}</text>
                    </svg> : null}
                  </div>
                  <p class="file-note">Pagina {page}{placement ? ` · numero ${placement.label} (${placement.rotation}°)` : " · invariata"}</p>
                </div>
              );
            })}
          </div>
          <p class="file-note">Le cifre rosse sono la sovrapposizione di anteprima sulle miniature PDF.js originali; nel PDF finale saranno nere.</p>
        </section>
      ) : null}
      <div class="actions">
        <button class="primary" type="submit" disabled={running || plan === null}>{running ? "Numerazione in corso…" : "Applica numerazione"}</button>
        {running ? <button type="button" onClick={invalidate}>Annulla numerazione</button> : null}
      </div>
      {writeError ? <p role="alert">{writeError}</p> : null}
      {downloadUrl !== "" ? <div class="result-panel" data-state="success"><p role="status">PDF numerato verificato localmente: {plan?.pageCount} pagine, testo originale mantenuto.</p><a href={downloadUrl} download="pdf-numerato.pdf">Scarica PDF numerato</a></div> : null}
    </form>
  );
}
