import { useRef, useState } from "preact/hooks";
import { CSV_HARD_FILE_BYTES, CSV_SOFT_FILE_BYTES, CsvCleanerError, readBlobText } from "../../../engines/table/csv";
import { handoffCatalog } from "../../../generated/handoff-catalog";
import { compatibleHandoffTargets, openHandoffTarget } from "../../../runtime/handoff";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { CsvCleanerOutput } from "../../../tools/csv-cleaner/types";
import { CONTROL, it } from "../shared/controlLabels";

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
    if (!file) { setError("Scegli prima un file CSV."); return; }
    setError(""); setResult(null); setProgress(0); setProcessing(true); setHandoffDismissed(false); setHandoffStatus("");
    controller.current = new AbortController();
    try {
      const text = await readBlobText(file, controller.current.signal, setProgress);
      const run = await toolRuntime.run("csv-cleaner", { text }, {}, controller.current.signal);
      if (!run.ok) throw new Error(run.message);
      setResult(run.value as CsvCleanerOutput);
    } catch (caught) {
      if (caught instanceof CsvCleanerError && caught.code === "CANCELLED") setError("Pulizia annullata. Non è stato prodotto alcun risultato.");
      else setError("La pulizia del CSV non è riuscita. Controlla il file e riprova.");
    } finally { setProcessing(false); controller.current = null; }
  }

  function download() {
    if (!result || !file) return;
    const url = URL.createObjectURL(new Blob([result.output], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name.replace(/\.csv$/iu, "") + ".clean.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const handoffTargets = result === null ? [] : compatibleHandoffTargets(result.handoff, handoffCatalog);

  const gutterState = gutterStateFromResult(result, error, processing);
  return <div class="tool-operation">
    <section class="tool-form-card">
      <label class="field"><span>File CSV</span><input aria-label="File CSV" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); setResult(null); setError(""); setHandoffDismissed(false); setHandoffStatus(""); }} /></label>
      {file && <p class="file-note">{file.name} · {(file.size / 1024).toFixed(1)} KiB{file.size > CSV_SOFT_FILE_BYTES ? " · file grande" : ""}</p>}
      <p class="file-note">Dimensione consigliata: 10 MiB · limite massimo: {Math.round(CSV_HARD_FILE_BYTES / 1024 / 1024)} MiB.</p>
      {processing && <><progress max={1} value={progress} aria-label="Lettura del CSV in corso" /><button type="button" onClick={() => controller.current?.abort()}>{it(CONTROL.cancel)}</button></>}
      {error && <p role="alert" class="error">{error}</p>}
      <button class="primary tool-submit" type="button" disabled={processing} onClick={clean}>Pulisci CSV</button>
    </section>
    <section class="result-panel gutter" data-state={gutterState} aria-live="polite"><p class="gutter-label eyebrow">Anteprima e modifiche</p>{result ? <><strong class="gutter-value">{result.rows} {result.rows === 1 ? "riga" : "righe"}</strong><dl class="gutter-rows"><div><dt>Colonne</dt><dd>{result.columns}</dd></div><div><dt>Delimitatore</dt><dd>{result.delimiter === "\t" ? "TAB" : result.delimiter}</dd></div></dl><ul><li>BOM rimosso: {result.changes.strippedBom ? "sì" : "no"}</li><li>Interruzioni di riga normalizzate: {result.changes.normalizedRecordBreaks}</li><li>Avvisi: {result.warnings.length}</li></ul>{result.warnings.map((warning) => <p class="csv-warning" key={`${warning.code}-${warning.row ?? 0}`}>{warning.code}: avviso sulla riga {warning.row ?? "?"}</p>)}<pre class="csv-preview">{result.output.split("\n").slice(0, 8).join("\n")}</pre><button type="button" onClick={download}>Scarica CSV pulito</button>
      {!handoffDismissed && handoffTargets.length > 0 && <aside class="handoff-card" aria-label="Strumenti successivi compatibili"><strong>Passa questa tabella pulita direttamente a un altro strumento, senza scaricarla e ricaricarla.</strong><p>{handoffTargets[0]?.preview}</p><pre class="handoff-preview">{result.output.split("\n").slice(0, 4).join("\n")}</pre><p class="file-note">I dati vengono trasferiti una sola volta in memoria a una finestra dello stesso sito. Non vengono inseriti nell'URL, nei Recenti o nell'archiviazione locale.</p><div class="actions">{handoffTargets.map((proposal) => <button type="button" key={proposal.target.id} onClick={() => { const opened = openHandoffTarget(proposal, result.handoff, { sourceToolId: "csv-cleaner" }); setHandoffStatus(opened ? `Aperto ${proposal.target.name}; attendo che lo strumento riceva i dati.` : "Il browser ha bloccato la nuova finestra. Consenti i popup per questo passaggio esplicito e riprova."); }}>{`Passa a ${proposal.target.name}`}</button>)}<button type="button" onClick={() => { setHandoffDismissed(true); setHandoffStatus("Passaggio annullato. Il risultato pulito resta soltanto in questa pagina."); }}>Chiudi passaggio</button></div></aside>}
      {handoffStatus && <p role="status">{handoffStatus}</p>}</> : <p class="result-placeholder">Qui appariranno un'anteprima limitata e il riepilogo esatto delle modifiche.</p>}</section>
  </div>;
}

import { gutterStateFromResult } from "../shared/ToolGutter";
