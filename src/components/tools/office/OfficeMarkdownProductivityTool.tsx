import { useEffect, useRef, useState } from "preact/hooks";

type Operation = "markdown-to-docx" | "docx-to-markdown";
type CompletedFile = { readonly filename: string; readonly mime: string; readonly bytes: Uint8Array; readonly preview: string; readonly warnings: readonly string[] };

const MARKDOWN_LIMIT_BYTES = 2 * 1024 * 1024;
const DOCX_LIMIT_BYTES = 20 * 1024 * 1024;

function outputName(input: string, extension: "docx" | "md"): string {
  const stem = input.replace(/\.[^.]+$/u, "").normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^[.-]+|[.-]+$/gu, "").slice(0, 80) || "documento";
  return `${stem}.${extension}`;
}

export function OfficeMarkdownProductivityTool() {
  const [operation, setOperation] = useState<Operation>("markdown-to-docx");
  const [file, setFile] = useState<File | null>(null);
  const [fileSelectionEpoch, setFileSelectionEpoch] = useState(0);
  const [source, setSource] = useState("# Appunti\n\nDocumento con **testo evidenziato**.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<CompletedFile | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);

  useEffect(() => {
    if (completed === null) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(new Blob([completed.bytes.slice().buffer as ArrayBuffer], { type: completed.mime }));
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [completed]);

  function clearResult() {
    epoch.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setError("");
    setCompleted(null);
  }

  async function convert(event: Event) {
    event.preventDefault();
    const current = ++epoch.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setCompleted(null);
    try {
      if (operation === "markdown-to-docx") {
        const extension = file?.name.split(".").pop()?.toLowerCase();
        if (file !== null && !["md", "markdown", "txt"].includes(extension ?? "")) throw new Error("Seleziona un file Markdown (.md, .markdown) oppure TXT.");
        if (file !== null && (file.size === 0 || file.size > MARKDOWN_LIMIT_BYTES)) throw new Error("File vuoto o oltre 2 MiB.");
        const markdown = file === null ? source : new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()).replace(/^\ufeff/u, "");
        if (abort.signal.aborted || current !== epoch.current) return;
        if (!markdown.trim()) throw new Error("Scrivi o carica il contenuto Markdown.");
        const { runOfficeLocalJob } = await import("../../../engines/office-local/client");
        const response = await runOfficeLocalJob({ kind: "docx-generate", text: markdown, sourceFormat: "markdown" }, { signal: abort.signal });
        if (abort.signal.aborted || current !== epoch.current) return;
        if (response.kind !== "docx-generate" || response.result.verification.reopened !== true) throw new Error("DOCX non verificato.");
        setCompleted({
          filename: outputName(file?.name ?? "appunti", "docx"),
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bytes: new Uint8Array(response.result.bytes),
          preview: response.result.reopened.markdown,
          warnings: response.result.unsupportedConstructs,
        });
      } else {
        if (file === null || !/\.docx$/iu.test(file.name)) throw new Error("Seleziona un documento .docx.");
        if (file.size === 0 || file.size > DOCX_LIMIT_BYTES) throw new Error("Documento vuoto o oltre 20 MiB.");
        const bytes = await file.arrayBuffer();
        if (abort.signal.aborted || current !== epoch.current) return;
        const { runOfficeLocalJob } = await import("../../../engines/office-local/client");
        const response = await runOfficeLocalJob({ kind: "docx-extract", bytes }, { signal: abort.signal });
        if (abort.signal.aborted || current !== epoch.current) return;
        if (response.kind !== "docx-extract") throw new Error("Estrazione Markdown non verificata.");
        setCompleted({
          filename: outputName(file.name, "md"),
          mime: "text/markdown;charset=utf-8",
          bytes: new TextEncoder().encode(response.result.markdown),
          preview: response.result.markdown,
          warnings: response.result.unsupportedConstructs,
        });
      }
    } catch (cause) {
      if (!abort.signal.aborted && current === epoch.current) setError(cause instanceof Error ? cause.message : "Conversione non riuscita.");
    } finally {
      if (current === epoch.current) { setBusy(false); controller.current = null; }
    }
  }

  const toDocx = operation === "markdown-to-docx";
  return (
    <section data-office-markdown-workspace class="office-markdown-workspace">
      <form onSubmit={(event) => void convert(event)}>
        <label class="field"><span>Operazione</span>
          <select data-office-operation value={operation} onChange={(event) => { clearResult(); setFile(null); setOperation(event.currentTarget.value as Operation); }} disabled={busy}>
            <option value="markdown-to-docx">Markdown → DOCX modificabile</option>
            <option value="docx-to-markdown">DOCX → Markdown (.md)</option>
          </select>
        </label>
        <label class="field"><span>{toDocx ? "Carica .md o .txt (facoltativo, max 2 MiB)" : "Apri DOCX locale (max 20 MiB)"}</span>
          <input key={`${operation}-${fileSelectionEpoch}`} data-office-source type="file" accept={toDocx ? ".md,.markdown,.txt,text/markdown,text/plain" : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"} onChange={(event) => { clearResult(); setFile(event.currentTarget.files?.[0] ?? null); }} disabled={busy} />
        </label>
        {toDocx && <label class="field"><span>Oppure scrivi Markdown</span>
          <textarea data-office-text rows={9} value={source} onInput={(event) => { clearResult(); setSource(event.currentTarget.value); }} disabled={busy || file !== null} />
          <small>Il file selezionato ha precedenza sul testo. Il DOCX mantiene titoli, elenchi, tabelle e link nel sottoinsieme supportato.</small>
        </label>}
        <div class="actions">
          <button data-office-submit type="submit" disabled={busy}>{busy ? "Conversione in corso…" : toDocx ? "Crea DOCX" : "Estrai Markdown"}</button>
          {busy && <button type="button" onClick={clearResult}>Annulla</button>}
          {!busy && <button type="button" onClick={() => { clearResult(); setFile(null); setFileSelectionEpoch((value) => value + 1); setSource(""); setOperation("markdown-to-docx"); }}>Azzera</button>}
        </div>
      </form>
      {error !== "" && <p role="alert" data-office-error>{error}</p>}
      {completed !== null && downloadUrl !== "" && <section data-office-result>
        <h2>Documento pronto</h2>
        <p>{completed.filename} · {completed.bytes.length} byte · risultato creato localmente nel browser.</p>
        <a data-office-download class="btn btn-primary" href={downloadUrl} download={completed.filename}>Scarica {completed.filename}</a>
        <h3>Anteprima del contenuto</h3>
        <pre tabIndex={0}>{completed.preview.slice(0, 5000)}</pre>
        {completed.preview.length > 5000 && <small>Anteprima limitata ai primi 5.000 caratteri; il download è completo.</small>}
        {completed.warnings.length > 0 && <><h3>Funzioni non riprodotte</h3><ul>{completed.warnings.map((warning) => <li>{warning}</li>)}</ul></>}
      </section>}
      <p class="file-note">Conversione semantica: non conserva l'impaginazione Word, macro, immagini incorporate o layout avanzati. File elaborati localmente. Per un <a href="/tools/printable-pdf-from-text/">PDF stampabile da DOCX semplice o Markdown</a>, usa lo strumento dedicato.</p>
    </section>
  );
}
