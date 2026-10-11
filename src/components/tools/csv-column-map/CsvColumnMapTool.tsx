import { useEffect, useRef, useState } from "preact/hooks";
import { recordCompletedTool } from "../../../workbench/completed-tool";
import { CSV_HARD_FILE_BYTES, readBlobText, type CsvColumnMapEntry } from "../../../engines/table/csv";
import { handoffCatalog } from "../../../generated/handoff-catalog";
import { compatibleHandoffTargets, openHandoffTarget, receiveHandoffFromOpener } from "../../../runtime/handoff";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { csvColumnMapManifest } from "../../../tools/csv-column-map/manifest";
import type { CsvColumnMapOutput } from "../../../tools/csv-column-map/types";
import { CsvTableResultV2 } from "../csv-shared/CsvTableResultV2";
import { CaretMark } from "../shared/StatusMark";

export function CsvColumnMapTool() {
  const [text, setText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapEntry[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [result, setResult] = useState<CsvColumnMapOutput | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const revision = useRef(0);
  const inFlight = useRef(false);

  function initialize(value: string, columns: readonly string[], source: string) {
    revision.current += 1;
    setText(value); setHeaders([...columns]); setMapping(columns.map((name, sourceIndex) => ({ sourceIndex, outputName: name || `column_${sourceIndex + 1}` }))); setSourceName(source); setResult(null); setError("");
  }

  useEffect(() => receiveHandoffFromOpener(csvColumnMapManifest, (envelope, proposal) => {
    initialize(envelope.payload, envelope.descriptor.columns, `Ricevuto da un altro strumento · ${proposal.preview}`);
  }), []);

  async function loadFile(file: File | undefined) {
    if (file === undefined) return;
    const current = ++revision.current;
    try {
      const value = await readBlobText(file);
      const { parseCsvTable } = await import("../../../engines/table/csv");
      if (current !== revision.current) return;
      initialize(value, parseCsvTable(value).header, `${file.name} · ${(file.size / 1024).toFixed(1)} KiB`);
    } catch { if (current === revision.current) setError("Impossibile leggere il file CSV."); }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= mapping.length) return;
    revision.current += 1;
    const next = [...mapping];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setMapping(next); setResult(null);
  }

  async function apply(event: Event) {
    if (inFlight.current) { event.preventDefault(); return; }
    event.preventDefault(); setError(""); setResult(null);
    if (text === "") { setError("Scegli un file CSV oppure ricevi prima una tabella da un altro strumento."); return; }
    const current = revision.current;
    inFlight.current = true;
    try {
      const run = await toolRuntime.run(csvColumnMapManifest.id, { text, mapping });
      if (current !== revision.current) return;
      if (!run.ok) { setError("Impossibile applicare la mappatura. Controlla colonne e nomi di uscita."); return; }
      setResult(run.value as CsvColumnMapOutput);
      recordCompletedTool(csvColumnMapManifest.id);
    } catch {
      if (current === revision.current) setError("Impossibile applicare la mappatura. Riprova.");
    } finally { inFlight.current = false; }
  }

  function reset() {
    revision.current += 1;
    setText("");
    setHeaders([]);
    setMapping([]);
    setSourceName("");
    setResult(null);
    setError("");
    if (fileInput.current !== null) fileInput.current.value = "";
  }

  const selected = new Set(mapping.map((entry) => entry.sourceIndex));
  const dropped = headers.flatMap((name, index) => selected.has(index) ? [] : [{ index, name }]);
  const handoffTargets = result === null
    ? []
    : compatibleHandoffTargets(result.handoff, handoffCatalog).filter(({ target }) => target.id !== csvColumnMapManifest.id);

  const gutterState = error ? "error" : result === null ? "idle" : "success";

  return <form class="tool-operation" onSubmit={apply}>
    <section class="tool-form-card">
      <label class="field"><span>File CSV</span><input ref={fileInput} aria-label="File CSV" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => void loadFile(event.currentTarget.files?.[0])} /></label>
      {sourceName && <p class="file-note" role="status">{sourceName}</p>}
      <p class="file-note">Limite file diretto: {Math.round(CSV_HARD_FILE_BYTES / 1024 / 1024)} MiB. I nomi di ingresso duplicati vengono distinti in base alla posizione della colonna.</p>
      {mapping.length > 0 && <div class="column-map-list" aria-label="Schema delle colonne di uscita">{mapping.map((entry, index) => <div class="column-map-row" key={entry.sourceIndex}><span class="column-source">Origine {entry.sourceIndex + 1}: {headers[entry.sourceIndex] || "(intestazione vuota)"}</span><label class="field compact-field"><span>Nome di uscita</span><input aria-label={`Nome di uscita per la colonna di origine ${entry.sourceIndex + 1}`} value={entry.outputName} onInput={(event) => { revision.current += 1; setMapping(mapping.map((item, itemIndex) => itemIndex === index ? { ...item, outputName: event.currentTarget.value } : item)); setResult(null); }} /></label><div class="column-actions"><button type="button" aria-label={`Sposta in su la colonna di origine ${entry.sourceIndex + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><CaretMark direction="up" label="Sposta in su" /></button><button type="button" aria-label={`Sposta in giù la colonna di origine ${entry.sourceIndex + 1}`} disabled={index === mapping.length - 1} onClick={() => move(index, 1)}><CaretMark direction="down" label="Sposta in giù" /></button><button type="button" aria-label={`Rimuovi la colonna di origine ${entry.sourceIndex + 1}`} onClick={() => { revision.current += 1; setMapping(mapping.filter((_, itemIndex) => itemIndex !== index)); setResult(null); }}>Rimuovi</button></div></div>)}</div>}
      {dropped.length > 0 && <div><strong>Colonne rimosse dal risultato</strong>{dropped.map((entry) => <p class="file-note" key={entry.index}>Colonna {entry.index + 1}: {entry.name || "(intestazione vuota)"} <button type="button" aria-label={`Ripristina la colonna di origine ${entry.index + 1}`} onClick={() => { revision.current += 1; setMapping([...mapping, { sourceIndex: entry.index, outputName: entry.name || `column_${entry.index + 1}` }]); setResult(null); }}>Ripristina</button></p>)}</div>}
      {mapping.length > 0 && <p class="schema-preview"><strong>Schema di output:</strong> {mapping.map((entry) => entry.outputName || "(vuoto)").join(" · ")}</p>}
      {error && <p class="error" role="alert">{error}</p>}
      <button class="primary tool-submit" type="submit">Applica la mappatura</button>
    </section>
    <CsvTableResultV2
      eyebrow="Risultato mappato"
      placeholder="Lo schema di output e il CSV mappato compaiono qui dopo aver applicato la mappatura visibile."
      state={gutterState}
      output={result?.output ?? null}
      filename="columns-mapped.csv"
      declaration={csvColumnMapManifest.result}
      summaryLabel="Schema di output"
      summaryValue={result === null ? "" : String(result.headers.length) + " " + (result.headers.length === 1 ? "colonna di output" : "colonne di output")}
      metrics={result === null ? [] : [
        { label: "Colonne scartate", value: result.droppedColumns.length },
        { label: "Celle vuote compilate", value: result.filledMissingCells },
      ]}
      warnings={result?.warnings}
      provenance="Mappatura applicata localmente per posizione di colonna; il download usa il CSV completo."
      handoffTargetCount={handoffTargets.length}
      onHandoff={handoffTargets[0] === undefined || result === null ? undefined : () => {
        const proposal = handoffTargets[0]!;
        void openHandoffTarget(proposal, result.handoff, { sourceToolId: csvColumnMapManifest.id });
      }}
      onReset={reset}
    />
  </form>;
}
