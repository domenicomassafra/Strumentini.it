import { useEffect, useState } from "preact/hooks";
import { PdfThumbnailPicker } from "./PdfThumbnailPicker";

type SourceInfo = { file: File; pages?: number; error?: string };

export function PdfMergeOrganizer({ files, onChange }: {
  readonly files: readonly File[];
  readonly onChange: (files: File[]) => void;
}) {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [chosen, setChosen] = useState<File | null>(null);
  const [history, setHistory] = useState<Array<readonly File[]>>([]);
  const [dragged, setDragged] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    const known = new Map(sources.map((source) => [source.file, source]));
    setSources(files.map((file) => known.get(file) ?? { file }));
    void (async () => {
      const { inspectPdfBytes, PDF_LIMITS } = await import("../../../engines/pdf");
      for (const file of files) {
        if (cancelled) return;
        let info: SourceInfo;
        try {
          if (file.size < 5 || file.size > PDF_LIMITS.maxBytes) throw new Error("Il PDF supera i limiti locali");
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (cancelled) return;
          const inspection = inspectPdfBytes(bytes);
          if (inspection.encrypted || inspection.pageCount < 1) throw new Error("PDF cifrato o senza pagine modificabili");
          info = { file, pages: inspection.pageCount };
        } catch (reason) {
          info = { file, error: reason instanceof Error ? reason.message : "Sorgente non leggibile" };
        }
        if (!cancelled) setSources((current) => current.map((entry) => entry.file === file ? info : entry));
      }
    })();
    return () => { cancelled = true; };
  }, [files]);

  function move(source: File, target: File) {
    const from = files.indexOf(source);
    const to = files.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...files];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setHistory((prev) => [...prev, [...files]].slice(-20));
    onChange(next);
  }

  const totals = files.map((file) => sources.find((entry) => entry.file === file));
  const pageCount = totals.every((entry) => entry?.pages !== undefined)
    ? totals.reduce((total, entry) => total + entry!.pages!, 0) : null;

  return (
    <section aria-label="Organizzatore visuale PDF multipli" data-pdf-merge-organizer>
      <p class="file-note">L'ordine dei documenti qui sotto è l'ordine usato per l'unione. Usa i pulsanti o trascina; puoi annullare l'ultima modifica. Le miniature servono a riconoscere le pagine del singolo file, non modificano il PDF prima dell'unione.</p>
      <div role="status" data-pdf-source-count>
        {files.length} PDF sorgente · {pageCount === null ? "Conteggio pagine in verifica" : `${pageCount} pagine totali`} · {files.reduce((total, file) => total + file.size, 0)} byte di ingresso
      </div>
      <button type="button" onClick={() => {
        const last = history.at(-1);
        if (last !== undefined) { setHistory((prev) => prev.slice(0, -1)); onChange([...last]); }
      }} disabled={history.length === 0}>Ripristina ordine file precedente</button>
      <ol class="status-list">
        {files.map((file, index) => {
          const source = sources.find((entry) => entry.file === file);
          return (
            <li key={file.name + ":" + file.size + ":" + file.lastModified + ":" + index} draggable
              onDragStart={(event) => { setDragged(file); event.dataTransfer?.setData("text/plain", file.name); }}
              onDragOver={(event) => event.preventDefault()}
              onDragEnd={() => setDragged(null)}
              onDrop={(event) => { event.preventDefault(); if (dragged !== null) move(dragged, file); setDragged(null); }}
            >
              <strong>File {index + 1}: {file.name}</strong>
              <p class="file-note">{file.size} byte · {source?.error ? `Non leggibile: ${source.error}` : source?.pages === undefined ? "Conteggio pagine in corso" : `${source.pages} pagine`}</p>
              <div class="actions">
                <button type="button" aria-label={`Sposta file ${index + 1} su`} disabled={index === 0} onClick={() => move(file, files[index - 1]!)}>Su</button>
                <button type="button" aria-label={`Sposta file ${index + 1} giù`} disabled={index === files.length - 1} onClick={() => move(file, files[index + 1]!)}>Giù</button>
                <button type="button" onClick={() => setChosen((current) => current === file ? null : file)}>{chosen === file ? "Chiudi anteprima file" : `Anteprima file ${index + 1}`}</button>
              </div>
            </li>
          );
        })}
      </ol>
      {chosen !== null && files.includes(chosen) && <PdfThumbnailPicker key={chosen.name + ":" + chosen.size} file={chosen} selectedPages={[]} />}
    </section>
  );
}
