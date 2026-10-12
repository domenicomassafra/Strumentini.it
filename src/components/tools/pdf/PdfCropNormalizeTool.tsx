import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { cropNormalizePdf, planPdfCropNormalize, type PdfCropNormalizeMode, type PdfPageFit, type PdfPageSizePreset } from "../../../engines/pdf/crop-normalize";
import { openPdfThumbnailSession, pdfThumbnailWindow, type PdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import { pdfCropNormalizeManifest } from "../../../tools/pdf-crop-normalize/manifest";

type Thumbnail = { page: number; url: string };

export function PdfCropNormalizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [mode, setMode] = useState<PdfCropNormalizeMode>("crop");
  const [pages, setPages] = useState("*");
  const [left, setLeft] = useState("24");
  const [top, setTop] = useState("24");
  const [right, setRight] = useState("24");
  const [bottom, setBottom] = useState("24");
  const [preset, setPreset] = useState<PdfPageSizePreset>("a4-portrait");
  const [width, setWidth] = useState("595.28");
  const [height, setHeight] = useState("841.89");
  const [fit, setFit] = useState<PdfPageFit>("contain");
  const [margin, setMargin] = useState("12");
  const [start, setStart] = useState(1);
  const [session, setSession] = useState<PdfThumbnailSession | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [runError, setRunError] = useState("");
  const [busy, setBusy] = useState(false);
  const [artifact, setArtifact] = useState<Blob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  // Acquire this lock before the requestAnimationFrame yield, and revoke the
  // authority of any obsolete completion on file/options changes or cancel.
  const generation = useRef(0);
  const inFlight = useRef(false);
  const currentController = useRef<AbortController | null>(null);

  function invalidate() {
    generation.current++;
    inFlight.current = false;
    currentController.current?.abort();
    currentController.current = null;
    setBusy(false);
    setArtifact(null);
    setRunError("");
  }

  useEffect(() => () => {
    generation.current++;
    inFlight.current = false;
    currentController.current?.abort();
    currentController.current = null;
  }, []);

  const options = { mode, pages, insetLeft: Number(left), insetTop: Number(top), insetRight: Number(right),
    insetBottom: Number(bottom), preset, customWidth: Number(width), customHeight: Number(height), fit, margin: Number(margin) };
  const prepared = useMemo(() => {
    if (bytes === null) return { plan: null, error: "" };
    try { return { plan: planPdfCropNormalize(bytes, options), error: "" }; }
    catch (error) { return { plan: null, error: error instanceof Error ? error.message : "Geometria PDF non valida" }; }
  }, [bytes, mode, pages, left, top, right, bottom, preset, width, height, fit, margin]);
  const plan = prepared.plan;

  useEffect(() => {
    if (file === null) { setBytes(null); return; }
    let active = true;
    void file.arrayBuffer().then((buffer) => { if (active) { setBytes(new Uint8Array(buffer)); setLoadError(""); } },
      (error) => { if (active) setLoadError(error instanceof Error ? error.message : "Lettura PDF fallita"); });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    if (file === null || bytes === null) { setSession(null); return; }
    let active = true, current: PdfThumbnailSession | null = null;
    const controller = new AbortController();
    void openPdfThumbnailSession(file, controller.signal).then((ready) => {
      current = ready;
      if (!active) { void ready.close(); return; }
      setSession(ready); setPreviewError("");
    }, (error) => { if (active) setPreviewError(error instanceof Error ? error.message : "Anteprima PDF.js non disponibile"); });
    return () => { active = false; controller.abort(); if (current) void current.close(); };
  }, [file, bytes]);

  useEffect(() => {
    if (session === null || plan === null) { setThumbnails([]); return; }
    let active = true;
    const urls: string[] = [];
    const controller = new AbortController();
    setThumbnails([]);
    void (async () => {
      for (const page of pdfThumbnailWindow(plan.pageCount, start)) {
        if (!active) break;
        try {
          const blob = await session.renderPage(page, 0, controller.signal);
          if (!active) break;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setThumbnails((previous) => [...previous, { page, url }]);
        } catch (error) { if (active) setPreviewError(error instanceof Error ? error.message : "Miniatura non disponibile"); }
      }
    })();
    return () => { active = false; controller.abort(); urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [session, start, plan?.pageCount]);

  useEffect(() => {
    if (artifact === null) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(artifact);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [artifact]);

  function change<T>(setter: (value: T) => void, value: T) { invalidate(); setter(value); }
  function upload(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    invalidate(); setBytes(null); setFile(value); setLoadError(""); setPreviewError(""); setStart(1);
  }
  async function submit(event: Event) {
    event.preventDefault();
    if (inFlight.current) return;
    if (bytes === null || plan === null) { invalidate(); return; }
    const operation = ++generation.current;
    inFlight.current = true;
    const controller = new AbortController();
    currentController.current = controller;
    setArtifact(null); setRunError("");
    setBusy(true);
    try {
      await new Promise<void>((done) => requestAnimationFrame(() => done()));
      if (operation !== generation.current || controller.signal.aborted) return;
      const result = cropNormalizePdf(bytes, options, controller.signal);
      if (operation !== generation.current || controller.signal.aborted) return;
      if (!(result.artifact.blob instanceof Blob) || result.artifact.blob.size < 100) {
        throw new Error("PDF modificato non disponibile");
      }
      setArtifact(result.artifact.blob);
      // Only canonical tool identity is persisted; no filenames, options,
      // original PDF content or transformed bytes are passed to Recenti.
      recordCompletedTool(pdfCropNormalizeManifest.id);
    } catch (error) {
      if (operation === generation.current && !controller.signal.aborted) {
        setRunError(error instanceof Error ? error.message : "Elaborazione PDF fallita");
      }
    } finally {
      if (operation === generation.current) {
        inFlight.current = false;
        currentController.current = null;
        setBusy(false);
      }
    }
  }

  return <form class="tool-operation" data-pdf-crop-normalize onSubmit={(event) => { void submit(event); }}>
    <label class="field"><span>PDF locale</span><input type="file" accept="application/pdf,.pdf" onChange={upload} /></label>
    <label class="field"><span>Operazione</span><select value={mode} onChange={(event) => change(setMode, event.currentTarget.value as PdfCropNormalizeMode)}>
      <option value="crop">Ritaglia visivamente (CropBox)</option><option value="normalize">Normalizza dimensioni pagina</option>
    </select></label>
    <p class="file-note" role="note" data-pdf-box-semantics>
      {mode === "crop" ? <strong>Il crop NASCONDE, NON distrugge e NON oscura dati riservati.</strong>
        : <strong>Normalizzazione: il contenuto originale viene riposizionato o scalato uniformemente e centrato.</strong>}
      {" "}Gli stream originali del PDF rimangono recuperabili. Non è una funzione di redazione della privacy.
    </p>
    <label class="field"><span>Pagine</span><input value={pages} onInput={(event) => change(setPages, event.currentTarget.value)} />
      <small>* tutte; 2-4,6 selezionate. Intervalli invertiti, duplicati e fuori file sono rifiutati.</small></label>
    {mode === "crop" ? <>
      <p class="file-note">Margini da NASCONDERE misurati in punti PDF (pt) dall’attuale CropBox visualizzato, non dalla MediaBox. Sinistra/alto/destra/basso seguono l’orientamento visibile anche su pagine ruotate.</p>
      <div class="field-grid">
        <label class="field"><span>Nascondi sinistra (pt)</span><input type="number" min="0" max="2000" step="1" value={left} onInput={(event) => change(setLeft, event.currentTarget.value)} /></label>
        <label class="field"><span>Nascondi alto (pt)</span><input type="number" min="0" max="2000" step="1" value={top} onInput={(event) => change(setTop, event.currentTarget.value)} /></label>
        <label class="field"><span>Nascondi destra (pt)</span><input type="number" min="0" max="2000" step="1" value={right} onInput={(event) => change(setRight, event.currentTarget.value)} /></label>
        <label class="field"><span>Nascondi basso (pt)</span><input type="number" min="0" max="2000" step="1" value={bottom} onInput={(event) => change(setBottom, event.currentTarget.value)} /></label>
      </div>
    </> : <>
      <p class="file-note"><strong>Contieni</strong> scala uniformemente per mostrare tutto, con margini bianchi e centratura deterministica. <strong>Centra senza scala</strong> conserva le dimensioni e rifiuta qualsiasi pagina che non entri interamente nel formato richiesto. Il PDF normalizzato ha MediaBox e CropBox uguali al formato scelto e Rotate = 0.</p>
      <div class="field-grid">
        <label class="field"><span>Formato destinazione</span><select value={preset} onChange={(event) => change(setPreset, event.currentTarget.value as PdfPageSizePreset)}>
          <option value="a4-portrait">A4 verticale</option><option value="a4-landscape">A4 orizzontale</option>
          <option value="letter-portrait">Letter verticale</option><option value="letter-landscape">Letter orizzontale</option>
          <option value="custom">Personalizzato</option>
        </select></label>
        <label class="field"><span>Adattamento</span><select value={fit} onChange={(event) => change(setFit, event.currentTarget.value as PdfPageFit)}>
          <option value="contain">Contieni, scala e centra</option><option value="center">Centra, senza scala (solo se entra)</option>
        </select></label>
        {preset === "custom" ? <>
          <label class="field"><span>Larghezza destinazione (pt)</span><input type="number" min="100" max="2000" value={width} onInput={(event) => change(setWidth, event.currentTarget.value)} /></label>
          <label class="field"><span>Altezza destinazione (pt)</span><input type="number" min="100" max="2000" value={height} onInput={(event) => change(setHeight, event.currentTarget.value)} /></label>
        </> : null}
        <label class="field"><span>Margine minimo destinazione (pt)</span><input type="number" min="0" max="72" step="1" value={margin} onInput={(event) => change(setMargin, event.currentTarget.value)} /></label>
      </div>
    </>}
    {loadError || prepared.error ? <p role="alert">{loadError || prepared.error}</p> : null}
    {plan ? <section data-crop-preview aria-label="Anteprima PDF.js e risultato su geometria reale">
      <p role="status">{plan.selectedPages.length} pagine su {plan.pageCount} saranno modificate. {mode === "crop" ? "MediaBox invariata; nuova CropBox visiva." : "Nuova MediaBox/CropBox e contenuti uniformemente centrati."}</p>
      <div class="actions"><button type="button" disabled={start === 1} onClick={() => setStart((v) => Math.max(1, v - 4))}>Anteprime precedenti</button>
        <label>Da pagina <input type="number" min="1" max={plan.pageCount} value={start} onInput={(event) => {
          const v = Number(event.currentTarget.value); if (Number.isInteger(v) && v >= 1 && v <= plan.pageCount) setStart(v);
        }} /></label>
        <button type="button" disabled={start + 4 > plan.pageCount} onClick={() => setStart((v) => Math.min(plan.pageCount, v + 4))}>Anteprime successive</button></div>
      {previewError ? <p role="alert">Anteprima: {previewError}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: "0.75rem" }}>
        {pdfThumbnailWindow(plan.pageCount, start).map((page) => {
          const p = plan.pages[page - 1]!;
          const selected = plan.selectedPages.includes(page);
          const thumb = thumbnails.find((item) => item.page === page);
          const cropX = p.displayedOffsetX, cropY = p.sourceVisibleHeight - p.displayedOffsetY - p.displayedHeight;
          const normalize = mode === "normalize" && selected;
          return <div key={page} data-crop-page={page}>
            <div style={{ maxWidth: "176px", margin: "0 auto", position: "relative", aspectRatio: normalize ? `${p.displayedWidth}/${p.displayedHeight}` : `${p.sourceVisibleWidth}/${p.sourceVisibleHeight}` }}>
              {normalize ? <svg data-normalize-overlay-page={page} viewBox={`0 0 ${p.displayedWidth} ${p.displayedHeight}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", background: "white" }}>
                {thumb ? <image href={thumb.url} x={p.displayedOffsetX} y={p.displayedHeight - p.displayedOffsetY - p.sourceVisibleHeight * p.scale}
                  width={p.sourceVisibleWidth * p.scale} height={p.sourceVisibleHeight * p.scale} /> : null}
              </svg> : <>
                {thumb ? <img src={thumb.url} alt={`Contenuto originale pagina ${page}`} style={{ width: "100%", height: "100%", display: "block", objectFit: "fill" }} /> : <span>Miniatura pagina {page}…</span>}
                {selected && mode === "crop" && thumb ? <svg data-crop-overlay-page={page} viewBox={`0 0 ${p.sourceVisibleWidth} ${p.sourceVisibleHeight}`} preserveAspectRatio="none"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  <path fill="rgba(190, 36, 36, 0.28)" fillRule="evenodd" d={`M0 0H${p.sourceVisibleWidth}V${p.sourceVisibleHeight}H0Z M${cropX} ${cropY}H${cropX + p.displayedWidth}V${cropY + p.displayedHeight}H${cropX}Z`} />
                  <rect x={cropX} y={cropY} width={p.displayedWidth} height={p.displayedHeight} fill="none" stroke="#bd2626" strokeWidth="2" />
                </svg> : null}
              </>}
            </div>
            <p class="file-note">Pag. {page} · {selected ? `${p.sourceVisibleWidth.toFixed(0)}×${p.sourceVisibleHeight.toFixed(0)} → ${p.displayedWidth.toFixed(0)}×${p.displayedHeight.toFixed(0)} pt` : "Invariata"}{normalize ? ` · scala ${p.scale.toFixed(3)}×` : ""}</p>
          </div>;
        })}
      </div>
      <p class="file-note">Anteprima derivata da PDF.js e dallo stesso piano geometrico dell’output, fino a 4 pagine visibili per volta.</p>
    </section> : null}
    <div class="actions"><button class="primary" type="submit" disabled={!plan || busy}>{busy ? "Elaborazione…" : mode === "crop" ? "Applica crop visivo" : "Normalizza pagine"}</button>
      {busy ? <button type="button" onClick={invalidate}>Annulla modifica PDF</button> : null}</div>
    {runError ? <p role="alert">{runError}</p> : null}
    {downloadUrl ? <div class="result-panel" data-state="success"><p role="status">PDF generato e geometria/stream originali ricontrollati.</p>
      <p>{mode === "crop" ? "Il contenuto nascosto resta recuperabile; il crop NON è redazione." : "Contenuti originali conservati senza rasterizzazione."}</p>
      <a href={downloadUrl} download={mode === "crop" ? "pdf-ritagliato-visivamente.pdf" : "pdf-dimensioni-normalizzate.pdf"}>Scarica PDF modificato</a>
    </div> : null}
  </form>;
}
