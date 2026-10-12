import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { inspectPdfBytes } from "../../../engines/pdf";
import { openPdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import type { PdfTablePreview254 } from "../../../engines/pdf/pdf-table-xlsx-254";
import { recordCompletedTool } from "../../../workbench/completed-tool";

export function PdfTableXlsx254Tool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [dimensions, setDimensions] = useState<readonly { width: number; height: number }[]>([]);
  const [page, setPage] = useState("1");
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [width, setWidth] = useState("200");
  const [height, setHeight] = useState("200");
  const [thumbnail, setThumbnail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PdfTablePreview254 | null>(null);
  const [output, setOutput] = useState<Blob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const generation = useRef(0);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const currentPage = dimensions[Number(page) - 1];
  const region = useMemo(() => ({ x: Number(x), y: Number(y), width: Number(width), height: Number(height) }), [x, y, width, height]);

  function invalidate() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    inFlight.current = false;
    setBusy(false); setPreview(null); setOutput(null); setError("");
  }
  useEffect(() => () => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    inFlight.current = false;
  }, []);
  useEffect(() => {
    if (!file) { setPageCount(0); setDimensions([]); return; }
    let alive = true;
    void file.arrayBuffer().then((buffer) => {
      const report = inspectPdfBytes(new Uint8Array(buffer));
      if (report.encrypted) throw new Error("UNSUPPORTED_CAPABILITY: PDF cifrato");
      if (report.pageCount < 1 || report.pageCount > 12) throw new Error("PDF_LIMIT: massimo 12 pagine");
      if (!alive) return;
      setPageCount(report.pageCount);
      const sizes = report.pages.map((entry) => ({ width: entry.width, height: entry.height }));
      setDimensions(sizes);
      setPage("1"); setX("0"); setY("0");
      setWidth(String(sizes[0]?.width ?? 200)); setHeight(String(sizes[0]?.height ?? 200));
    }).catch((cause) => { if (alive) { setPageCount(0); setDimensions([]); setError(cause instanceof Error ? cause.message : "PDF non valido"); } });
    return () => { alive = false; };
  }, [file]);
  useEffect(() => {
    if (!file || !pageCount) return;
    let alive = true;
    let current: Awaited<ReturnType<typeof openPdfThumbnailSession>> | undefined;
    let url = "";
    void (async () => {
      current = await openPdfThumbnailSession(file);
      const rendered = await current.renderPage(Number(page));
      if (alive) { url = URL.createObjectURL(rendered); setThumbnail(url); }
    })().catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Anteprima PDF non riuscita"); })
      .finally(() => { void current?.close(); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); void current?.close(); };
  }, [file, page, pageCount]);
  useEffect(() => {
    if (!output) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(output);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [output]);

  async function analyze(event: Event) {
    event.preventDefault();
    if (inFlight.current) return;
    const operation = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    inFlight.current = true;
    setPreview(null); setOutput(null); setError(""); setBusy(true);
    try {
      if (!file || !currentPage) throw new Error("Seleziona prima il PDF");
      const { previewPdfTable254 } = await import("../../../engines/pdf/pdf-table-xlsx-254");
      if (operation !== generation.current || abort.signal.aborted) return;
      const found = await previewPdfTable254(file, { page: Number(page), region: { ...region } }, abort.signal);
      if (operation === generation.current && !abort.signal.aborted) setPreview(found);
    } catch (cause) {
      if (operation === generation.current && !abort.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Griglia non identificabile");
    } finally {
      if (controller.current === abort) { controller.current = null; inFlight.current = false; }
      if (operation === generation.current) setBusy(false);
    }
  }
  async function exportWorkbook() {
    if (inFlight.current) return;
    const operation = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    inFlight.current = true;
    setBusy(true); setError(""); setOutput(null);
    try {
      if (!preview) throw new Error("Verifica prima la tabella nell'anteprima");
      const { exportPdfTableXlsx254 } = await import("../../../engines/pdf/pdf-table-xlsx-254");
      if (operation !== generation.current || abort.signal.aborted) return;
      const workbook = await exportPdfTableXlsx254(preview, abort.signal);
      if (operation !== generation.current || abort.signal.aborted) return;
      if (!(workbook.blob instanceof Blob) || workbook.blob.size < 80)
        throw new Error("XLSX non verificato");
      setOutput(workbook.blob);
      // Persist only the registered public tool ID, never source file/cells/bytes.
      recordCompletedTool("pdf-tables-to-xlsx");
    } catch (cause) {
      if (operation === generation.current && !abort.signal.aborted) {
        setOutput(null);
        setError(cause instanceof Error ? cause.message : "XLSX non verificato");
      }
    } finally {
      if (controller.current === abort) { controller.current = null; inFlight.current = false; }
      if (operation === generation.current) setBusy(false);
    }
  }

  return <div data-pdf-table-254 style={{ maxWidth: "960px", margin: "1rem auto" }}>
    <form class="tool-operation" onSubmit={(event) => void analyze(event)}>
      <label class="field"><span>Documento PDF locale (massimo 8 MiB, 12 pagine)</span>
        <input aria-label="Documento PDF" type="file" accept=".pdf,application/pdf" onChange={(event) => {
          setFile(event.currentTarget.files?.[0] ?? null); setPageCount(0); setThumbnail(""); invalidate();
        }} />
      </label>
      <p class="file-note"><strong>Solo tabelle con griglia fisicamente disegnata nel PDF:</strong> scegli una pagina e un rettangolo, quindi verifica le celle individuate. PDF scansiti, colonne dedotte dagli spazi, celle unite/vuote o righe ambigue vengono rifiutati. Nessun OCR, nessun caricamento remoto.</p>
      {pageCount > 0 && <>
        <label class="field"><span>Pagina sorgente (1–{pageCount})</span>
          <select aria-label="Pagina sorgente" value={page} onChange={(event) => {
            const next = event.currentTarget.value; setPage(next);
            const size = dimensions[Number(next) - 1];
            if (size) { setX("0"); setY("0"); setWidth(String(size.width)); setHeight(String(size.height)); }
            invalidate();
          }}>{Array.from({ length: pageCount }, (_, i) => <option value={i + 1}>{i + 1}</option>)}</select>
        </label>
        <div class="field-grid">
          {([
            ["Origine X (pt)", x, setX],
            ["Origine Y dall'alto (pt)", y, setY],
            ["Larghezza rettangolo (pt)", width, setWidth],
            ["Altezza rettangolo (pt)", height, setHeight],
          ] as const).map(([label, value, setter]) => <label class="field"><span>{label}</span>
            <input aria-label={label} type="number" min="0" max="14000" step="0.5" value={value}
              onInput={(event) => { setter(event.currentTarget.value); invalidate(); }} disabled={busy} /></label>)}
        </div>
        {thumbnail && currentPage && <figure style={{ margin: "1rem 0" }}>
          <div style={{ position: "relative", display: "inline-block", width: "min(100%, 320px)" }}>
            <img data-pdf-table-thumbnail src={thumbnail} alt={`Pagina PDF ${page} letta con PDF.js`} style={{ width: "100%", display: "block", border: "1px solid #788" }} />
            <div data-pdf-table-selection aria-hidden="true" style={{
              position: "absolute", pointerEvents: "none", boxSizing: "border-box", border: "2px solid #ee5511",
              left: `${region.x / currentPage.width * 100}%`, top: `${region.y / currentPage.height * 100}%`,
              width: `${region.width / currentPage.width * 100}%`, height: `${region.height / currentPage.height * 100}%`,
            }} />
          </div>
          <figcaption>Regione selezionata in arancione; coordinate in punti PDF dall'angolo in alto a sinistra.</figcaption>
        </figure>}
      </>}
      {error && <p role="alert">{error}</p>}
      <div class="actions"><button type="submit" class="primary" disabled={busy || !currentPage || !pageCount}>{busy ? "Analisi in locale..." : "Estrai e mostra griglia"}</button>
        <button type="button" data-pdf-table-cancel disabled={!busy} onClick={invalidate}>Annulla operazione</button></div>
    </form>
    {preview && <section data-pdf-table-preview aria-label="Anteprima celle prima dell'esportazione" style={{ margin: "1.5rem auto" }}>
      <h2>Anteprima verificata: {preview.rows} righe × {preview.columns} colonne</h2>
      <p data-pdf-table-provenance>PDF: {preview.sourceFilename} · pagina {preview.page} ·
        x={preview.region.x}, y={preview.region.y}, larghezza={preview.region.width}, altezza={preview.region.height} pt ·
        SHA-256 {preview.sourceSha256}</p>
      <div style={{ maxWidth: "100%", overflowX: "auto" }}>
        <table data-pdf-table-grid style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>{preview.cells.map((row) => <tr>{row.map((cell) =>
            <td style={{ border: "1px solid #889", padding: "6px", whiteSpace: "pre-wrap" }}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <ul>{preview.warnings.map((note) => <li>{note}</li>)}</ul>
      <button type="button" class="primary" disabled={busy} onClick={() => void exportWorkbook()}>
        {busy ? "Scrittura e riapertura XLSX..." : "Verifica e genera XLSX"}
      </button>
      {downloadUrl && <p data-pdf-table-result role="status">
        XLSX riaperto e confrontato cella per cella. <a href={downloadUrl} download="tabella-pdf-verificata.xlsx">Scarica XLSX verificato</a>
      </p>}
    </section>}
  </div>;
}
