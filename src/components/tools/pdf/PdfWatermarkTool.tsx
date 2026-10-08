import { useEffect, useMemo, useState } from "preact/hooks";
import { planPdfWatermark, watermarkPdf, type PdfWatermarkPosition } from "../../../engines/pdf/watermark";
import { openPdfThumbnailSession, pdfThumbnailWindow, type PdfThumbnailSession } from "../../../engines/pdf/thumbnails";

const POSITIONS: readonly { value: PdfWatermarkPosition; label: string }[] = [
  { value: "top-left", label: "Alto sinistra" }, { value: "top-center", label: "Alto centro" },
  { value: "top-right", label: "Alto destra" }, { value: "center-left", label: "Centro sinistra" },
  { value: "center", label: "Centro" }, { value: "center-right", label: "Centro destra" },
  { value: "bottom-left", label: "Basso sinistra" }, { value: "bottom-center", label: "Basso centro" },
  { value: "bottom-right", label: "Basso destra" },
];
type Thumbnail = { page: number; url: string };

export function PdfWatermarkTool() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState("*");
  const [text, setText] = useState("COPIA");
  const [opacity, setOpacity] = useState("0.3");
  const [rotation, setRotation] = useState("-35");
  const [scale, setScale] = useState("1");
  const [margin, setMargin] = useState("24");
  const [position, setPosition] = useState<PdfWatermarkPosition>("center");
  const [start, setStart] = useState(1);
  const [session, setSession] = useState<PdfThumbnailSession | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [writeError, setWriteError] = useState("");
  const [writing, setWriting] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");

  const options = { pages, text, opacity: Number(opacity), rotation: Number(rotation), scale: Number(scale),
    margin: Number(margin), position };
  const calculated = useMemo(() => {
    if (source === null) return { plan: null, error: "" };
    try { return { plan: planPdfWatermark(source, options), error: "" }; }
    catch (error) { return { plan: null, error: error instanceof Error ? error.message : "Anteprima non valida" }; }
  }, [source, pages, text, opacity, rotation, scale, margin, position]);
  const plan = calculated.plan;

  useEffect(() => {
    if (file === null) { setSource(null); return; }
    let alive = true;
    void file.arrayBuffer().then((buffer) => {
      if (alive) { setSource(new Uint8Array(buffer)); setLoadError(""); }
    }, (error) => { if (alive) setLoadError(error instanceof Error ? error.message : "Impossibile leggere PDF"); });
    return () => { alive = false; };
  }, [file]);

  useEffect(() => {
    if (file === null || source === null) { setSession(null); return; }
    let alive = true;
    let current: PdfThumbnailSession | null = null;
    const controller = new AbortController();
    void openPdfThumbnailSession(file, controller.signal).then((ready) => {
      current = ready;
      if (!alive) { void ready.close(); return; }
      setSession(ready); setPreviewError("");
    }, (error) => { if (alive) setPreviewError(error instanceof Error ? error.message : "Anteprima PDF.js non disponibile"); });
    return () => { alive = false; controller.abort(); if (current !== null) void current.close(); };
  }, [file, source]);

  useEffect(() => {
    if (session === null || plan === null) { setThumbnails([]); return; }
    let alive = true;
    const controller = new AbortController();
    const urls: string[] = [];
    setThumbnails([]);
    void (async () => {
      for (const page of pdfThumbnailWindow(plan.pageCount, start)) {
        if (!alive) break;
        try {
          const image = await session.renderPage(page, 0, controller.signal);
          if (!alive) break;
          const url = URL.createObjectURL(image);
          urls.push(url);
          setThumbnails((old) => [...old, { page, url }]);
        } catch (error) {
          if (alive) setPreviewError(error instanceof Error ? error.message : "Miniatura non disponibile");
        }
      }
    })();
    return () => { alive = false; controller.abort(); urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [session, start, plan?.pageCount]);

  useEffect(() => {
    if (result === null) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(result);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  function update<T>(setter: (value: T) => void, value: T) {
    setter(value); setResult(null); setWriteError("");
  }

  function choose(event: Event) {
    setSource(null);
    setFile((event.currentTarget as HTMLInputElement).files?.[0] ?? null);
    setResult(null); setLoadError(""); setPreviewError(""); setWriteError(""); setStart(1);
  }

  async function submit(event: Event) {
    event.preventDefault();
    setResult(null); setWriteError("");
    if (source === null || plan === null) return;
    setWriting(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setResult(watermarkPdf(source, options).artifact.blob);
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : "Filigrana non creata");
    } finally { setWriting(false); }
  }

  return (
    <form class="tool-operation" data-pdf-watermark onSubmit={(event) => { void submit(event); }}>
      <label class="field"><span>PDF locale</span><input type="file" accept="application/pdf,.pdf" onChange={choose} disabled={writing} /></label>
      <p class="file-note" role="note" data-not-redaction>
        <strong>La filigrana è una sovrapposizione visibile, NON una censura o redazione dei dati.</strong>{" "}
        Non nasconde né elimina il testo originale: informazioni riservate restano recuperabili nel PDF.
      </p>
      <p class="file-note">Supporto attuale: testo ASCII. Filigrane immagine non ancora implementate; nessun caricamento al server.</p>
      <div class="field-grid">
        <label class="field"><span>Testo filigrana</span><input value={text} maxLength={48} onInput={(event) => update(setText, event.currentTarget.value)} disabled={writing} /><small>1–48 caratteri ASCII stampabili.</small></label>
        <label class="field"><span>Pagine</span><input value={pages} onInput={(event) => update(setPages, event.currentTarget.value)} disabled={writing} /><small>* tutte; 2-4,6 sottoinsieme. Rifiuta duplicati.</small></label>
        <label class="field"><span>Posizione</span><select value={position} onChange={(event) => update(setPosition, event.currentTarget.value as PdfWatermarkPosition)} disabled={writing}>
          {POSITIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      <div class="field-grid">
        <label class="field"><span>Opacità (0,1–1)</span><input type="number" min="0.1" max="1" step="0.05" value={opacity} onInput={(event) => update(setOpacity, event.currentTarget.value)} disabled={writing} /></label>
        <label class="field"><span>Rotazione (gradi)</span><input type="number" min="-180" max="180" step="5" value={rotation} onInput={(event) => update(setRotation, event.currentTarget.value)} disabled={writing} /></label>
        <label class="field"><span>Scala (0,5–3)</span><input type="number" min="0.5" max="3" step="0.1" value={scale} onInput={(event) => update(setScale, event.currentTarget.value)} disabled={writing} /></label>
        <label class="field"><span>Margine (pt)</span><input type="number" min="12" max="72" step="1" value={margin} onInput={(event) => update(setMargin, event.currentTarget.value)} disabled={writing} /></label>
      </div>
      {loadError || calculated.error ? <p role="alert">{loadError || calculated.error}</p> : null}
      {plan !== null ? (
        <section aria-label="Anteprima watermark sulla geometria reale" data-watermark-plan>
          <p role="status">{plan.selectedPages.length} pagine su {plan.pageCount}, filigrana {text} — overlay visibile, non redazione.</p>
          <div class="actions" aria-label="Navigazione miniature">
            <button type="button" disabled={start === 1} onClick={() => setStart((n) => Math.max(1, n - 4))}>Precedenti</button>
            <label>Da pagina <input type="number" min="1" max={plan.pageCount} value={start} onInput={(event) => {
              const page = Number(event.currentTarget.value); if (Number.isInteger(page) && page >= 1 && page <= plan.pageCount) setStart(page);
            }} /></label>
            <button type="button" disabled={start + 4 > plan.pageCount} onClick={() => setStart((n) => Math.min(plan.pageCount, n + 4))}>Successive</button>
          </div>
          {previewError ? <p role="alert">{previewError}</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: "0.75rem" }}>
            {pdfThumbnailWindow(plan.pageCount, start).map((page) => {
              const wm = plan.placements.find((p) => p.page === page);
              const thumb = thumbnails.find((t) => t.page === page);
              return <div key={page} data-watermark-preview-page={page}>
                <div style={{ position: "relative", width: "100%", maxWidth: "176px", aspectRatio: wm ? `${wm.displayWidth}/${wm.displayHeight}` : "440/600" }}>
                  {thumb ? <img src={thumb.url} alt={`Anteprima PDF originale pagina ${page}`} style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }} /> : <span>Caricamento pagina {page}…</span>}
                  {thumb && wm ? <svg data-watermark-overlay-page={page} viewBox={`0 0 ${wm.displayWidth} ${wm.displayHeight}`} preserveAspectRatio="none" aria-label={`Filigrana ${wm.text} a pagina ${page}`}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                    <text x={wm.x} y={wm.displayHeight - wm.y} textAnchor="middle" dominantBaseline="central"
                      transform={`rotate(${wm.angle} ${wm.x} ${wm.displayHeight - wm.y})`} fontFamily="Helvetica, Arial, sans-serif"
                      fontSize={wm.fontSize} opacity={wm.opacity} fill="#808080">{wm.text}</text>
                  </svg> : null}
                </div><p class="file-note">Pagina {page}{wm ? ` · filigrana ${wm.position} (${wm.angle}°)` : " · invariata"}</p>
              </div>;
            })}
          </div>
          <p class="file-note">La posizione e la rotazione usano le dimensioni visibili del PDF. Il PDF finale contiene un overlay separato in grigio.</p>
        </section>
      ) : null}
      <div class="actions"><button class="primary" type="submit" disabled={writing || plan === null}>{writing ? "Applicazione…" : "Applica filigrana"}</button></div>
      {writeError ? <p role="alert">{writeError}</p> : null}
      {downloadUrl ? <div class="result-panel" data-state="success"><p role="status">PDF con filigrana generato e stream originali verificati.</p>
        <p>Overlay visibile: non elimina informazioni dal documento.</p><a href={downloadUrl} download="pdf-filigranato.pdf">Scarica PDF con filigrana</a>
      </div> : null}
    </form>
  );
}
