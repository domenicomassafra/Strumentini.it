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
    setSourceName(`Received from handoff · ${proposal.preview}`);
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
      setError(caught instanceof Error ? caught.message : "Could not read CSV file.");
    }
  }

  async function dedupe(event: Event) {
    event.preventDefault(); setError(""); setResult(null);
    if (text === "") { setError("Choose a CSV file or receive a handoff first."); return; }
    if (mode === "key-columns" && keyColumns.length === 0) { setError("Select at least one key column."); return; }
    const run = await toolRuntime.run(csvDedupeManifest.id, { text, mode, ...(mode === "key-columns" ? { keyColumns } : {}) });
    if (!run.ok) { setError(run.message); return; }
    setResult(run.value as CsvDedupeOutput);
  }

  function download() {
    if (result === null) return;
    const url = URL.createObjectURL(new Blob([result.output], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "deduped.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <form class="tool-operation" onSubmit={dedupe}>
    <section class="tool-form-card">
      <label class="field"><span>CSV file</span><input aria-label="CSV file" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => void loadFile(event.currentTarget.files?.[0])} /></label>
      {sourceName && <p class="file-note" role="status">{sourceName}</p>}
      <p class="file-note">Direct file limit: {Math.round(CSV_HARD_FILE_BYTES / 1024 / 1024)} MiB. Typed handoff limit: 10 MiB.</p>
      <fieldset><legend>Dedupe rule</legend><label class="choice-line"><input type="radio" name="dedupe-mode" checked={mode === "whole-row"} onChange={() => setMode("whole-row")} /> Whole row — exact cell sequence</label><label class="choice-line"><input type="radio" name="dedupe-mode" checked={mode === "key-columns"} onChange={() => setMode("key-columns")} /> Key columns — keep first row per selected key</label></fieldset>
      {mode === "key-columns" && <fieldset><legend>Key columns</legend><p class="file-note">Columns are identified by position, so duplicate header names remain unambiguous. Rows whose selected key cells are all empty are kept distinct.</p>{headers.map((name, index) => <label class="choice-line" key={`${index}-${name}`}><input type="checkbox" checked={keyColumns.includes(index)} onChange={(event) => setKeyColumns(event.currentTarget.checked ? [...keyColumns, index].toSorted((a,b)=>a-b) : keyColumns.filter((value) => value !== index))} /> Column {index + 1}: {name || "(blank header)"}</label>)}</fieldset>}
      {error && <p class="error" role="alert">{error}</p>}
      <button class="primary tool-submit" type="submit">Remove duplicates</button>
    </section>
    <section class="result-panel" aria-live="polite"><p class="eyebrow">Deduped result</p>{result ? <><strong>{result.removedRows} duplicate row{result.removedRows === 1 ? "" : "s"} removed · {result.outputRows} data rows remain</strong><p class="file-note">Stable first occurrence wins. Empty all-key rows stay distinct.</p><pre class="csv-preview">{result.output.split("\n").slice(0, 8).join("\n")}</pre><button type="button" onClick={download}>Download deduped CSV</button></> : <p class="result-placeholder">The stable deduped output and exact removed-row count appear here.</p>}</section>
  </form>;
}
