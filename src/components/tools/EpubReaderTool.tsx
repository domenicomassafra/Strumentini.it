import { useState } from "preact/hooks";
import type { EpubBook422 } from "../../engines/epub/reader-422";
import { EPUB_LIMITS_422 } from "../../engines/epub/reader-422";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolOperation, ToolCancelButton, ToolResetButton, ToolResultPanel, ToolSubmitButton, gutterStateFor, useToolOperation } from "./shared";

export function EpubReaderTool() {
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("");
  const operation = useToolOperation<EpubBook422>(
    (signal) => toolRuntime.run("epub-reader", { file }, {}, signal),
    { formatError: (result) => result.message.startsWith("EPUB_") ? "EPUB non supportato o non sicuro (" + result.message + ")." : "Impossibile leggere questo EPUB in locale." },
  );
  function reset() {
    setFile(null);
    setSelected(0);
    setMessage("");
    operation.reset();
    const picker = document.getElementById("epub-reader-file") as HTMLInputElement | null;
    if (picker) picker.value = "";
  }
  const book = operation.result;
  const chosen = book?.chapters[selected];
  async function copyText() {
    if (!book) return;
    if (!navigator.clipboard) { setMessage("Appunti non disponibili."); return; }
    try {
      await navigator.clipboard.writeText(chosen?.text ?? book.allText);
      setMessage("Testo del capitolo copiato.");
    } catch { setMessage("Il browser ha bloccato gli appunti."); }
  }
  function downloadText() {
    if (!book) return;
    const url = URL.createObjectURL(new Blob([book.allText], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "epub-testo.txt";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
    setMessage("Testo completo esportato in TXT.");
  }
  return <ToolOperation busy={operation.isRunning}>
    <form onSubmit={(event) => { event.preventDefault(); setSelected(0); setMessage(""); void operation.run(); }} noValidate>
      <label class="field" for="epub-reader-file">
        <span>Libro EPUB3</span>
        <input id="epub-reader-file" type="file" accept=".epub,application/epub+zip" required disabled={operation.isRunning}
          onChange={(event) => { setFile(event.currentTarget.files?.item(0) ?? null); setSelected(0); setMessage(""); operation.reset(); }} />
        <small>{file ? file.name + " · " + file.size + " byte" : "File fino a " + (EPUB_LIMITS_422.maxFileBytes / 1048576) + " MiB · solo testo · nessuna rete"}</small>
      </label>
      <InlineError message={operation.error} />
      <ToolActions>
        <ToolSubmitButton busy={operation.isRunning}>Leggi EPUB</ToolSubmitButton>
        {operation.isRunning && <ToolCancelButton onCancel={operation.cancel} />}
        <ToolResetButton onClick={reset} disabled={operation.isRunning} />
      </ToolActions>
    </form>
    <ToolResultPanel eyebrow="EPUB3 offline" placeholder="I capitoli e il testo compariranno qui. Script, SVG e risorse remote sono rifiutati." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
      {book && <div data-result-class="file" data-epub-book>
        <h3>{book.title}</h3>
        <p>{book.chapters.length} capitoli · {book.source}</p>
        <label class="field" for="epub-reader-chapter"><span>Capitolo</span>
          <select id="epub-reader-chapter" value={String(selected)}
            onChange={(event) => { setSelected(Number(event.currentTarget.value)); setMessage(""); }}>
            {book.chapters.map((chapter, index) => <option key={chapter.id} value={String(index)}>{index + 1}. {chapter.title}</option>)}
          </select>
        </label>
        <article data-epub-text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          <h4>{chosen?.title}</h4>
          <p>{chosen?.text}</p>
        </article>
        <ToolActions>
          <button type="button" onClick={() => { void copyText(); }}>Copia capitolo</button>
          <button type="button" onClick={downloadText}>Esporta tutto in TXT</button>
        </ToolActions>
        <p class="file-note">Testo estratto dal file selezionato nel browser: non viene riprodotto HTML, CSS, SVG né contenuto attivo.</p>
        {message && <p role="status" aria-live="polite">{message}</p>}
      </div>}
    </ToolResultPanel>
  </ToolOperation>;
}
