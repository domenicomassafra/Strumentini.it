import { useEffect, useState } from "preact/hooks";
import { defaultPdfMergePagePlan, movePdfMergePage, validatePdfMergePagePlan, type PdfMergePageRef } from "../../../engines/pdf/merge-page-plan";
import { PdfThumbnailPicker } from "./PdfThumbnailPicker";

type SourceInfo = { file: File; pages?: number; error?: string };

export function PdfMergeOrganizer({ files, onChange, pagePlan, onPlanChange, disabled = false }: {
  readonly files: readonly File[];
  readonly onChange: (files: File[]) => void;
  readonly pagePlan: readonly PdfMergePageRef[] | null;
  readonly onPlanChange: (plan: readonly PdfMergePageRef[] | null) => void;
  readonly disabled?: boolean;
}) {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [chosen, setChosen] = useState<File | null>(null);
  const [history, setHistory] = useState<Array<readonly File[]>>([]);
  const [dragged, setDragged] = useState<File | null>(null);
  const [draggedPage, setDraggedPage] = useState<string | null>(null);
  const [pageHistory, setPageHistory] = useState<Array<readonly PdfMergePageRef[] | null>>([]);
  const [trackedFiles, setTrackedFiles] = useState<readonly File[]>(files);

  useEffect(() => {
    if (trackedFiles.length !== files.length || files.some((file) => !trackedFiles.includes(file))) {
      setPageHistory([]);
      setHistory([]);
      setChosen(null);
    }
    setTrackedFiles(files);
  }, [files]);

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
    // A file reorder changes the index namespace; invalidate undo snapshots
    // authored before the remap rather than restoring stale page identities.
    setPageHistory([]);
    if (pagePlan !== null) onPlanChange(pagePlan.map((ref) => ({
      ...ref,
      fileIndex: next.indexOf(files[ref.fileIndex]!),
    })));
    onChange(next);
  }

  const totals = files.map((file) => sources.find((entry) => entry.file === file));
  const pageCount = totals.every((entry) => entry?.pages !== undefined)
    ? totals.reduce((total, entry) => total + entry!.pages!, 0) : null;
  const counts = totals.map((entry) => entry?.pages ?? 0);
  const ready = pageCount !== null && pageCount > 0 && pageCount <= 200 && files.length >= 2;
  const plan = ready
    ? pagePlan === null ? defaultPdfMergePagePlan(counts) : validatePdfMergePagePlan(counts, pagePlan)
    : [];
  const key = (ref: PdfMergePageRef) => `${ref.fileIndex}:${ref.page}`;
  const name = (ref: PdfMergePageRef) => `File ${ref.fileIndex + 1}, pagina ${ref.page}`;
  function setPlan(next: readonly PdfMergePageRef[] | null) {
    if (disabled) return;
    setPageHistory((previous) => [...previous, pagePlan === null ? null : [...pagePlan]].slice(-20));
    onPlanChange(next);
  }
  function togglePage(fileIndex: number, page: number) {
    const current = plan.findIndex((ref) => ref.fileIndex === fileIndex && ref.page === page);
    if (current >= 0) {
      if (plan.length === 1) return;
      setPlan(plan.filter((_, index) => index !== current));
    } else {
      setPlan([...plan, { fileIndex, page }]);
    }
  }
  function shiftPage(source: PdfMergePageRef, target: PdfMergePageRef) {
    setPlan(movePdfMergePage(plan, key(source), key(target)));
  }
  function rotatePage(ref: PdfMergePageRef) {
    const nextRotation = ((ref.rotation ?? 0) + 90) % 360;
    setPlan(plan.map((current) => key(current) === key(ref)
      ? { ...current, rotation: nextRotation as 0 | 90 | 180 | 270 }
      : current));
  }
  const chosenIndex = chosen === null ? -1 : files.indexOf(chosen);

  return (
    <section aria-label="Organizzatore visuale PDF multipli" data-pdf-merge-organizer>
      <p class="file-note">Riordina documenti o personalizza le singole pagine provenienti da file diversi. Spostamenti, esclusioni e rotazioni si applicano solo alla copia esportata. Anteprime locali caricate su richiesta, quattro alla volta.</p>
      <div role="status" data-pdf-source-count>
        {files.length} PDF sorgente · {pageCount === null ? "Conteggio pagine in verifica" : `${pageCount} pagine totali`} · {files.reduce((total, file) => total + file.size, 0)} byte di ingresso
      </div>
      <button type="button" disabled={disabled || history.length === 0} onClick={() => {
        const last = history.at(-1);
        if (last !== undefined) {
          if (pagePlan !== null) onPlanChange(pagePlan.map((ref) => ({ ...ref, fileIndex: last.indexOf(files[ref.fileIndex]!) })));
          setHistory((prev) => prev.slice(0, -1));
          setPageHistory([]);
          onChange([...last]);
        }
      }}>Ripristina ordine file precedente</button>
      <ol class="status-list">
        {files.map((file, index) => {
          const source = sources.find((entry) => entry.file === file);
          return (
            <li key={file.name + ":" + file.size + ":" + file.lastModified + ":" + index} draggable={!disabled}
              onDragStart={(event) => { setDragged(file); event.dataTransfer?.setData("text/plain", file.name); }}
              onDragOver={(event) => event.preventDefault()}
              onDragEnd={() => setDragged(null)}
              onDrop={(event) => { event.preventDefault(); if (dragged !== null) move(dragged, file); setDragged(null); }}
            >
              <strong>File {index + 1}: {file.name}</strong>
              <p class="file-note">{file.size} byte · {source?.error ? `Non leggibile: ${source.error}` : source?.pages === undefined ? "Conteggio pagine in corso" : `${source.pages} pagine`}</p>
              <div class="actions">
                <button type="button" aria-label={`Sposta file ${index + 1} su`} disabled={disabled || index === 0} onClick={() => move(file, files[index - 1]!)}>Su</button>
                <button type="button" aria-label={`Sposta file ${index + 1} giù`} disabled={disabled || index === files.length - 1} onClick={() => move(file, files[index + 1]!)}>Giù</button>
                <button type="button" disabled={disabled} onClick={() => setChosen((current) => current === file ? null : file)}>{chosen === file ? "Chiudi anteprima file" : `Anteprima file ${index + 1}`}</button>
              </div>
            </li>
          );
        })}
      </ol>
      {ready && (
        <section data-merge-page-plan aria-label="Composizione delle pagine PDF">
          <p class="file-note" role="status">Pagine in uscita: {plan.length} su {pageCount} · escluse: {pageCount! - plan.length} · {pagePlan === null ? "ordine originale dei documenti" : "ordine personalizzato"}</p>
          <div class="actions">
            <button type="button" disabled={disabled || pagePlan !== null} onClick={() => setPlan(defaultPdfMergePagePlan(counts))}>Personalizza ordine pagine</button>
            <button type="button" disabled={disabled || pageHistory.length === 0} onClick={() => {
              const last = pageHistory.at(-1);
              if (last !== undefined) {
                setPageHistory((history) => history.slice(0, -1));
                onPlanChange(last);
              }
            }}>Ripristina modifica pagina</button>
            <button type="button" disabled={disabled || pagePlan === null} onClick={() => setPlan(null)}>Reimposta tutte le pagine</button>
          </div>
          {pagePlan !== null && (
            <ol class="status-list" data-merge-page-order>
              {plan.map((ref, index) => (
                <li key={key(ref)} data-source-page={key(ref)} draggable={!disabled}
                  onDragStart={(event) => { setDraggedPage(key(ref)); event.dataTransfer?.setData("text/plain", key(ref)); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnd={() => setDraggedPage(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedPage !== null && draggedPage !== key(ref)) setPlan(movePdfMergePage(plan, draggedPage, key(ref)));
                    setDraggedPage(null);
                  }}>
                  <strong>Posizione {index + 1} · {name(ref)} · +{ref.rotation ?? 0}°</strong>
                  <div class="actions">
                    <button type="button" aria-label={`Sposta ${name(ref)} su`} disabled={disabled || index === 0} onClick={() => shiftPage(ref, plan[index - 1]!)}>Su</button>
                    <button type="button" aria-label={`Sposta ${name(ref)} giù`} disabled={disabled || index === plan.length - 1} onClick={() => shiftPage(ref, plan[index + 1]!)}>Giù</button>
                    <button type="button" aria-label={`Ruota ${name(ref)}`} disabled={disabled} onClick={() => rotatePage(ref)}>Ruota 90°</button>
                    <button type="button" aria-label={`Escludi ${name(ref)}`} disabled={disabled || plan.length <= 1} onClick={() => togglePage(ref.fileIndex, ref.page)}>Escludi</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {chosen !== null && chosenIndex >= 0 && (
        <PdfThumbnailPicker key={chosen.name + ":" + chosen.size} file={chosen}
          selectedPages={plan.filter((ref) => ref.fileIndex === chosenIndex).map((ref) => ref.page)}
          pageRotations={Object.fromEntries(plan.filter((ref) => ref.fileIndex === chosenIndex)
            .map((ref) => [ref.page, ref.rotation ?? 0]))}
          {...(ready && pagePlan !== null && !disabled
            ? { onPickPage: (page: number) => togglePage(chosenIndex, page) }
            : {})}
        />
      )}
    </section>
  );
}
