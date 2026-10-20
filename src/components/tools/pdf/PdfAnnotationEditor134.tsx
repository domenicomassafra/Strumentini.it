import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "preact/hooks";
import type { PdfAnnotation134, PdfAnnotationKind134 } from "../../../engines/pdf/annotations-134";
import { runPdfAnnotationWorker134 } from "../../../engines/pdf/annotations-worker-client-134";
import { preparePdfResult, PdfResultV2, type PreparedPdfResult } from "./PdfResultV2";

interface Viewport134 {
  readonly width: number;
  readonly height: number;
  convertToPdfPoint(x: number, y: number): [number, number];
  convertToViewportPoint(x: number, y: number): [number, number];
}
interface Preview134 {
  url: string;
  viewport: Viewport134;
  crop: readonly [number, number, number, number];
}
const MODES: { value: PdfAnnotationKind134; label: string }[] = [
  { value: "highlight", label: "Evidenzia" },
  { value: "rectangle", label: "Riquadro" },
  { value: "note", label: "Commento" },
];
const LABELS: Record<PdfAnnotationKind134, string> = { highlight: "Evidenziato", rectangle: "Riquadro", note: "Commento" };

export function PdfAnnotationEditor134({ file, pageCount, initialPage }: { file: File; pageCount: number; initialPage: number }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState<Preview134 | null>(null);
  const [mode, setMode] = useState<PdfAnnotationKind134>("highlight");
  const [comment, setComment] = useState("");
  const [marks, setMarks] = useState<PdfAnnotation134[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreparedPdfResult | null>(null);
  const [percent, setPercent] = useState({ x: 15, y: 20, w: 35, h: 6 });
  const pointerStart = useRef<[number, number] | null>(null);
  const active = useRef<AbortController | null>(null);

  useEffect(() => { setPage(initialPage); }, [initialPage]);
  useEffect(() => {
    let closed = false;
    let loading: ReturnType<typeof import("pdfjs-dist").getDocument> | null = null;
    void (async () => {
      try {
        const [pdfjs, worker] = await Promise.all([
          import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.mjs?url"),
        ]);
        if (closed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), stopAtErrors: true });
        const document = await loading.promise;
        if (closed) { await loading.destroy(); return; }
        setPdf(document);
      } catch (reason) {
        if (!closed) setError("Impossibile aprire l'anteprima: " + (reason instanceof Error ? reason.message : "PDF non supportato"));
      }
    })();
    return () => { closed = true; setPdf(null); if (loading) void loading.destroy(); };
  }, [file]);

  useEffect(() => {
    if (!pdf) return;
    let closed = false;
    let job: ReturnType<Awaited<ReturnType<typeof pdf.getPage>>["render"]> | null = null;
    let url: string | null = null;
    void (async () => {
      let canvas: HTMLCanvasElement | null = null;
      let cleanupPage: (() => void) | null = null;
      try {
        const pdfPage = await pdf.getPage(page);
        cleanupPage = () => pdfPage.cleanup();
        if (closed) return;
        const base = pdfPage.getViewport({ scale: 1, rotation: (pdfPage.rotate + rotation) % 360 });
        const scale = Math.min(zoom, 960 / base.width, 1200 / base.height);
        const viewport = pdfPage.getViewport({ scale, rotation: (pdfPage.rotate + rotation) % 360 });
        canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas non supportato");
        job = pdfPage.render({ canvas, canvasContext: context, viewport, background: "rgb(255,255,255)" });
        await job.promise;
        if (closed) return;
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) =>
          value ? resolve(value) : reject(new Error("Anteprima non disponibile")), "image/png"));
        if (closed) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, viewport, crop: pdfPage.view as [number, number, number, number] });
      } catch (reason) {
        if (!closed) setError("Anteprima PDF non disponibile: " + (reason instanceof Error ? reason.message : "errore"));
      } finally {
        if (canvas) { canvas.width = 0; canvas.height = 0; }
        cleanupPage?.();
      }
    })();
    return () => { closed = true; job?.cancel(); if (url) URL.revokeObjectURL(url); setPreview(null); };
  }, [pdf, page, rotation, zoom]);

  useEffect(() => () => active.current?.abort(), []);

  function addMark(left: number, top: number, right: number, bottom: number) {
    if (!preview || busy || marks.length >= 100) return;
    const viewport = preview.viewport;
    const a = viewport.convertToPdfPoint(left, top);
    const b = viewport.convertToPdfPoint(right, bottom);
    const [c0, c1, c2, c3] = preview.crop;
    let x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
    let width = Math.abs(a[0] - b[0]), height = Math.abs(a[1] - b[1]);
    if (mode === "note") {
      width = 22; height = 22;
      x = Math.max(c0, Math.min(x, c2 - width));
      y = Math.max(c1, Math.min(y, c3 - height));
    }
    if (width < 2 || height < 2 || x < c0 || y < c1 || x + width > c2 + 0.01 || y + height > c3 + 0.01) {
      setError("Traccia un'area valida all'interno della pagina."); return;
    }
    if (mode === "note" && !comment.trim()) {
      setError("Scrivi prima il testo del commento."); return;
    }
    setMarks((prev) => [...prev, { page, kind: mode, x, y, width, height, comment: comment.trim() }]);
    setError("");
    setResult(null);
  }

  function displayPoint(event: PointerEvent): [number, number] {
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * (preview?.viewport.width ?? 0),
      Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * (preview?.viewport.height ?? 0),
    ];
  }

  function keyboardMark() {
    if (!preview) return;
    const { width, height } = preview.viewport;
    const x = width * percent.x / 100, y = height * percent.y / 100;
    addMark(x, y, width * (percent.x + percent.w) / 100, height * (percent.y + percent.h) / 100);
  }

  async function save() {
    if (!marks.length || busy) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(""); setResult(null);
    try {
      const artifact = await runPdfAnnotationWorker134(file, marks, controller.signal);
      if (controller.signal.aborted) return;
      const prepared = await preparePdfResult("pdf-page-reorder", {
        artifacts: [artifact], artifactCount: 1, operation: "annotate",
        annotations: marks.length,
        policy: "Annotazioni PDF reali (evidenziazione, riquadro e commenti), verifica di riapertura e originale intatto. Nessun upload.",
      });
      if (controller.signal.aborted || active.current !== controller) return;
      if (prepared.artifacts[0]?.artifact.verification.state !== "verified") throw new Error("Verifica PDF fallita");
      setResult(prepared);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Esportazione fallita");
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }

  return <section class="tool-form-card" aria-label="Editor annotazioni PDF" data-pdf-annotations-134>
    <h3>Annota il PDF</h3>
    <p class="file-note">Seleziona una pagina, scegli il segno e trascina sull'anteprima. Per la tastiera puoi inserire le coordinate percentuali qui sotto. L'originale resta sul dispositivo.</p>
    <div class="actions">
      <label>Pagina <select aria-label="Pagina da annotare" value={page} disabled={busy} onChange={(event) => setPage(Number(event.currentTarget.value))}>
        {Array.from({ length: pageCount }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select></label>
      <label>Rotazione vista <select aria-label="Ruota anteprima" value={rotation} onChange={(event) => setRotation(Number(event.currentTarget.value) as 0 | 90 | 180 | 270)}>
        {[0, 90, 180, 270].map((angle) => <option value={angle} key={angle}>{angle}°</option>)}
      </select></label>
      <label>Zoom <select aria-label="Zoom anteprima" value={zoom} onChange={(event) => setZoom(Number(event.currentTarget.value))}>
        {[0.5, 0.75, 1, 1.25, 1.5].map((scale) => <option value={scale} key={scale}>{Math.round(scale * 100)}%</option>)}
      </select></label>
    </div>
    <fieldset class="field"><legend>Tipo di annotazione</legend>
      {MODES.map((entry) => <label key={entry.value}><input type="radio" name="pdf-annotation-134-mode" checked={mode === entry.value}
        disabled={busy} onChange={() => setMode(entry.value)} /> {entry.label}</label>)}
    </fieldset>
    <label class="field"><span>Testo del commento (facoltativo per evidenziazioni e riquadri)</span>
      <textarea rows={2} maxLength={1000} value={comment} disabled={busy} onInput={(event) => setComment(event.currentTarget.value)}
        aria-label="Testo del commento" placeholder="Scrivi la nota che sarà salvata nel PDF" /></label>
    {preview ? <div style={{ maxWidth: preview.viewport.width + "px", width: "100%", margin: "0 auto", position: "relative" }}>
      <img src={preview.url} alt={"Pagina " + page + " del PDF"} draggable={false} style={{ display: "block", width: "100%", height: "auto", border: "1px solid #888" }} />
      <div aria-label="Area touch per annotazioni PDF" role="img" style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "crosshair" }}
        onPointerDown={(event) => { if (busy) return; pointerStart.current = displayPoint(event); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={(event) => {
          const start = pointerStart.current;
          pointerStart.current = null;
          if (!start) return;
          const end = displayPoint(event);
          addMark(start[0], start[1], end[0], end[1]);
        }}
        onPointerCancel={() => { pointerStart.current = null; }}>
        {marks.filter((mark) => mark.page === page).map((mark, index) => {
          const first = preview.viewport.convertToViewportPoint(mark.x, mark.y);
          const last = preview.viewport.convertToViewportPoint(mark.x + mark.width, mark.y + mark.height);
          const left = Math.min(first[0], last[0]), top = Math.min(first[1], last[1]);
          const width = Math.abs(first[0] - last[0]), height = Math.abs(first[1] - last[1]);
          return <span key={index} title={mark.comment || LABELS[mark.kind]} style={{
            position: "absolute", left: left / preview.viewport.width * 100 + "%", top: top / preview.viewport.height * 100 + "%",
            width: width / preview.viewport.width * 100 + "%", height: height / preview.viewport.height * 100 + "%",
            pointerEvents: "none", background: mark.kind === "highlight" ? "rgba(255,215,0,.32)" : mark.kind === "note" ? "rgba(255,215,0,.85)" : "transparent",
            border: mark.kind === "rectangle" ? "2px solid #2373b0" : "none",
          }} />;
        })}
      </div>
    </div> : <p role="status">Caricamento pagina PDF…</p>}
    <fieldset class="field"><legend>Posizione accessibile da tastiera (% della pagina visualizzata)</legend>
      <div class="actions">
        {(["x", "y", "w", "h"] as const).map((key) => <label key={key}>{({ x: "Sinistra", y: "Alto", w: "Larghezza", h: "Altezza" })[key]}
          <input type="number" min={0} max={100} value={percent[key]} style={{ width: "5rem" }} aria-label={key + " percentuale"}
            onInput={(event) => setPercent((old) => ({ ...old, [key]: Number(event.currentTarget.value) }))} /></label>)}
        <button type="button" onClick={keyboardMark} disabled={!preview || busy}>Aggiungi con coordinate</button>
      </div>
    </fieldset>
    <p role="status">{marks.length} annotazioni pronte su {pageCount} pagine (massimo 100).</p>
    {marks.length > 0 && <ol>{marks.map((mark, index) => <li key={index}>
      Pagina {mark.page} · {LABELS[mark.kind]}{mark.comment ? ": " + mark.comment.slice(0, 80) : ""}
      {" "}<button type="button" disabled={busy} onClick={() => { setMarks((old) => old.filter((_, i) => i !== index)); setResult(null); }}>Rimuovi</button>
    </li>)}</ol>}
    {error && <p role="alert">{error}</p>}
    <div class="actions">
      <button type="button" disabled={busy || marks.length === 0} onClick={() => void save()}>Salva PDF annotato e verifica</button>
      {busy && <button type="button" onClick={() => active.current?.abort()}>Annulla</button>}
    </div>
    {busy && <p role="status">Scrittura locale delle annotazioni PDF…</p>}
    {result && <PdfResultV2 toolId="pdf-page-reorder" result={result} sourceFiles={[file]}
      onReset={() => { setResult(null); setMarks([]); }} onRetry={() => void save()} />}
  </section>;
}
