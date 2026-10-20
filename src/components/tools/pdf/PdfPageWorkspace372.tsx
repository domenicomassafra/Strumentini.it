import { useEffect, useRef, useState } from "preact/hooks";
import { adjacentPdfPageId, movePdfPageId } from "../../../engines/pdf/page-order-controls";
import { openPdfThumbnailSession, PDF_THUMBNAIL_WINDOW, type PdfThumbnailSession } from "../../../engines/pdf/thumbnails";
import { PDF_LIMITS } from "../../../engines/pdf/types";
import type { PdfWorkspaceMode372 } from "../../../engines/pdf/workspace-372";
import { runPdfWorkspaceWorker372 } from "../../../engines/pdf/workspace-worker-client-372";
import { PdfResultV2, preparePdfResult, type PreparedPdfResult } from "./PdfResultV2";

interface Thumbnail { page: number; url?: string; error?: string }

export function PdfPageWorkspace372() {
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<PdfThumbnailSession | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [start, setStart] = useState(0);
  const [target, setTarget] = useState("1");
  const [images, setImages] = useState<Thumbnail[]>([]);
  const [mode, setMode] = useState<PdfWorkspaceMode372>("reorder");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreparedPdfResult | null>(null);
  const active = useRef<AbortController | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);

  function updateOrder(next: number[]) {
    if (busy) return;
    setOrder(next);
    setResult(null);
    setError("");
  }
  function reset() {
    active.current?.abort();
    active.current = null;
    setFile(null);
    setSession(null);
    setOrder([]);
    setSelected([]);
    setStart(0);
    setMode("reorder");
    setError("");
    setResult(null);
    setBusy(false);
  }
  function choose(event: Event) {
    const next = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setFile(next);
    setSession(null);
    setOrder([]);
    setSelected([]);
    setStart(0);
    setMode("reorder");
    setResult(null);
    setError(next && next.size > PDF_LIMITS.maxBytes
      ? "PDF troppo grande: massimo 25 MiB. Il file originale non è stato modificato."
      : "");
  }

  useEffect(() => {
    if (file === null || file.size > PDF_LIMITS.maxBytes) return;
    let disposed = false;
    const controller = new AbortController();
    let opened: PdfThumbnailSession | undefined;
    void openPdfThumbnailSession(file, controller.signal).then((value) => {
      opened = value;
      if (disposed) { void value.close(); return; }
      setSession(value);
      setOrder(Array.from({ length: value.pageCount }, (_, index) => index + 1));
    }).catch((reason) => {
      if (!disposed) setError("PDF non leggibile o non supportato: " +
        (reason instanceof Error ? reason.message : "controlla il file") + ". Originale conservato.");
    });
    return () => {
      disposed = true;
      controller.abort();
      if (opened) void opened.close();
    };
  }, [file]);

  useEffect(() => {
    if (!session || order.length === 0) return;
    const controller = new AbortController();
    const urls: string[] = [];
    const windowPages = order.slice(start, start + PDF_THUMBNAIL_WINDOW);
    setImages(windowPages.map((page) => ({ page })));
    void (async () => {
      for (const page of windowPages) {
        if (controller.signal.aborted) break;
        try {
          const blob = await session.renderPage(page, 0, controller.signal);
          if (controller.signal.aborted) break;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setImages((items) => items.map((entry) => entry.page === page ? { page, url } : entry));
        } catch (reason) {
          if (controller.signal.aborted) break;
          setImages((items) => items.map((entry) => entry.page === page ? {
            page, error: reason instanceof Error ? reason.message : "Non disponibile",
          } : entry));
        }
      }
    })();
    return () => {
      controller.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [session, start, order.join(",")]);

  useEffect(() => () => { active.current?.abort(); }, []);
  const selectedSet = new Set(selected);
  const current = order.slice(start, start + PDF_THUMBNAIL_WINDOW);
  const ready = file !== null && session !== null && order.length > 0;

  function toggle(page: number) {
    if (busy) return;
    setSelected((prev) => prev.includes(page) ? prev.filter((id) => id !== page) : [...prev, page]);
    setResult(null);
    setError("");
  }
  function moveBatch(to: "begin" | "end") {
    if (busy) return;
    const moving = order.filter((page) => selectedSet.has(page));
    if (moving.length === 0) return;
    const rest = order.filter((page) => !selectedSet.has(page));
    updateOrder(to === "begin" ? [...moving, ...rest] : [...rest, ...moving]);
    setStart(to === "begin" ? 0 : Math.max(0, order.length - PDF_THUMBNAIL_WINDOW));
  }
  function moveSelectedToPosition() {
    if (busy) return;
    const destination = Number(target);
    if (!Number.isInteger(destination) || destination < 1 || destination > order.length || selected.length !== 1) {
      setError("Seleziona una sola pagina e indica una posizione valida.");
      return;
    }
    const source = selected[0]!;
    const next = order.filter((page) => page !== source);
    next.splice(destination - 1, 0, source);
    updateOrder(next);
    setStart(Math.max(0, destination - 1 - Math.floor(PDF_THUMBNAIL_WINDOW / 2)));
  }

  async function save() {
    if (!ready || busy || active.current) return;
    if (mode === "selected" && selected.length === 0) {
      setError("Seleziona almeno una pagina per l'estrazione.");
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const artifact = await runPdfWorkspaceWorker372(file, order, selected, mode, controller.signal);
      if (controller.signal.aborted) return;
      const prepared = await preparePdfResult("pdf-page-reorder", {
        artifacts: [artifact], artifactCount: 1,
        operation: mode === "selected" ? "extract" : "reorder",
        order: mode === "selected" ? order.filter((page) => selectedSet.has(page)) : order,
        policy: "Operazione locale; originale immutato. Il file esportato è stato riaperto con pdf-lib e con il parser PDF del risultato. Le miniature non certificano la resa visiva completa.",
      });
      if (controller.signal.aborted || active.current !== controller) return;
      if (prepared.artifacts.length !== 1 || prepared.artifacts[0]?.artifact.verification.state !== "verified") {
        throw new Error("Il risultato PDF non ha superato la verifica: nessun download.");
      }
      setResult(prepared);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "PDF non elaborabile, originale intatto.");
    } finally {
      if (active.current === controller) active.current = null;
      setBusy(false);
    }
  }

  return (
    <section class="tool-operation" data-pdf-workspace-372>
      <section class="tool-form-card">
        <p class="file-note">Organizza localmente un PDF, tocca le miniature per selezionare le pagine, spostale e scarica una nuova copia. Il file originale rimane invariato.</p>
        <label class="field"><span>PDF da modificare</span>
          <input type="file" accept="application/pdf,.pdf" onChange={choose} disabled={busy} aria-label="PDF da modificare" />
          <small>Massimo 25 MiB, 200 pagine. Quattro miniature per volta; nessun caricamento su server.</small>
        </label>
        {file && <p role="status">{file.name} · {(file.size / 1024).toFixed(1)} KiB · {order.length ? order.length + " pagine" : "lettura pagine…"}</p>}
        {error && <p role="alert">{error}</p>}
        {ready && <>
          <div class="actions" role="group" aria-label="Operazioni pagine">
            <button type="button" disabled={busy} onClick={() => { setSelected([...order]); setResult(null); }}>Seleziona tutte</button>
            <button type="button" disabled={busy} onClick={() => { setSelected([]); setResult(null); }}>Deseleziona</button>
            <button type="button" onClick={() => moveBatch("begin")} disabled={busy || !selected.length}>Sposta selezionate all'inizio</button>
            <button type="button" onClick={() => moveBatch("end")} disabled={busy || !selected.length}>Sposta selezionate alla fine</button>
          </div>
          <div class="actions">
            <label>Posizione destinazione <input aria-label="Posizione destinazione" type="number" min="1" max={order.length} value={target} onInput={(event) => setTarget(event.currentTarget.value)} style={{ width: "5rem" }} disabled={busy} /></label>
            <button type="button" onClick={moveSelectedToPosition} disabled={busy || selected.length !== 1}>Sposta pagina selezionata qui</button>
            <button type="button" onClick={() => updateOrder([...order].reverse())} disabled={busy}>Inverti ordine</button>
          </div>
          <p role="status" data-pdf-order-status>{order.length} pagine · {selected.length} selezionate · ordine corrente: {order.slice(0, 10).join(", ")}{order.length > 10 ? "…" : ""}</p>
          <section aria-label="Miniature e ordine delle pagine" data-pdf-thumbnail-workspace data-window-size={PDF_THUMBNAIL_WINDOW}>
            <div class="actions" aria-label="Navigazione miniature">
              <button type="button" disabled={busy || start === 0} onClick={() => setStart(Math.max(0, start - PDF_THUMBNAIL_WINDOW))}>Precedenti</button>
              <span role="status">Posizioni {start + 1}–{Math.min(order.length, start + PDF_THUMBNAIL_WINDOW)} di {order.length}</span>
              <button type="button" disabled={busy || start + PDF_THUMBNAIL_WINDOW >= order.length} onClick={() => setStart(Math.min(order.length - 1, start + PDF_THUMBNAIL_WINDOW))}>Successive</button>
            </div>
            <ol style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))", gap: "0.75rem", padding: "0", listStyle: "none" }}>
              {current.map((page, index) => {
                const thumb = images.find((entry) => entry.page === page);
                const position = start + index;
                return <li key={page} data-workspace-page={page} draggable={!busy}
                  onDragStart={(event) => { setDragged(page); event.dataTransfer?.setData("text/plain", String(page)); }}
                  onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged !== null && dragged !== page) updateOrder(movePdfPageId(order, dragged, page));
                    setDragged(null);
                  }} style={{ minWidth: 0, border: selectedSet.has(page) ? "2px solid currentColor" : "1px solid #888", borderRadius: "0.5rem", padding: "0.5rem" }}>
                  <button type="button" aria-pressed={selectedSet.has(page)} onClick={() => toggle(page)} disabled={busy}
                    aria-label={`Seleziona pagina originale ${page}`} style={{ display: "block", width: "100%", minHeight: "4rem" }}>
                    {thumb?.url ? <img src={thumb.url} alt={`Anteprima pagina originale ${page}`} style={{ maxWidth: "100%", maxHeight: "208px", objectFit: "contain" }} /> :
                      <span>{thumb?.error ? "Anteprima non disponibile" : "Caricamento anteprima…"}</span>}
                    <span style={{ display: "block" }}>Posizione {position + 1} · originale {page}{selectedSet.has(page) ? " ✓" : ""}</span>
                  </button>
                  <div class="actions" style={{ display: "flex", flexWrap: "wrap" }}>
                    <button type="button" aria-label={`Sposta pagina ${page} prima`} disabled={busy || position === 0}
                      onClick={() => updateOrder(adjacentPdfPageId(order, page, -1))}>↑</button>
                    <button type="button" aria-label={`Sposta pagina ${page} dopo`} disabled={busy || position === order.length - 1}
                      onClick={() => updateOrder(adjacentPdfPageId(order, page, 1))}>↓</button>
                  </div>
                </li>;
              })}
            </ol>
          </section>
          <fieldset class="field">
            <legend>Risultato da creare</legend>
            <label><input type="radio" name="workspace-mode-372" checked={mode === "reorder"} disabled={busy} onChange={() => { setMode("reorder"); setResult(null); setError(""); }} /> Riordina tutte le pagine</label>
            <label><input type="radio" name="workspace-mode-372" checked={mode === "selected"} disabled={busy} onChange={() => { setMode("selected"); setResult(null); setError(""); }} /> Estrai solo le selezionate nell'ordine corrente</label>
          </fieldset>
          <div class="actions">
            <button type="button" onClick={() => void save()} disabled={busy || mode === "selected" && !selected.length}>Crea PDF e verifica</button>
            {busy && <button type="button" onClick={() => { active.current?.abort(); setBusy(false); setError("Operazione annullata. Nessun file generato."); }}>Annulla elaborazione</button>}
            <button type="button" onClick={reset}>Ricomincia</button>
          </div>
          {busy && <p role="status">Generazione e riapertura PDF in Worker locale…</p>}
        </>}
      </section>
      {result && file && <PdfResultV2 toolId="pdf-page-reorder" result={result} sourceFiles={[file]}
        onReset={reset} onRetry={() => void save()} />}
    </section>
  );
}
