import { useEffect, useState } from "preact/hooks";
import { CSV_HARD_FILE_BYTES, readBlobText } from "../../../engines/table/csv";
import { receiveHandoffFromOpener } from "../../../runtime/handoff";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { csvDedupeManifest } from "../../../tools/csv-dedupe/manifest";
import type { CsvDedupeOutput } from "../../../tools/csv-dedupe/types";

export function CsvDedupeTool() {
  const [text, setText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mode, setMode] = useState<"whole-row" | "key-columns">("whole-row");
  const [keyColumns, setKeyColumns] = useState<number[]>([]);
  const [result, setResult] = useState<CsvDedupeOutput | null>(null);
  const [error, setError] = useState("");

  useEffect(() => receiveHandoffFromOpener(csvDedupeManifest, (envelope, proposal) => {
    setText(envelope.payload);
    setHeaders([...envelope.descriptor.columns]);
    setSourceName(`Ricevuto da un altro strumento · ${proposal.preview}`);
    setResult(null);
    setError("");
  }), []);

  async function loadFile(file: File | undefined) {
    if (file === undefined) return;
    setError(""); setResult(null);
    try {
      const value = await readBlobText(file);
      const { parseCsvTable } = await import("../../../engines/table/csv");
      const table = parseCsvTable(value);
      setText(value); setHeaders(table.header); setSourceName(`${file.name} · ${(file.size / 1024).toFixed(1)} KiB`); setKeyColumns([]);
    } catch (caught) {
      setError("Impossibile leggere il file CSV.");
    }
  }

  async function dedupe(event: Event) {
    event.preventDefault(); setError(""); setResult(null);
    if (text === "") { setError("Scegli un file CSV oppure ricevi prima una tabella da un altro strumento."); return; }
    if (mode === "key-columns" && keyColumns.length === 0) { setError("Seleziona almeno una colonna chiave."); return; }
    const run = await toolRuntime.run(csvDedupeManifest.id, { text, mode, ...(mode === "key-columns" ? { keyColumns } : {}) });
    if (!run.ok) { setError("Impossibile rimuovere i duplicati. Controlla il file e le colonne selezionate."); return; }
    setResult(run.value as CsvDedupeOutput);
  }

  function download() {
    if (result === null) return;
    const url = URL.createObjectURL(new Blob([result.output], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "deduped.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const gutterState = gutterStateFromResult(result, error);
  return <form class="tool-operation" onSubmit={dedupe}>
    <section class="tool-form-card">
      <label class="field"><span>File CSV</span><input aria-label="File CSV" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => void loadFile(event.currentTarget.files?.[0])} /></label>
      {sourceName && <p class="file-note" role="status">{sourceName}</p>}
      <p class="file-note">Limite file diretto: {Math.round(CSV_HARD_FILE_BYTES / 1024 / 1024)} MiB. Limite passaggio tra strumenti: 10 MiB.</p>
      <fieldset><legend>Regola per i duplicati</legend><label class="choice-line"><input type="radio" name="dedupe-mode" checked={mode === "whole-row"} onChange={() => setMode("whole-row")} /> Riga intera: stessa sequenza esatta di celle</label><label class="choice-line"><input type="radio" name="dedupe-mode" checked={mode === "key-columns"} onChange={() => setMode("key-columns")} /> Colonne chiave: mantieni la prima riga per ogni chiave selezionata</label></fieldset>
      {mode === "key-columns" && <fieldset><legend>Colonne chiave</legend><p class="file-note">Le colonne sono identificate dalla posizione, quindi intestazioni duplicate restano distinguibili. Le righe con tutte le celle chiave vuote restano separate.</p>{headers.map((name, index) => <label class="choice-line" key={`${index}-${name}`}><input type="checkbox" checked={keyColumns.includes(index)} onChange={(event) => setKeyColumns(event.currentTarget.checked ? [...keyColumns, index].toSorted((a,b)=>a-b) : keyColumns.filter((value) => value !== index))} /> Colonna {index + 1}: {name || "(intestazione vuota)"}</label>)}</fieldset>}
      {error && <p class="error" role="alert">{error}</p>}
      <button class="primary tool-submit" type="submit">Rimuovi duplicati</button>
    </section>
    <section class="result-panel gutter" data-state={gutterState} aria-live="polite"><p class="gutter-label eyebrow">Risultato deduplicato</p>{result ? <><strong class="gutter-value">{result.removedRows} {result.removedRows === 1 ? "riga duplicata rimossa" : "righe duplicate rimosse"}</strong><dl class="gutter-rows"><div><dt>Righe dati rimanenti</dt><dd>{result.outputRows}</dd></div></dl><p class="file-note">Viene mantenuta la prima occorrenza. Le righe con tutte le chiavi vuote restano distinte.</p><pre class="csv-preview">{result.output.split("\n").slice(0, 8).join("\n")}</pre><button type="button" onClick={download}>Scarica CSV deduplicato</button></> : <p class="gutter-placeholder result-placeholder">Il risultato deduplicato e il numero esatto di righe rimosse appariranno qui.</p>}</section>
  </form>;
}

import { gutterStateFromResult } from "../shared/ToolGutter";
