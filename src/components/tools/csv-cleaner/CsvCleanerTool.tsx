import { useRef, useState } from "preact/hooks";
import { CSV_HARD_FILE_BYTES, CSV_SOFT_FILE_BYTES, CsvCleanerError, readBlobText } from "../../../engines/table/csv";
import { catalog } from "../../../generated/catalog";
import { compatibleHandoffTargets, openHandoffTarget } from "../../../runtime/handoff";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { CsvCleanerOutput } from "../../../tools/csv-cleaner/types";

export function CsvCleanerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvCleanerOutput | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState("");
  const controller = useRef<AbortController | null>(null);

  async function clean() {
    if (!file) { setError("Choose a CSV file first."); return; }
    setError(""); setResult(null); setProgress(0); setProcessing(true); setHandoffDismissed(false); setHandoffStatus("");
    controller.current = new AbortController();
    try {
      const text = await readBlobText(file, controller.current.signal, setProgress);
      const run = await toolRuntime.run("csv-cleaner", { text }, {}, controller.current.signal);
      if (!run.ok) throw new Error(run.message);
      setResult(run.value as CsvCleanerOutput);
    } catch (caught) {
      if (caught instanceof CsvCleanerError && caught.code === "CANCELLED") setError("Cleaning cancelled. No output was produced.");
      else setError(caught instanceof Error ? caught.message : "CSV cleaning failed.");
    } finally { setProcessing(false); controller.current = null; }
  }

  function download() {
    if (!result || !file) return;
    const url = URL.createObjectURL(new Blob([result.output], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name.replace(/\.csv$/iu, "") + ".clean.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const handoffTargets = result === null ? [] : compatibleHandoffTargets(result.handoff, catalog);

  return <div class="tool-operation">
    <section class="tool-form-card">
      <label class="field"><span>CSV file</span><input aria-label="CSV file" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); setResult(null); setError(""); setHandoffDismissed(false); setHandoffStatus(""); }} /></label>
      {file && <p class="file-note">{file.name} · {(file.size / 1024).toFixed(1)} KiB{file.size > CSV_SOFT_FILE_BYTES ? " · large file" : ""}</p>}
      <p class="file-note">Soft guidance: 10 MiB · hard limit: {Math.round(CSV_HARD_FILE_BYTES / 1024 / 1024)} MiB.</p>
      {processing && <><progress max={1} value={progress} aria-label="CSV read progress" /><button type="button" onClick={() => controller.current?.abort()}>Cancel</button></>}
      {error && <p role="alert" class="error">{error}</p>}
      <button class="primary tool-submit" type="button" disabled={processing} onClick={clean}>Clean CSV</button>
    </section>
    <section class="result-panel" aria-live="polite"><p class="eyebrow">Preview &amp; changes</p>{result ? <><strong>{result.rows} rows · {result.columns} columns · delimiter {result.delimiter === "\t" ? "TAB" : result.delimiter}</strong><ul><li>BOM removed: {result.changes.strippedBom ? "yes" : "no"}</li><li>Record line endings normalized: {result.changes.normalizedRecordBreaks}</li><li>Warnings: {result.warnings.length}</li></ul>{result.warnings.map((warning) => <p class="csv-warning" key={`${warning.code}-${warning.row ?? 0}`}>{warning.code}: {warning.message}</p>)}<pre class="csv-preview">{result.output.split("\n").slice(0, 8).join("\n")}</pre><button type="button" onClick={download}>Download cleaned CSV</button>
      {!handoffDismissed && handoffTargets.length > 0 && <aside class="handoff-card" aria-label="Compatible next tools"><p class="eyebrow">Next tool</p><strong>Pass this cleaned table without downloading and re-uploading.</strong><p>{handoffTargets[0]?.preview}</p><pre class="handoff-preview">{result.output.split("\n").slice(0, 4).join("\n")}</pre><p class="file-note">The payload is transferred one time in memory to a same-origin tool window. It is not placed in the URL, Recent, or local storage.</p><div class="actions">{handoffTargets.map((proposal) => <button type="button" key={proposal.target.id} onClick={() => { const opened = openHandoffTarget(proposal, result.handoff); setHandoffStatus(opened ? `Opened ${proposal.target.name}; waiting for the target to receive this payload.` : "The browser blocked the new tool window. Allow pop-ups for this explicit handoff and try again."); }}>{`Pass to ${proposal.target.name}`}</button>)}<button type="button" onClick={() => { setHandoffDismissed(true); setHandoffStatus("Handoff dismissed. The cleaned result remains on this page only."); }}>Dismiss handoff</button></div></aside>}
      {handoffStatus && <p role="status">{handoffStatus}</p>}</> : <p class="result-placeholder">A bounded preview and exact change summary appear here.</p>}</section>
  </div>;
}
