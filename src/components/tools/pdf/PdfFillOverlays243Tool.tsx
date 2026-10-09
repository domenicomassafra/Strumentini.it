import { useEffect, useMemo, useState } from "preact/hooks";
import { inspectPdfBytes } from "../../../engines/pdf";
import { openPdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import type { Pdf243Field, Pdf243Mode, Pdf243Plan } from "../../../engines/pdf/fill-overlays-243";

export function PdfFillOverlays243Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<readonly { width: number; height: number }[]>([]);
  const [page, setPage] = useState("1");
  const [mode, setMode] = useState<Pdf243Mode>("text");
  const [x, setX] = useState("50");
  const [y, setY] = useState("60");
  const [width, setWidth] = useState("200");
  const [height, setHeight] = useState("30");
  const [text, setText] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fields, setFields] = useState<readonly Pdf243Field[]>([]);
  const [sourcePreview, setSourcePreview] = useState("");
  const [resultPreview, setResultPreview] = useState("");
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [plan, setPlan] = useState<Pdf243Plan | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const current = pages[Number(page) - 1];
  const options = useMemo(() => ({
    mode, page: Number(page), x: Number(x), y: Number(y), width: Number(width), height: Number(height),
    fieldName, text,
  }), [mode, page, x, y, width, height, fieldName, text]);
  function invalidate() {
    setPlan(null); setResult(null); setError("");
  }
  useEffect(() => {
    if (file === null) { setPages([]); setFields([]); return; }
    let live = true;
    void file.arrayBuffer().then(async (buffer) => {
      const bytes = new Uint8Array(buffer);
      const info = inspectPdfBytes(bytes);
      if (info.encrypted || info.pageCount < 1 || info.pageCount > 24 || file.size > 8 * 1024 * 1024) {
        throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato, oltre 8 MiB o 24 pagine");
      }
      const { listPdf243Fields } = await import("../../../engines/pdf/fill-overlays-243");
      let supported: readonly Pdf243Field[] = [];
      try { supported = listPdf243Fields(bytes); } catch { /* invalid/absent form -> overlay mode still possible */ }
      if (!live) return;
      setPages(info.pages.map((entry) => ({ width: entry.width, height: entry.height })));
      setFields(supported); setFieldName(supported[0]?.name ?? ""); setPage("1");
    }).catch((cause) => {
      if (live) { setPages([]); setFields([]); setError(cause instanceof Error ? cause.message : "PDF non valido"); }
    });
    return () => { live = false; };
  }, [file]);
  useEffect(() => {
    if (!file || pages.length === 0) { setSourcePreview(""); return; }
    let live = true;
    let url = "";
    let session: Awaited<ReturnType<typeof openPdfThumbnailSession>> | undefined;
    void (async () => {
      session = await openPdfThumbnailSession(file);
      const png = await session.renderPage(Number(page));
      if (live) { url = URL.createObjectURL(png); setSourcePreview(url); }
    })().catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Anteprima sorgente fallita"); })
      .finally(() => { void session?.close(); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); void session?.close(); };
  }, [file, page, pages.length]);
  useEffect(() => {
    if (!result) { setResultUrl(""); setResultPreview(""); return; }
    const url = URL.createObjectURL(result);
    setResultUrl(url);
    let live = true;
    let pngUrl = "";
    let session: Awaited<ReturnType<typeof openPdfThumbnailSession>> | undefined;
    void (async () => {
      session = await openPdfThumbnailSession(new File([result], "flattened-243.pdf", { type: "application/pdf" }));
      const png = await session.renderPage(Number(page));
      if (live) { pngUrl = URL.createObjectURL(png); setResultPreview(pngUrl); }
    })().catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Anteprima output non riuscita"); })
      .finally(() => { void session?.close(); });
    return () => { live = false; URL.revokeObjectURL(url); if (pngUrl) URL.revokeObjectURL(pngUrl); void session?.close(); };
  }, [result, page]);
  async function submit(event: Event) {
    event.preventDefault();
    setWorking(true); setPlan(null); setResult(null); setError("");
    try {
      if (!file || !current) throw new Error("Carica prima il PDF");
      const { writePdf243 } = await import("../../../engines/pdf/fill-overlays-243");
      const output = writePdf243(new Uint8Array(await file.arrayBuffer()), options);
      setPlan(output.plan);
      setResult(output.artifact.blob);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDF non esportabile"); }
    finally { setWorking(false); }
  }
  function imageTap(event: PointerEvent) {
    if (!current || mode === "text-field") return;
    const element = event.currentTarget as HTMLImageElement;
    const rect = element.getBoundingClientRect();
    const px = Math.round((event.clientX - rect.left) / rect.width * current.width);
    const py = Math.round((event.clientY - rect.top) / rect.height * current.height);
    setX(String(Math.max(0, Math.min(px, Math.floor(current.width - Number(width))))));
    setY(String(Math.max(0, Math.min(py, Math.floor(current.height - Number(height))))));
    invalidate();
  }
  return <form data-pdf-fill-243 class="tool-operation" onSubmit={(event) => void submit(event)}
    style={{ maxWidth: "960px", margin: "1rem auto" }}>
    <label class="field"><span>PDF locale (massimo 8 MiB / 24 pagine)</span>
      <input aria-label="Documento PDF" type="file" accept=".pdf,application/pdf" disabled={working}
        onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); setPages([]); invalidate(); }} />
    </label>
    <p class="file-note" data-243-disclosure><strong>Esportazione sempre appiattita:</strong> il testo e le evidenziazioni diventano contenuti visibili della pagina, non annotazioni modificabili. I campi modulo /Tx supportati vengono compilati visivamente, ma rimossi dall'output; nessuna promessa di PDF compilabile, firma o oscuramento sicuro. Firme, script, moduli complessi e annotazioni esistenti sono rifiutati.</p>
    {pages.length > 0 && <>
      <div class="field-grid">
        <label class="field"><span>Operazione</span>
          <select aria-label="Operazione" value={mode} disabled={working} onChange={(event) => {
            setMode(event.currentTarget.value as Pdf243Mode); invalidate();
          }}>
            <option value="text">Scrivi testo visibile</option>
            <option value="highlight">Evidenzia rettangolo (non oscuramento)</option>
            <option value="text-field">Compila campo modulo /Tx e appiattisci</option>
          </select></label>
        <label class="field"><span>Pagina</span>
          <select aria-label="Pagina" value={page} disabled={working} onChange={(event) => {
            setPage(event.currentTarget.value); invalidate();
          }}>{pages.map((_entry, index) => <option value={index + 1}>{index + 1}</option>)}</select></label>
      </div>
      {mode === "text-field" && <label class="field"><span>Campo testo esistente</span>
        <select aria-label="Campo testo" value={fieldName} disabled={working} onChange={(event) => {
          setFieldName(event.currentTarget.value); invalidate();
        }}>
          {fields.length === 0 && <option value="">Nessun campo /Tx verificabile</option>}
          {fields.map((item) => <option value={item.name}>{item.name} (pagina {item.page})</option>)}
        </select></label>}
      {mode !== "highlight" && <label class="field"><span>Testo da scrivere (ASCII, max 70 caratteri)</span>
        <input aria-label="Testo da scrivere" value={text} maxLength={70} disabled={working}
          onInput={(event) => { setText(event.currentTarget.value); invalidate(); }} placeholder="Testo verificabile" />
      </label>}
      {mode !== "text-field" && <div class="field-grid">
        {([
          ["X dall'angolo alto sinistro (pt)", x, setX],
          ["Y dall'alto (pt)", y, setY],
          ["Larghezza (pt)", width, setWidth],
          ["Altezza (pt)", height, setHeight],
        ] as const).map(([label, value, setter]) => <label class="field"><span>{label}</span>
          <input aria-label={label} type="number" min="0" step="1" value={value} disabled={working}
            onInput={(event) => { setter(event.currentTarget.value); invalidate(); }} /></label>)}
      </div>}
      {current && sourcePreview && <figure style={{ margin: "1rem 0" }}>
        <div style={{ position: "relative", display: "inline-block", width: "min(100%, 300px)" }}>
          <img data-243-source-preview src={sourcePreview} alt={`Anteprima PDF pagina ${page}, tocca per scegliere posizione`}
            onPointerDown={imageTap} style={{ display: "block", width: "100%", cursor: "crosshair", touchAction: "manipulation",
              border: "1px solid #889" }} />
          {mode !== "text-field" && <div data-243-position aria-hidden="true" style={{
            position: "absolute", pointerEvents: "none", boxSizing: "border-box", border: "2px solid #df5900",
            left: `${Number(x) / current.width * 100}%`, top: `${Number(y) / current.height * 100}%`,
            width: `${Number(width) / current.width * 100}%`, height: `${Number(height) / current.height * 100}%`,
          }} />}
        </div>
        <figcaption>Posiziona con tocco/click sulla pagina oppure con i campi X/Y/Larghezza/Altezza accessibili da tastiera. Solo pagine senza rotazione.</figcaption>
      </figure>}
    </>}
    {error && <p role="alert">{error}</p>}
    <div class="actions"><button type="submit" class="primary" disabled={!current || working || (mode === "text-field" && fields.length === 0)}>
      {working ? "Elaborazione in locale..." : "Appiattisci e verifica PDF"}
    </button></div>
    {plan && resultUrl && <section data-243-result class="result-panel" data-state="success">
      <p role="status">PDF appiattito: pagina {plan.page}, {plan.mode === "text-field" ? `campo ${plan.fieldName}` : `regione ${plan.x}, ${plan.y}, ${plan.width}×${plan.height} pt`}.</p>
      <p>Il contenuto originale è stato preservato, le annotazioni e i widget non sono presenti nell'output. Il documento non è più modificabile come modulo.</p>
      {resultPreview && <img data-243-output-preview src={resultPreview}
        alt="Pagina PDF esportata, riaperta e disegnata da PDF.js" style={{ display: "block", maxWidth: "min(100%, 300px)" }} />}
      <a href={resultUrl} download="pdf-overlay-flattened.pdf">Scarica PDF appiattito</a>
    </section>}
  </form>;
}
