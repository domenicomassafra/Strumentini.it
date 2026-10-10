import { useEffect, useRef, useState } from "preact/hooks";
import type { PdfPptx255Result } from "../../../engines/pdf/pdf-to-pptx-255";

/**
 * Bounded PDF page-as-slide export in the existing PDF image tool route.
 * The browser receives neither user PDF nor rendered pages over the network.
 */
export function PdfToPptx255Tool() {
  const [hydrated, setHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState("");
  const [scale, setScale] = useState("1.5");
  const [status, setStatus] = useState("Scegli un PDF locale; massimo 8 pagine selezionate per presentazione.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PdfPptx255Result | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const urls = useRef<string[]>([]);

  function clearOutput() {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current = [];
    setDownloadUrl("");
    setPreviewUrl("");
    setResult(null);
  }

  function cancel() {
    generation.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    clearOutput();
    setBusy(false);
    setStatus("Conversione annullata: nessun PPTX incompleto disponibile.");
  }

  useEffect(() => {
    // Astro renders the initial island before Preact installs event handlers.
    // Do not let early interactions look successful while their events vanish.
    setHydrated(true);
    return () => {
      generation.current++;
      abortRef.current?.abort();
      for (const url of urls.current) URL.revokeObjectURL(url);
    };
  }, []);

  async function convert(event: Event) {
    event.preventDefault();
    if (!file || busy) return;
    clearOutput();
    const controller = new AbortController();
    const request = ++generation.current;
    abortRef.current = controller;
    setBusy(true);
    setStatus("Rendering delle pagine PDF e creazione PowerPoint in locale…");
    try {
      const { pdfToPptx255 } = await import("../../../engines/pdf/pdf-to-pptx-255");
      const output = await pdfToPptx255(file, { pages, scale: Number(scale) }, controller.signal);
      if (controller.signal.aborted || request !== generation.current) return;
      // Preview is decoded from the actual final OOXML package, not the source PDF.
      const { unzipSync } = await import("fflate");
      const archive = unzipSync(output.bytes);
      const image = archive["ppt/media/pdf-page-1.png"];
      if (!image) throw new Error("PDF_PPTX_255_VERIFY: Anteprima assente dal PowerPoint.");
      const pptxUrl = URL.createObjectURL(output.blob);
      const pngUrl = URL.createObjectURL(new Blob([image.slice().buffer as ArrayBuffer], { type: "image/png" }));
      if (controller.signal.aborted || request !== generation.current) {
        URL.revokeObjectURL(pptxUrl); URL.revokeObjectURL(pngUrl); return;
      }
      urls.current = [pptxUrl, pngUrl];
      setResult(output);
      setDownloadUrl(pptxUrl);
      setPreviewUrl(pngUrl);
      setStatus(`Pronto: ${output.slideCount} slide con immagini PNG verificate e inserite nel file PPTX.`);
    } catch (error) {
      if (!controller.signal.aborted && request === generation.current) {
        clearOutput();
        setStatus(error instanceof Error ? error.message : "Impossibile creare PowerPoint dalle pagine PDF.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (request === generation.current) setBusy(false);
    }
  }

  return <section class="tool-surface" data-pdf-pptx-255 data-pdf-pptx-255-hydrated={hydrated ? "true" : "false"} style={{ marginTop: "2rem" }}>
    <h2>PDF → PowerPoint (una pagina come immagine per slide)</h2>
    <p class="file-note"><strong>Conversione visiva pagina per slide, non ricostruzione modificabile.</strong>
      Ogni pagina selezionata diventa un'unica immagine PNG nella slide; testi, elementi e grafici PDF non diventano modificabili separatamente.
      La presentazione usa slide 4:3 con margini bianchi se la pagina ha proporzioni diverse. L'elaborazione è locale.</p>
    <form onSubmit={event => void convert(event)}>
      <label class="field"><span>PDF sorgente (massimo 8 MiB)</span>
        <input type="file" accept=".pdf,application/pdf" disabled={busy || !hydrated} onChange={event => {
          cancel();
          setFile(event.currentTarget.files?.[0] ?? null);
          setStatus("Seleziona massimo 8 pagine dal PDF, poi converti in PowerPoint.");
        }} /></label>
      <div class="field-grid">
        <label class="field"><span>Pagine PDF (max 8; vuoto = tutte se entro il limite)</span>
          <input type="text" value={pages} disabled={busy} placeholder="Es. 3,1,2 oppure 1-4"
            onInput={event => { setPages(event.currentTarget.value); clearOutput(); }} />
          <small>Le slide seguono esattamente l'ordine delle pagine selezionate.</small></label>
        <label class="field"><span>Risoluzione immagine</span>
          <select value={scale} disabled={busy} onChange={event => { setScale(event.currentTarget.value); clearOutput(); }}>
            <option value="1">72 DPI</option>
            <option value="1.5">108 DPI</option>
            <option value="2">144 DPI</option>
          </select></label>
      </div>
      <div class="actions">
        <button type="submit" class="primary" disabled={!file || busy || !hydrated}>{busy ? "Creo il PPTX..." : "Converti PDF in PPTX"}</button>
        <button type="button" disabled={!busy} onClick={cancel}>Annulla</button>
      </div>
    </form>
    <p role="status" aria-live="polite" data-pdf-pptx-255-status>{status}</p>
    {result && downloadUrl && <section aria-label="PowerPoint creato" data-pdf-pptx-255-result>
      <p><strong>{result.slideCount} slide</strong>, nell'ordine: {result.selectedPages.join(", ")}.</p>
      <p>Ogni immagine mantiene le proporzioni della pagina PDF. Slide: 10 × 7,5 pollici, formato 4:3.</p>
      <p>Dimensioni PNG (px): {result.slides.map(slide => `pag. ${slide.page}: ${slide.imageWidth}×${slide.imageHeight}`).join(" · ")}.</p>
      {previewUrl && <figure><img src={previewUrl} alt="Prima immagine riletta dal PPTX creato" data-pdf-pptx-255-preview
        style={{ display: "block", maxWidth: "min(100%, 420px)", border: "1px solid #788" }} />
        <figcaption>Prima slide: immagine riletta dal PowerPoint generato.</figcaption></figure>}
      <a href={downloadUrl} download={result.filename} data-pdf-pptx-255-download>Scarica PowerPoint PPTX</a>
    </section>}
  </section>;
}
