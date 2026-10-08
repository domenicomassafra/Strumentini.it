import { useEffect, useState } from "preact/hooks";
import { openPdfThumbnailSession, PDF_THUMBNAIL_WINDOW, pdfThumbnailWindow, type PdfThumbnailSession } from "../../../engines/pdf/thumbnails";

type Thumbnail = { page: number; state: "loading" | "ready" | "error"; url?: string; message?: string };

export interface PdfThumbnailPickerProps {
  readonly file: File;
  readonly selectedPages: readonly number[];
  readonly onPickPage?: (page: number) => void;
  readonly previewRotation?: 0 | 90 | 180 | 270;
}

export function PdfThumbnailPicker({ file, selectedPages, onPickPage, previewRotation = 0 }: PdfThumbnailPickerProps) {
  const [session, setSession] = useState<PdfThumbnailSession | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [start, setStart] = useState(1);
  const [error, setError] = useState("");
  const [images, setImages] = useState<Thumbnail[]>([]);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    let opened: PdfThumbnailSession | undefined;
    setSession(null);
    setPageCount(0);
    setStart(1);
    setImages([]);
    setError("");
    void openPdfThumbnailSession(file, controller.signal).then((value) => {
      opened = value;
      if (disposed) { void value.close(); return; }
      setSession(value);
      setPageCount(value.pageCount);
    }, (reason) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : "Impossibile leggere il PDF selezionato");
    });
    return () => {
      disposed = true;
      controller.abort();
      if (opened !== undefined) void opened.close();
    };
  }, [file]);

  useEffect(() => {
    if (session === null || pageCount < 1) return;
    const controller = new AbortController();
    const urls: string[] = [];
    const pageNumbers = pdfThumbnailWindow(pageCount, start);
    setImages(pageNumbers.map((page) => ({ page, state: "loading" })));
    void (async () => {
      for (const page of pageNumbers) {
        if (controller.signal.aborted) return;
        try {
          const blob = await session.renderPage(page, selectedPages.includes(page) ? previewRotation : 0, controller.signal);
          if (controller.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setImages((current) => current.map((entry) => entry.page === page ? { page, state: "ready", url } : entry));
        } catch (reason) {
          if (controller.signal.aborted) return;
          setImages((current) => current.map((entry) => entry.page === page ? {
            page, state: "error", message: reason instanceof Error ? reason.message : "Anteprima non disponibile",
          } : entry));
        }
      }
    })();
    return () => {
      controller.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [session, pageCount, start, previewRotation, selectedPages.join(",")]);

  return (
    <section aria-label="Anteprime PDF a caricamento limitato" data-pdf-thumbnails data-window-size={PDF_THUMBNAIL_WINDOW}>
      <p class="file-note">Anteprima locale facoltativa. Soltanto {PDF_THUMBNAIL_WINDOW} pagine per volta, senza caricare tutte le pagine in memoria. La modifica effettiva del PDF avviene soltanto quando premi il pulsante principale.</p>
      {error !== "" ? <p role="alert">Anteprima non disponibile: {error}</p> : null}
      {pageCount === 0 && error === "" ? <p role="status">Lettura indice pagine locale…</p> : null}
      {pageCount > 0 && (
        <>
          <div class="actions" aria-label="Navigazione delle miniature PDF">
            <button type="button" onClick={() => setStart((prev) => Math.max(1, prev - PDF_THUMBNAIL_WINDOW))} disabled={start === 1}>Precedenti</button>
            <label>Inizia dalla pagina <input aria-label="Inizia dalla pagina" type="number" min="1" max={pageCount} value={start} onInput={(event) => {
              const value = Number(event.currentTarget.value);
              if (Number.isInteger(value) && value >= 1 && value <= pageCount) setStart(value);
            }} /></label>
            <button type="button" onClick={() => setStart((prev) => Math.min(pageCount, prev + PDF_THUMBNAIL_WINDOW))} disabled={start + PDF_THUMBNAIL_WINDOW > pageCount}>Successive</button>
            <span role="status">Pagine {start}–{Math.min(pageCount, start + PDF_THUMBNAIL_WINDOW - 1)} di {pageCount}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 132px), 1fr))", gap: "0.75rem" }}>
            {images.map((thumb) => (
              <div key={thumb.page} data-pdf-page={thumb.page} data-thumb-state={thumb.state}>
                <button type="button" disabled={onPickPage === undefined} aria-pressed={selectedPages.includes(thumb.page)} onClick={() => onPickPage?.(thumb.page)} aria-label={onPickPage === undefined ? `Anteprima pagina ${thumb.page}` : `Seleziona pagina ${thumb.page}`}>
                  {thumb.state === "ready" && thumb.url ? <img src={thumb.url} alt={`Anteprima pagina ${thumb.page}`} style={{ width: "100%", maxHeight: "208px", objectFit: "contain" }} /> : null}
                  {thumb.state === "loading" ? <span>Caricamento…</span> : null}
                  {thumb.state === "error" ? <span>Anteprima non disponibile: {thumb.message}</span> : null}
                  <span>Pagina {thumb.page}{selectedPages.includes(thumb.page) ? " · selezionata" : ""}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
