import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { inspectPdfBytes } from "../../../engines/pdf";
import { openPdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import { encodeSignatureCanvas241, planVisualSignature241, type VisualSignature241Plan } from "../../../engines/pdf/visual-signature-241";

type Ready241 = { readonly blob: Blob; readonly filename: string; readonly plan: VisualSignature241Plan; readonly previews: readonly { page: number; blob: Blob }[] };
type Loaded241 = { readonly bytes: Uint8Array; readonly pages: number };
type OriginalPreview241 = { readonly blob: Blob; readonly file: File; readonly document: Loaded241; readonly page: string };
type Mode241 = "image" | "text" | "draw";

const message241 = (reason: unknown) => reason instanceof Error ? reason.message : "Operazione PDF non riuscita";
const number241 = (raw: string) => raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : NaN;

/** A visible graphic on simple, unsigned PDFs. It is NEVER a digital signature. */
export function PdfVisualSignature241Tool() {
  const [source, setSource] = useState<File | null>(null);
  const [pngFile, setPngFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode241>("image");
  const [signatureText, setSignatureText] = useState("");
  const [drawVersion, setDrawVersion] = useState(0);
  const [document, setDocument] = useState<Loaded241 | null>(null);
  const [png, setPng] = useState<Uint8Array | null>(null);
  const [page, setPage] = useState("1");
  const [previewChoice, setPreviewChoice] = useState("");
  const [x, setX] = useState("48");
  const [y, setY] = useState("48");
  const [width, setWidth] = useState("160");
  const [height, setHeight] = useState("60");
  const [originalPreview, setOriginalPreview] = useState<OriginalPreview241 | null>(null);
  const [previewProblem, setPreviewProblem] = useState("");
  const [fileProblem, setFileProblem] = useState("");
  const [result, setResult] = useState<Ready241 | null>(null);
  const [processProblem, setProcessProblem] = useState("");
  const [working, setWorking] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const drawCanvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<number | null>(null);

  function invalidate() {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    setWorking(false);
    setResult(null);
    setProcessProblem("");
  }

  function clear() {
    invalidate();
    setSource(null); setPngFile(null); setDocument(null); setPng(null);
    setMode("image"); setSignatureText(""); setDrawVersion(0); setPreviewChoice("");
    setPage("1"); setX("48"); setY("48"); setWidth("160"); setHeight("60");
    setOriginalPreview(null); setPreviewProblem(""); setFileProblem("");
    setResetKey((value) => value + 1);
  }

  useEffect(() => {
    if (source === null) { setDocument(null); return; }
    let active = true;
    void (async () => {
      if (source.size > 25 * 1024 * 1024 || source.size < 8) throw new Error("PDF oltre 25 MiB o non valido");
      const bytes = new Uint8Array(await source.arrayBuffer());
      const inspected = inspectPdfBytes(bytes);
      if (inspected.pageCount < 1 || inspected.pageCount > 40) throw new Error("PDF: servono da 1 a 40 pagine semplici");
      if (active) { setDocument({ bytes, pages: inspected.pageCount }); setFileProblem(""); }
    })().catch((reason) => { if (active) { setDocument(null); setFileProblem(message241(reason)); } });
    return () => { active = false; };
  }, [source]);

  useEffect(() => {
    if (mode !== "image" || pngFile === null) { if (mode === "image") setPng(null); return; }
    let active = true;
    void (async () => {
      if (pngFile.size > 2 * 1024 * 1024 || pngFile.size < 57) throw new Error("PNG: massimo 2 MiB, RGB/RGBA 8 bit");
      const bytes = new Uint8Array(await pngFile.arrayBuffer());
      if (active) { setPng(bytes); setFileProblem(""); }
    })().catch((reason) => { if (active) { setPng(null); setFileProblem(message241(reason)); } });
    return () => { active = false; };
  }, [pngFile, mode]);

  useEffect(() => {
    if (mode === "image") return;
    try {
      let canvas: HTMLCanvasElement | null = null;
      if (mode === "text" && signatureText.trim()) {
        canvas = window.document.createElement("canvas");
        canvas.width = 512; canvas.height = 160;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas non disponibile");
        context.font = "italic 52px Georgia, serif";
        context.fillStyle = "#171717";
        context.textBaseline = "middle";
        const name = signatureText.trim();
        if (context.measureText(name).width > 480) throw new Error("Testo troppo lungo: riduci il nome per mantenere leggibile la firma");
        context.fillText(name, 16, 80);
      } else if (mode === "draw" && drawVersion > 0) canvas = drawCanvas.current;
      if (!canvas) { setPng(null); return; }
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas non disponibile");
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      if (!pixels.some((v, i) => i % 4 === 3 && v > 0)) { setPng(null); return; }
      setPng(encodeSignatureCanvas241(pixels, canvas.width, canvas.height));
      setFileProblem("");
    } catch (reason) { setPng(null); setFileProblem(message241(reason)); }
  }, [mode, signatureText, drawVersion]);

  function startDraw(event: PointerEvent) {
    const canvas = drawCanvas.current;
    if (!canvas || event.button !== 0) return;
    invalidate();
    drawing.current = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const box = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) return;
    context.beginPath();
    context.moveTo((event.clientX - box.left) * canvas.width / box.width, (event.clientY - box.top) * canvas.height / box.height);
    context.lineCap = "round"; context.lineJoin = "round"; context.lineWidth = 4; context.strokeStyle = "#171717";
    context.lineTo((event.clientX - box.left) * canvas.width / box.width + .01, (event.clientY - box.top) * canvas.height / box.height);
    context.stroke();
  }
  function moveDraw(event: PointerEvent) {
    if (drawing.current !== event.pointerId || !drawCanvas.current) return;
    const canvas = drawCanvas.current;
    const box = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineTo((event.clientX - box.left) * canvas.width / box.width, (event.clientY - box.top) * canvas.height / box.height);
    context.stroke();
  }
  function endDraw(event: PointerEvent) {
    if (drawing.current !== event.pointerId) return;
    drawing.current = null;
    setDrawVersion((value) => value + 1);
  }

  const options = useMemo(() => {
    const x0 = number241(x), y0 = number241(y), w = number241(width), h = number241(height);
    return { pages: page, rect: [x0, y0, x0 + w, y0 + h] as const };
  }, [page, x, y, width, height]);
  const validation = useMemo((): { plan: VisualSignature241Plan | null; error: string } => {
    if (!document || !png) return { plan: null, error: "" };
    try { return { plan: planVisualSignature241(document.bytes, { ...options, png }), error: "" }; }
    catch (reason) { return { plan: null, error: message241(reason) }; }
  }, [document, png, options]);
  const previewPage = validation.plan?.pages.includes(Number(previewChoice)) ? previewChoice : String(validation.plan?.pages[0] ?? "");
  const selected = validation.plan?.placements.find((placement) => String(placement.page) === previewPage);

  useEffect(() => {
    setOriginalPreview(null);
    setPreviewProblem("");
    if (source === null || document === null || !previewPage) return;
    let active = true;
    const signal = new AbortController();
    let session: Awaited<ReturnType<typeof openPdfThumbnailSession>> | null = null;
    void (async () => {
      session = await openPdfThumbnailSession(source, signal.signal);
      const image = await session.renderPage(Number(previewPage), 0, signal.signal);
      if (active) setOriginalPreview({ blob: image, file: source, document, page: previewPage });
    })().catch((reason) => { if (active) setPreviewProblem(`Anteprima originale: ${message241(reason)}`); })
      .finally(() => { void session?.close(); });
    return () => { active = false; signal.abort(); void session?.close(); };
  }, [source, document, previewPage]);

  const [originalUrl, setOriginalUrl] = useState<{ preview: OriginalPreview241; url: string } | null>(null);
  const [loadedOriginalUrl, setLoadedOriginalUrl] = useState("");
  const [finalUrls, setFinalUrls] = useState<readonly { page: number; url: string }[]>([]);
  const [loadedFinalUrls, setLoadedFinalUrls] = useState<readonly string[]>([]);
  const [downloadUrl, setDownloadUrl] = useState("");
  useEffect(() => {
    if (!originalPreview) { setOriginalUrl(null); return; }
    const url = URL.createObjectURL(originalPreview.blob);
    setOriginalUrl({ preview: originalPreview, url });
    return () => { URL.revokeObjectURL(url); };
  }, [originalPreview]);
  useEffect(() => {
    setLoadedFinalUrls([]);
    if (!result) { setFinalUrls([]); setDownloadUrl(""); return; }
    const pdfUrl = URL.createObjectURL(result.blob);
    const previews = result.previews.map(({ page, blob }) => ({ page, url: URL.createObjectURL(blob) }));
    setDownloadUrl(pdfUrl); setFinalUrls(previews);
    return () => { URL.revokeObjectURL(pdfUrl); for (const { url } of previews) URL.revokeObjectURL(url); };
  }, [result]);
  useEffect(() => () => { generation.current += 1; controller.current?.abort(); }, []);

  // Effect cleanup alone is too late: a new file/page can render with the old
  // thumbnail URL for a frame. Never make that stale image an approval surface.
  const currentPreview = originalPreview !== null && originalPreview.file === source
    && originalPreview.document === document && originalPreview.page === previewPage;
  const currentOriginalUrl = currentPreview && originalUrl?.preview === originalPreview ? originalUrl.url : "";
  const previewReady = currentOriginalUrl !== "" && loadedOriginalUrl === currentOriginalUrl;

  async function generate(event: Event) {
    event.preventDefault();
    invalidate();
    if (!document || !png || !validation.plan || !previewReady) return;
    const current = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setWorking(true);
    try {
      // Allow the cancel button and status to paint before the cancellable Worker.
      await new Promise<void>((done) => requestAnimationFrame(() => done()));
      if (abort.signal.aborted) return;
      const { writeVisibleSignatureInWorker241 } = await import("../../../engines/pdf/visual-signature-worker-client-241");
      if (abort.signal.aborted) return;
      const written = await writeVisibleSignatureInWorker241(document.bytes, { ...options, png }, abort.signal);
      if (abort.signal.aborted || current !== generation.current) return;
      const outputBlob = new Blob([written.bytes.slice().buffer], { type: "application/pdf" });
      const outputFilename = "firma-grafica-visiva-NON-digitale.pdf";
      const reopened = inspectPdfBytes(written.bytes);
      if (reopened.pageCount !== written.plan.pageCount || reopened.encrypted || reopened.forms.length > 0) {
        throw new Error("PDF241_OUTPUT_VERIFY: verifiche del documento esportato fallite");
      }
      // Download is withheld until independent PDF.js reopen and render of EVERY selected page.
      const verifiedFile = new File([outputBlob], outputFilename, { type: "application/pdf" });
      const session = await openPdfThumbnailSession(verifiedFile, abort.signal);
      const previews: { page: number; blob: Blob }[] = [];
      try {
        if (session.pageCount !== written.plan.pageCount) throw new Error("PDF241_OUTPUT_VERIFY: pagine diverse in PDF.js");
        for (const signedPage of written.plan.pages) {
          const blob = await session.renderPage(signedPage, 0, abort.signal);
          if (abort.signal.aborted) throw new DOMException("Firma grafica annullata", "AbortError");
          previews.push({ page: signedPage, blob });
        }
      } finally { await session.close(); }
      if (abort.signal.aborted || current !== generation.current) return;
      setResult({ blob: outputBlob, filename: outputFilename, plan: written.plan, previews });
    } catch (reason) {
      if (current === generation.current && !abort.signal.aborted) setProcessProblem(message241(reason));
    } finally {
      if (current === generation.current) { setWorking(false); controller.current = null; }
    }
  }

  const position = selected?.displaySize;
  return <form data-pdf-visual-signature-241 class="tool-operation" onSubmit={(event) => void generate(event)}
    style={{ maxWidth: "960px", margin: "1rem auto", minWidth: 0 }}>
    <p data-241-disclosure class="file-note"><strong>Solo firma grafica VISIVA (immagine, disegno o testo rasterizzato).</strong> Non è una firma digitale/elettronica con certificato: nessuna autenticità, validità crittografica o legale è verificata. Il PDF viene riscritto. PDF già firmati, certificati, con moduli, annotazioni o contenuti attivi vengono rifiutati.</p>
    <div class="field-grid" key={resetKey}>
      <label class="field"><span>Documento PDF semplice e privo di firme (max 25 MiB, 40 pagine)</span>
        <input data-241-source aria-label="Documento PDF originale" type="file" accept=".pdf,application/pdf"
          onChange={(event) => { invalidate(); setDocument(null); setFileProblem(""); setSource(event.currentTarget.files?.[0] ?? null); }} /></label>
      <label class="field"><span>Tipo di firma visiva</span>
        <select aria-label="Modalità della firma visiva" value={mode} onChange={(event) => { invalidate(); setPng(null); setMode(event.currentTarget.value as Mode241); }}>
          <option value="image">Carica immagine PNG</option>
          <option value="text">Scrivi testo visibile</option>
          <option value="draw">Disegna a mano libera</option>
        </select></label>
    </div>
    {mode === "image" && <label class="field"><span>Immagine della firma grafica (PNG RGB/RGBA, max 2 MiB)</span>
      <input data-241-png key={resetKey} aria-label="Immagine PNG firma visiva" type="file" accept=".png,image/png"
        onChange={(event) => { invalidate(); setPng(null); setFileProblem(""); setPngFile(event.currentTarget.files?.[0] ?? null); }} /></label>}
    {mode === "text" && <label class="field"><span>Testo della firma (stampato come immagine, senza certificazione)</span>
      <input data-241-text aria-label="Testo della firma visiva" type="text" maxLength={60} value={signatureText}
        placeholder="Nome e cognome" onInput={(event) => { invalidate(); setSignatureText(event.currentTarget.value); }} /></label>}
    {mode === "draw" && <div class="field">
      <p>Disegna una firma con mouse, penna o dito. Il tratto viene salvato come immagine locale.</p>
      <canvas data-241-draw aria-label="Disegna firma visiva" role="img" ref={drawCanvas} width={512} height={160}
        onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerCancel={endDraw}
        style={{ display: "block", background: "#fff", border: "1px solid #666", borderRadius: "6px", width: "100%", maxWidth: "512px", height: "auto", touchAction: "none" }} />
      <button type="button" data-241-clear-draw onClick={() => {
        invalidate(); drawCanvas.current?.getContext("2d")?.clearRect(0, 0, 512, 160);
        setPng(null); setDrawVersion(0);
      }}>Cancella disegno</button>
    </div>}
    {fileProblem && <p role="alert">{fileProblem}</p>}
    {document !== null && <>
      <div class="field-grid">
        <label class="field"><span>Pagine sulle quali applicare la stessa firma (max 8, es. 1,3-4)</span>
          <input data-241-pages aria-label="Pagine della firma" value={page}
            onInput={(event) => { invalidate(); setPage(event.currentTarget.value); setPreviewChoice(""); }} /></label>
        {validation.plan && <label class="field"><span>Pagina da controllare nell’anteprima originale</span>
          <select aria-label="Pagina di anteprima" value={previewPage}
            onChange={(event) => { invalidate(); setPreviewChoice(event.currentTarget.value); }}>
            {validation.plan.pages.map((pageNumber) => <option key={pageNumber} value={String(pageNumber)}>Pagina {pageNumber}</option>)}
          </select></label>}
      </div>
      <fieldset style={{ border: "1px solid var(--border, #aaa)", borderRadius: "8px", padding: "1rem", minWidth: 0 }}>
        <legend>Area grafica sulla pagina, in punti PDF (origine in basso a sinistra)</legend>
        <div class="field-grid">
          {([
            ["X da sinistra (pt)", x, setX], ["Y dal basso (pt)", y, setY],
            ["Larghezza (pt)", width, setWidth], ["Altezza (pt)", height, setHeight],
          ] as const).map(([label, value, change]) => <label class="field" key={label}><span>{label}</span>
            <input type="number" aria-label={label} value={value} min="0" step="0.5" inputMode="decimal"
              onInput={(event) => { invalidate(); change(event.currentTarget.value); }} /></label>)}
        </div>
        <p class="file-note">Misure riferite alla pagina visibile (CropBox e rotazione inclusi); l’area deve restare interamente dentro i bordi.</p>
      </fieldset>
    </>}
    {validation.error && <p role="alert" data-241-validation>{validation.error}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "1.25rem", margin: "1rem 0", minWidth: 0 }}>
      {currentOriginalUrl && <figure style={{ margin: 0, minWidth: 0 }}>
        <figcaption><strong>Originale</strong> — pagina {previewPage}, anteprima locale PDF.js</figcaption>
        <div style={{ position: "relative", width: "fit-content", maxWidth: "100%" }}>
          <img data-241-original src={currentOriginalUrl} alt={`PDF originale, pagina ${previewPage}`}
            onLoad={() => setLoadedOriginalUrl(currentOriginalUrl)}
            onError={() => { setLoadedOriginalUrl(""); setPreviewProblem("Anteprima originale: immagine non caricabile"); }}
            style={{ display: "block", width: "auto", maxWidth: "100%", border: "1px solid #889" }} />
          {selected && position && <div data-241-area aria-hidden="true" style={{ position: "absolute", pointerEvents: "none",
            boxSizing: "border-box", border: "2px solid #d65a24", background: "rgba(255,142,36,.2)",
            left: `${options.rect[0] / position[0] * 100}%`,
            top: `${(position[1] - options.rect[3]) / position[1] * 100}%`,
            width: `${(options.rect[2] - options.rect[0]) / position[0] * 100}%`,
            height: `${(options.rect[3] - options.rect[1]) / position[1] * 100}%` }} />}
        </div>
      </figure>}
      {result && finalUrls.map(({ page: outputPage, url }) => <figure key={outputPage} style={{ margin: 0, minWidth: 0 }}>
        <figcaption><strong>Finale</strong> — pagina {outputPage}, PDF.js riapre l’output</figcaption>
        <img data-241-final data-page={outputPage} src={url} alt={`PDF finale pagina ${outputPage}, riaperto e renderizzato indipendentemente da PDF.js`}
          onLoad={() => setLoadedFinalUrls((old) => old.includes(url) ? old : [...old, url])}
          onError={() => { invalidate(); setProcessProblem(`Anteprima finale pagina ${outputPage} non caricabile`); }}
          style={{ display: "block", width: "auto", maxWidth: "100%", border: "1px solid #889" }} />
      </figure>)}
    </div>
    {previewProblem && <p role="alert">{previewProblem}</p>}
    {processProblem && <p role="alert">{processProblem}</p>}
    {document && !previewReady && !previewProblem && <p role="status">Caricamento anteprima originale della pagina selezionata…</p>}
    <div class="actions" style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
      <button type="submit" class="primary" disabled={!validation.plan || !previewReady || working || Boolean(previewProblem)}>
        {working ? "Verifica PDF in corso…" : "Applica firma visiva e verifica output"}
      </button>
      {working && <button type="button" data-241-cancel onClick={() => { invalidate(); setProcessProblem("Operazione annullata: nessun PDF pubblicato."); }}>Annulla</button>}
      <button type="button" data-241-reset onClick={clear}>Azzera tutto</button>
    </div>
    {working && <p role="status">Elaborazione locale e riapertura del PDF tramite PDF.js…</p>}
    {result && downloadUrl && finalUrls.length === result.plan.pages.length
      && finalUrls.every(({ url }) => loadedFinalUrls.includes(url)) && <section data-241-result class="result-panel" data-state="success">
      <p role="status">Firma visiva applicata alla pagina {result.plan.pages.join(", ")} e output PDF verificato, inclusa anteprima finale.</p>
      <p>Questa immagine non firma digitalmente il documento. Il PDF risultante non contiene certificati di firma creati da questo strumento.</p>
      <a data-241-download href={downloadUrl} download={result.filename}>Scarica PDF con firma grafica visiva (NON digitale)</a>
    </section>}
  </form>;
}
