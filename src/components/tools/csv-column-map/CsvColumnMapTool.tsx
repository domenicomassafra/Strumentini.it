import { useEffect, useState } from "preact/hooks";
import { CSV_HARD_FILE_BYTES, readBlobText, type CsvColumnMapEntry } from "../../../engines/table/csv";
import { receiveHandoffFromOpener } from "../../../runtime/handoff";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { csvColumnMapManifest } from "../../../tools/csv-column-map/manifest";
import type { CsvColumnMapOutput } from "../../../tools/csv-column-map/types";

export function CsvColumnMapTool() {
  const [text, setText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapEntry[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [result, setResult] = useState<CsvColumnMapOutput | null>(null);
  const [error, setError] = useState("");

  function initialize(value: string, columns: readonly string[], source: string) {
    setText(value); setHeaders([...columns]); setMapping(columns.map((name, sourceIndex) => ({ sourceIndex, outputName: name || `column_${sourceIndex + 1}` }))); setSourceName(source); setResult(null); setError("");
  }

  useEffect(() => receiveHandoffFromOpener(csvColumnMapManifest, (envelope, proposal) => {
    initialize(envelope.payload, envelope.descriptor.columns, `Received from handoff · ${proposal.preview}`);
  }), []);

  async function loadFile(file: File | undefined) {
    if (file === undefined) return;
    try {
      const value = await readBlobText(file);
      const { parseCsvTable } = await import("../../../engines/table/csv");
      initialize(value, parseCsvTable(value).header, `${file.name} · ${(file.size / 1024).toFixed(1)} KiB`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read CSV file."); }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= mapping.length) return;
    const next = [...mapping];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setMapping(next); setResult(null);
  }

  async function apply(event: Event) {
    event.preventDefault(); setError(""); setResult(null);
    if (text === "") { setError("Choose a CSV file or receive a handoff first."); return; }
    const run = await toolRuntime.run(csvColumnMapManifest.id, { text, mapping });
    if (!run.ok) { setError(run.message); return; }
    setResult(run.value as CsvColumnMapOutput);
  }

  function download() {
    if (result === null) return;
    const url = URL.createObjectURL(new Blob([result.output], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "columns-mapped.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const selected = new Set(mapping.map((entry) => entry.sourceIndex));
  const dropped = headers.flatMap((name, index) => selected.has(index) ? [] : [{ index, name }]);

  return <form class="tool-operation" onSubmit={apply}>
    <section class="tool-form-card">
      <label class="field"><span>CSV file</span><input aria-label="CSV file" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => void loadFile(event.currentTarget.files?.[0])} /></label>
      {sourceName && <p class="file-note" role="status">{sourceName}</p>}
      <p class="file-note">Direct file limit: {Math.round(CSV_HARD_FILE_BYTES / 1024 / 1024)} MiB. Duplicate input names are disambiguated by source position.</p>
      {mapping.length > 0 && <div class="column-map-list" aria-label="Output column schema">{mapping.map((entry, index) => <div class="column-map-row" key={entry.sourceIndex}><span class="column-source">Source {entry.sourceIndex + 1}: {headers[entry.sourceIndex] || "(blank header)"}</span><label class="field compact-field"><span>Output name</span><input aria-label={`Output name for source column ${entry.sourceIndex + 1}`} value={entry.outputName} onInput={(event) => setMapping(mapping.map((item, itemIndex) => itemIndex === index ? { ...item, outputName: event.currentTarget.value } : item))} /></label><div class="column-actions"><button type="button" aria-label={`Move source column ${entry.sourceIndex + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Move source column ${entry.sourceIndex + 1} down`} disabled={index === mapping.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Drop source column ${entry.sourceIndex + 1}`} onClick={() => setMapping(mapping.filter((_, itemIndex) => itemIndex !== index))}>Drop</button></div></div>)}</div>}
      {dropped.length > 0 && <div><strong>Dropped before output</strong>{dropped.map((entry) => <p class="file-note" key={entry.index}>Column {entry.index + 1}: {entry.name || "(blank header)"} <button type="button" aria-label={`Add back source column ${entry.index + 1}`} onClick={() => setMapping([...mapping, { sourceIndex: entry.index, outputName: entry.name || `column_${entry.index + 1}` }])}>Add back</button></p>)}</div>}
      {mapping.length > 0 && <p class="schema-preview"><strong>Output schema:</strong> {mapping.map((entry) => entry.outputName || "(blank)").join(" → ")}</p>}
      {error && <p class="error" role="alert">{error}</p>}
      <button class="primary tool-submit" type="submit">Apply column map</button>
    </section>
    <section class="result-panel" aria-live="polite"><p class="eyebrow">Mapped result</p>{result ? <><strong>{result.headers.length} output columns · {result.droppedColumns.length} dropped · {result.filledMissingCells} missing selected cells filled blank</strong><pre class="csv-preview" tabIndex={0} aria-label="Mapped CSV preview">{result.output.split("\n").slice(0, 8).join("\n")}</pre><button type="button" onClick={download}>Download mapped CSV</button></> : <p class="result-placeholder">The output schema and mapped CSV appear here only after you apply the visible mapping.</p>}</section>
  </form>;
}
