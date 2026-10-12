import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { createPdfNUp, planPdfNUp, type NUpMode, type NUpOrder, type NUpOrientation, type NUpPaper, type PdfNUpOptions } from "../../../engines/pdf/n-up";
import { openPdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import { inspectPdfBytes } from "../../../engines/pdf";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import { pdfNUpManifest } from "../../../tools/pdf-n-up/manifest";

export function PdfNUpTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<NUpMode>("2-up");
  const [rows, setRows] = useState("2");
  const [columns, setColumns] = useState("2");
  const [paper, setPaper] = useState<NUpPaper>("a4");
  const [orientation, setOrientation] = useState<NUpOrientation>("portrait");
  const [customWidth, setCustomWidth] = useState("595.28");
  const [customHeight, setCustomHeight] = useState("841.89");
  const [margin, setMargin] = useState("18");
  const [gap, setGap] = useState("12");
  const [order, setOrder] = useState<NUpOrder>("row-major");
  const [shownSheet, setShownSheet] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [resultPreview, setResultPreview] = useState("");
  const [resultPreviewError, setResultPreviewError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  // The export itself yields to an animation frame and then PDF.js. Acquire
  // an immediate lock, and invalidate any result from an obsolete input/job.
  const generation = useRef(0);
  const inFlight = useRef(false);
  const currentController = useRef<AbortController | null>(null);

  function invalidate() {
    generation.current++;
    inFlight.current = false;
    currentController.current?.abort();
    currentController.current = null;
    setBusy(false);
    setResult(null);
    setError("");
    setResultPreviewError("");
  }

  useEffect(() => () => {
    generation.current++;
    inFlight.current = false;
    currentController.current?.abort();
    currentController.current = null;
  }, []);

  const options: PdfNUpOptions = {
    mode, rows: Number(rows), columns: Number(columns), paper, orientation,
    customWidth: Number(customWidth), customHeight: Number(customHeight), margin: Number(margin), gap: Number(gap), order,
  };
  const prepared = useMemo(() => {
    if (pageCount === 0) return { plan: null, error: "" };
    try { return { plan: planPdfNUp(pageCount, options), error: "" }; }
    catch (exception) { return { plan: null, error: exception instanceof Error ? exception.message : "Piano n-up non valido" }; }
  }, [pageCount, mode, rows, columns, paper, orientation, customWidth, customHeight, margin, gap, order]);
  const plan = prepared.plan;

  useEffect(() => {
    if (!file) { setPageCount(0); return; }
    let live = true;
    void file.arrayBuffer().then((value) => {
      if (!live) return;
      const inspected = inspectPdfBytes(new Uint8Array(value));
      if (inspected.encrypted) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato");
      setPageCount(inspected.pageCount);
      setError("");
    }).catch((exception) => { if (live) { setError(exception instanceof Error ? exception.message : "PDF invalido"); setPageCount(0); } });
    return () => { live = false; };
  }, [file]);

  useEffect(() => {
    if (!result) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(result);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  useEffect(() => {
    if (!result) { setResultPreview(""); return; }
    let live = true;
    let close: () => Promise<void> = async () => {};
    let previewUrl = "";
    setResultPreview("");
    setResultPreviewError("");
    void (async () => {
      const session = await openPdfThumbnailSession(new File([result], "pdf-n-up-raster.pdf", { type: "application/pdf" }));
      close = () => session.close();
      try {
        const png = await session.renderPage(Math.min(shownSheet, session.pageCount));
        if (live) { previewUrl = URL.createObjectURL(png); setResultPreview(previewUrl); }
      } finally { await session.close(); }
    })().catch((exception) => { if (live) setResultPreviewError(exception instanceof Error ? exception.message : "Anteprima non disponibile"); });
    return () => { live = false; void close(); if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [result, shownSheet]);

  function changed<T>(setter: (value: T) => void, value: T) {
    invalidate();
    setter(value);
  }
  async function submit(event: Event) {
    event.preventDefault();
    if (inFlight.current) return;
    if (!file || !plan) { invalidate(); return; }
    const operation = ++generation.current;
    inFlight.current = true;
    const controller = new AbortController();
    currentController.current = controller;
    setResult(null); setError(""); setBusy(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (operation !== generation.current || controller.signal.aborted) return;
      const created = await createPdfNUp(file, options, controller.signal);
      if (operation !== generation.current || controller.signal.aborted) return;
      if (!(created.artifact.blob instanceof Blob) || created.artifact.blob.size < 100) {
        throw new Error("PDF n-up non disponibile");
      }
      setResult(created.artifact.blob);
      // Persist catalog identity only after a real, current output exists.
      // Never pass source filename, raster JPEG/PDF bytes or options to Recenti.
      recordCompletedTool(pdfNUpManifest.id);
    } catch (exception) {
      if (operation === generation.current && !controller.signal.aborted) {
        setError(exception instanceof Error ? exception.message : "Conversione n-up non riuscita");
      }
    } finally {
      if (operation === generation.current) {
        inFlight.current = false;
        currentController.current = null;
        setBusy(false);
      }
    }
  }

  const sheet = plan?.sheets[Math.min(shownSheet, plan.sheetCount) - 1];
  return <form class="tool-operation" data-pdf-n-up onSubmit={(event) => { void submit(event); }} style={{ width: "100%", maxWidth: "950px", margin: "0 auto" }}>
    <label class="field"><span>PDF originale</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => {
      const next = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
      invalidate(); setFile(next); setPageCount(0); setShownSheet(1);
    }} /></label>
    <div class="field-grid">
      <label class="field"><span>Impaginazione</span><select value={mode} onChange={(event) => changed(setMode, event.currentTarget.value as NUpMode)}>
        <option value="2-up">2 pagine su foglio (2×1)</option><option value="4-up">4 pagine su foglio (2×2)</option><option value="custom">Griglia personalizzata</option>
      </select></label>
      {mode === "custom" ? <>
        <label class="field"><span>Righe (1–4)</span><input type="number" min="1" max="4" value={rows} onInput={(event) => changed(setRows, event.currentTarget.value)} /></label>
        <label class="field"><span>Colonne (1–4; massimo 8 celle)</span><input type="number" min="1" max="4" value={columns} onInput={(event) => changed(setColumns, event.currentTarget.value)} /></label>
      </> : null}
      <label class="field"><span>Ordine di lettura</span><select value={order} onChange={(event) => changed(setOrder, event.currentTarget.value as NUpOrder)}>
        <option value="row-major">Righe, da sinistra a destra</option><option value="column-major">Colonne, dall'alto in basso</option>
      </select></label>
      <label class="field"><span>Carta</span><select value={paper} onChange={(event) => changed(setPaper, event.currentTarget.value as NUpPaper)}>
        <option value="a4">A4</option><option value="letter">Letter</option><option value="custom">Personalizzata</option>
      </select></label>
      <label class="field"><span>Orientamento foglio</span><select value={orientation} onChange={(event) => changed(setOrientation, event.currentTarget.value as NUpOrientation)}>
        <option value="portrait">Verticale</option><option value="landscape">Orizzontale</option>
      </select></label>
      {paper === "custom" ? <>
        <label class="field"><span>Larghezza carta (pt)</span><input type="number" min="240" max="1200" step="0.01" value={customWidth} onInput={(event) => changed(setCustomWidth, event.currentTarget.value)} /></label>
        <label class="field"><span>Altezza carta (pt)</span><input type="number" min="240" max="1200" step="0.01" value={customHeight} onInput={(event) => changed(setCustomHeight, event.currentTarget.value)} /></label>
      </> : null}
      <label class="field"><span>Margine esterno (pt)</span><input type="number" min="0" max="72" value={margin} onInput={(event) => changed(setMargin, event.currentTarget.value)} /></label>
      <label class="field"><span>Spazio tra le celle (pt)</span><input type="number" min="0" max="36" value={gap} onInput={(event) => changed(setGap, event.currentTarget.value)} /></label>
    </div>
    <p class="file-note" role="note" data-nup-fidelity><strong>Output rasterizzato, dichiaratamente con perdita:</strong> le pagine diventano immagini JPEG. Testo selezionabile, vettori, link e metadati originali non sono conservati. Pagine con annotazioni interattive vengono rifiutate. Dimensioni pagina e ordine visivo sono verificati.</p>
    {error || prepared.error ? <p role="alert">{error || prepared.error}</p> : null}
    {plan && sheet ? <section data-nup-preview aria-label="Anteprima del piano n-up" style={{ marginTop: "1rem", minWidth: 0 }}>
      <p role="status">{plan.pageCount} pagine → {plan.sheetCount} fogli, {plan.blankSlots} celle vuote nell'ultimo foglio; celle vuote bianche, nessuna pagina sorgente eliminata.</p>
      <div class="actions"><button type="button" disabled={shownSheet <= 1} onClick={() => setShownSheet((n) => n - 1)}>Foglio precedente</button>
        <span>Foglio {Math.min(shownSheet, plan.sheetCount)} di {plan.sheetCount}</span>
        <button type="button" disabled={shownSheet >= plan.sheetCount} onClick={() => setShownSheet((n) => n + 1)}>Foglio successivo</button></div>
      <svg data-nup-sheet viewBox={`0 0 ${plan.sheetWidth} ${plan.sheetHeight}`} role="img" aria-label="Posizioni esatte delle pagine sorgenti nel foglio" style={{ display: "block", background: "var(--surface)", color: "var(--text)", width: "min(100%, 400px)", border: "1px solid var(--border)", margin: "1rem auto" }}>
        {sheet.cells.map((cell) => <g key={cell.slot} data-nup-slot={cell.slot} data-source-page={cell.sourcePage ?? "blank"}>
          <rect x={cell.x} y={plan.sheetHeight - cell.y - cell.height} width={cell.width} height={cell.height} fill={cell.sourcePage === null ? "var(--surface-muted)" : "var(--brand-soft)"} stroke="var(--border-strong)" strokeWidth="1.5" />
          <text x={cell.x + cell.width / 2} y={plan.sheetHeight - cell.y - cell.height / 2} textAnchor="middle" fontSize={Math.min(20, cell.height / 5)} fill="var(--text)">{cell.sourcePage === null ? "VUOTA" : `PAG. ${cell.sourcePage}`}</text>
        </g>)}
      </svg>
      <p class="file-note" data-nup-mapping>{sheet.cells.map((cell) => `Slot ${cell.slot}: ${cell.sourcePage === null ? "vuoto (padding)" : `pagina ${cell.sourcePage}`}`).join(" · ")}</p>
    </section> : null}
    <div class="actions">
      <button class="primary" type="submit" disabled={!plan || busy}>{busy ? "Impaginazione locale…" : "Crea PDF n-up"}</button>
      {busy ? <button type="button" onClick={invalidate}>Annulla impaginazione</button> : null}
    </div>
    {downloadUrl ? <section class="result-panel" data-state="success" data-nup-result>
      <p role="status">PDF n-up generato: {plan?.sheetCount} fogli con MediaBox, immagini JPEG e firma ricontrollati.</p>
      {resultPreviewError ? <p role="alert">{resultPreviewError}</p> : null}
      {resultPreview ? <img data-nup-result-preview src={resultPreview} alt={`Foglio ${Math.min(shownSheet, plan?.sheetCount ?? 1)} del PDF prodotto, riaperto e renderizzato con PDF.js`} style={{ maxWidth: "min(100%, 320px)", display: "block" }} /> : null}
      <a href={downloadUrl} download="pdf-n-up-raster.pdf">Scarica PDF n-up</a>
    </section> : null}
  </form>;
}
