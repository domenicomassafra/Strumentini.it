import { useRef, useState } from "preact/hooks";
import { CSV_HARD_FILE_BYTES, CSV_SOFT_FILE_BYTES, CsvCleanerError, readBlobText } from "../../../engines/table/csv";
import { handoffCatalog } from "../../../generated/handoff-catalog";
import { compatibleHandoffTargets, openHandoffTarget } from "../../../runtime/handoff";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { csvCleanerManifest } from "../../../tools/csv-cleaner/manifest";
import type { CsvCleanerOutput } from "../../../tools/csv-cleaner/types";
import { CsvTableResultV2 } from "../csv-shared/CsvTableResultV2";
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
  const fileInput = useRef<HTMLInputElement | null>(null);

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

  function reset() {
    controller.current?.abort();
    setFile(null);
    setResult(null);
    setError("");
    setProgress(0);
    setProcessing(false);
    setHandoffDismissed(false);
    setHandoffStatus("");
    if (fileInput.current !== null) fileInput.current.value = "";
  }

  const handoffTargets = result === null ? [] : compatibleHandoffTargets(result.handoff, handoffCatalog);

  const gutterState = gutterStateFromResult(result, error, processing);
  return <div class="tool-operation">
    <section class="tool-form-card">
      <label class="field"><span>File CSV</span><input ref={fileInput} aria-label="File CSV" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); setResult(null); setError(""); setHandoffDismissed(false); setHandoffStatus(""); }} /></label>
      {file && <p class="file-note">{file.name} · {(file.size / 1024).toFixed(1)} KiB{file.size > CSV_SOFT_FILE_BYTES ? " · file grande" : ""}</p>}
      <p class="file-note">Dimensione consigliata: 10 MiB · limite massimo: {Math.round(CSV_HARD_FILE_BYTES / 1024 / 1024)} MiB.</p>
      {processing && <><progress max={1} value={progress} aria-label="Lettura del CSV in corso" /><button type="button" onClick={() => controller.current?.abort()}>{it(CONTROL.cancel)}</button></>}
      {error && <p role="alert" class="error">{error}</p>}
      <button class="primary tool-submit" type="button" disabled={processing} onClick={clean}>Pulisci CSV</button>
    </section>
    <CsvTableResultV2
      eyebrow="Anteprima e modifiche"
      placeholder="Qui appariranno un'anteprima limitata e il riepilogo esatto delle modifiche."
      state={gutterState}
      output={result?.output ?? null}
      filename={file === null ? "cleaned.csv" : file.name.replace(/\.csv$/iu, "") + ".clean.csv"}
      declaration={csvCleanerManifest.result}
      summaryLabel="Righe dati"
      summaryValue={result === null ? "" : String(result.rows) + " " + (result.rows === 1 ? "riga" : "righe")}
      metrics={result === null ? [] : [
        { label: "Colonne", value: result.columns },
        { label: "Delimitatore", value: result.delimiter === "\t" ? "TAB" : result.delimiter },
        { label: "BOM rimosso", value: result.changes.strippedBom ? "sì" : "no" },
        { label: "Interruzioni di riga normalizzate", value: result.changes.normalizedRecordBreaks },
        { label: "Righe dati modificate", value: result.affectedRows },
        { label: "Celle modificate", value: result.affectedCells },
      ]}
      warnings={result?.warnings}
      provenance="Pulizia eseguita localmente; l'anteprima è limitata, il download usa il CSV completo."
      handoffTargetCount={handoffTargets.length}
      onHandoff={handoffTargets[0] === undefined || result === null ? undefined : () => {
        const proposal = handoffTargets[0]!;
        const opened = openHandoffTarget(proposal, result.handoff, { sourceToolId: "csv-cleaner" });
        setHandoffStatus(opened
          ? "Aperto " + proposal.target.name + "; attendo che lo strumento riceva i dati."
          : "Il browser ha bloccato la nuova finestra. Consenti i popup per questo passaggio esplicito e riprova.");
      }}
      onReset={reset}
    >
      {result !== null && !handoffDismissed && handoffTargets.length > 0 && (
        <aside class="handoff-card" aria-label="Strumenti successivi compatibili">
          <strong>Passa questa tabella pulita direttamente a un altro strumento, senza scaricarla e ricaricarla.</strong>
          <p>{handoffTargets[0]?.preview}</p>
          <pre class="handoff-preview">{result.output.split("\n").slice(0, 4).join("\n")}</pre>
          <p class="file-note">I dati vengono trasferiti una sola volta in memoria a una finestra dello stesso sito. Non vengono inseriti nell'URL, nei Recenti o nell'archiviazione locale.</p>
          <div class="actions">
            {handoffTargets.map((proposal) => (
              <button type="button" key={proposal.target.id} onClick={() => {
                const opened = openHandoffTarget(proposal, result.handoff, { sourceToolId: "csv-cleaner" });
                setHandoffStatus(opened
                  ? "Aperto " + proposal.target.name + "; attendo che lo strumento riceva i dati."
                  : "Il browser ha bloccato la nuova finestra. Consenti i popup per questo passaggio esplicito e riprova.");
              }}>
                {"Passa a " + proposal.target.name}
              </button>
            ))}
            <button type="button" onClick={() => {
              setHandoffDismissed(true);
              setHandoffStatus("Passaggio annullato. Il risultato pulito resta soltanto in questa pagina.");
            }}>Chiudi passaggio</button>
          </div>
        </aside>
      )}
      {handoffStatus && <p role="status">{handoffStatus}</p>}
    </CsvTableResultV2>
  </div>;
}

import { gutterStateFromResult } from "../shared/ToolGutter";
