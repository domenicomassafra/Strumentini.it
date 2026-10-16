import { useEffect, useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../workbench/completed-tool";
import type { PrintablePdfResult, PrintableSourceKind, PrintablePageSize, PrintableOrientation } from "../../engines/pdf/printable-document";

const ACCEPTED_EXTENSIONS: Readonly<Record<string, PrintableSourceKind>> = {
  txt: "txt", text: "txt", md: "markdown", markdown: "markdown",
  html: "html", htm: "html", csv: "csv",
};

export function PrintablePdfTool() {
  const [kind, setKind] = useState<PrintableSourceKind>("txt");
  const [source, setSource] = useState("");
  const [pageSize, setPageSize] = useState<PrintablePageSize>("a4");
  const [orientation, setOrientation] = useState<PrintableOrientation>("portrait");
  const [marginPt, setMarginPt] = useState("42");
  const [fontPt, setFontPt] = useState("10");
  const [pageNumbers, setPageNumbers] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<PrintablePdfResult | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const inFlight = useRef(false);
  // A stale File.arrayBuffer() resolution cannot replace a newer user edit.
  const uploadEpoch = useRef(0);

  useEffect(() => {
    if (result === null) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(result.blob);
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  useEffect(() => {
    if (previewBlob === null) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(previewBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewBlob]);

  function clearResult() { setResult(null); setPreviewBlob(null); setError(""); }

  async function upload(file: File | undefined) {
    const epoch = ++uploadEpoch.current;
    if (file === undefined) { setUploading(false); return; }
    clearResult();
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    const format = ACCEPTED_EXTENSIONS[extension];
    if (format === undefined || file.size > 512 * 1024) {
      setUploading(false);
      setError("Sono accettati file .txt, .md, .html e .csv fino a 512 KiB.");
      return;
    }
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (epoch !== uploadEpoch.current) return;
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\ufeff/u, "");
      setKind(format);
      setSource(decoded);
    } catch {
      if (epoch === uploadEpoch.current) setError("Il file deve contenere testo UTF-8 valido, senza caratteri sostituiti.");
    } finally {
      if (epoch === uploadEpoch.current) setUploading(false);
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (inFlight.current || uploading) return;
    ++uploadEpoch.current;
    inFlight.current = true;
    setError("");
    setResult(null);
    setPreviewBlob(null);
    setWorking(true);
    try {
      const [{ buildPrintablePdf }, { renderPdfPagesLocal }] = await Promise.all([
        import("../../engines/pdf/printable-document"),
        import("../../engines/pdf/render"),
      ]);
      const output = buildPrintablePdf({
        kind, source, pageSize, orientation, marginPt: Number(marginPt), fontPt: Number(fontPt), pageNumbers,
      });
      // Actual PDF.js render + PNG re-encode is required before download is enabled.
      const preview = await renderPdfPagesLocal(output.blob, { pages: [1], mime: "image/png", scale: 1 });
      if (preview.failures.length > 0 || preview.artifacts.length !== 1 || !preview.artifacts[0] || preview.artifacts[0].blob.size === 0) {
        throw new Error("PDF_RENDER_FAILED: Impossibile verificare la prima pagina con PDF.js");
      }
      setPreviewBlob(preview.artifacts[0]!.blob);
      setResult(output);
      recordCompletedTool("printable-pdf-from-text");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossibile creare il PDF.");
    } finally {
      setWorking(false);
      inFlight.current = false;
    }
  }

  function reset() {
    ++uploadEpoch.current;
    setUploading(false);
    clearResult();
    setSource("");
    setKind("txt");
    setPageSize("a4");
    setOrientation("portrait");
    setMarginPt("42");
    setFontPt("10");
    setPageNumbers(true);
  }

  return (
    <div class="printable-tool" data-printable-pdf="true">
      <form onSubmit={(event) => void submit(event)}>
        <section class="printable-card">
          <h2>Documento sorgente</h2>
          <label class="field"><span>Carica un file locale (max 512 KiB)</span>
            <input type="file" accept=".txt,.text,.md,.markdown,.html,.htm,.csv,text/plain,text/markdown,text/html,text/csv"
              onChange={(event) => void upload(event.currentTarget.files?.[0])} disabled={working} />
          </label>
          <label class="field"><span>Tipo del contenuto</span>
            <select aria-label="Tipo del contenuto" value={kind} onChange={(event) => { ++uploadEpoch.current; setUploading(false); setKind(event.currentTarget.value as PrintableSourceKind); clearResult(); }} disabled={working}>
              <option value="txt">TXT — righe e paragrafi</option>
              <option value="markdown">Markdown — struttura in testo stampabile</option>
              <option value="html">HTML — testo passivo, senza script o risorse esterne</option>
              <option value="csv">CSV — tabella con intestazione ripetuta</option>
            </select>
          </label>
          <label class="field"><span>Contenuto</span>
            <textarea aria-label="Contenuto" rows={11} value={source}
              onInput={(event) => { ++uploadEpoch.current; setUploading(false); setSource(event.currentTarget.value); clearResult(); }}
              placeholder="Incolla testo, Markdown, HTML o CSV..." disabled={working} />
          </label>
        </section>
        <section class="printable-card">
          <h2>Impostazioni di stampa</h2>
          <div class="printable-fields">
            <label class="field"><span>Formato pagina</span>
              <select aria-label="Formato pagina" value={pageSize} onChange={(event) => { setPageSize(event.currentTarget.value as PrintablePageSize); clearResult(); }} disabled={working}>
                <option value="a4">A4</option><option value="letter">US Letter</option>
              </select>
            </label>
            <label class="field"><span>Orientamento</span>
              <select aria-label="Orientamento" value={orientation} onChange={(event) => { setOrientation(event.currentTarget.value as PrintableOrientation); clearResult(); }} disabled={working}>
                <option value="portrait">Verticale</option><option value="landscape">Orizzontale</option>
              </select>
            </label>
            <label class="field"><span>Margini (punti, 24–90)</span>
              <input type="number" aria-label="Margini (punti)" min="24" max="90" step="1" value={marginPt}
                onInput={(event) => { setMarginPt(event.currentTarget.value); clearResult(); }} disabled={working} />
            </label>
            <label class="field"><span>Dimensione Courier (8–14 pt)</span>
              <input type="number" aria-label="Dimensione font" min="8" max="14" step="1" value={fontPt}
                onInput={(event) => { setFontPt(event.currentTarget.value); clearResult(); }} disabled={working} />
            </label>
          </div>
          <label class="printable-check"><input type="checkbox" checked={pageNumbers}
            onChange={(event) => { setPageNumbers(event.currentTarget.checked); clearResult(); }} disabled={working} /> Numera le pagine</label>
          <p class="printable-note">Font Courier con codifica WinAnsi: accenti italiani supportati. Emoji, CJK e simboli non rappresentabili vengono rifiutati esplicitamente. HTML viene analizzato come testo inerte; CSS e immagini non vengono scaricati.</p>
          <div class="printable-actions">
            <button type="submit" class="btn btn-primary" disabled={working || uploading}>{working ? "Verifica PDF..." : uploading ? "Caricamento file..." : "Genera e verifica PDF"}</button>
            <button type="button" class="btn" onClick={reset} disabled={working}>Azzera</button>
          </div>
        </section>
      </form>
      {error && <p class="printable-error" role="alert">{error}</p>}
      {result !== null && downloadUrl && previewUrl && (
        <section class="printable-card" data-printable-result="success" aria-label="PDF verificato">
          <h2>PDF verificato</h2>
          <p>Il file è stato ricostruito, riletto e la prima pagina renderizzata con PDF.js nel browser.</p>
          <dl class="printable-metrics">
            <div><dt>Pagine</dt><dd>{result.pageCount}</dd></div>
            <div><dt>Dimensioni pagina</dt><dd>{result.widthPt} × {result.heightPt} pt</dd></div>
            <div><dt>Righe stampate</dt><dd>{result.renderedLines}</dd></div>
            <div><dt>Righe CSV</dt><dd>{result.tableRows}</dd></div>
            <div><dt>Dimensione PDF</dt><dd>{result.bytes.length} byte</dd></div>
          </dl>
          <a class="btn btn-primary" href={downloadUrl} download={result.filename}>Scarica documento-stampabile.pdf</a>
          <figure class="printable-preview"><img src={previewUrl} alt="Prima pagina del PDF renderizzata localmente" /><figcaption>Prima pagina — rendering PDF.js locale</figcaption></figure>
          <p class="printable-note">{result.fontPolicy}</p>
          {result.warnings.length > 0 && <div><h3>Limiti e avvisi</h3><ul>{result.warnings.map((warning) => <li>{warning}</li>)}</ul></div>}
        </section>
      )}
    </div>
  );
}
