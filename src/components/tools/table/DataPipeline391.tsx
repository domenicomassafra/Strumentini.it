import { useRef, useState } from "preact/hooks";
import {
  parsePipeline391Recipe, runPipeline391, serializePipeline391Recipe,
  type Pipeline391Recipe, type Pipeline391Result, type Pipeline391Sources, type Pipeline391Step,
} from "../../../engines/table/pipeline-391";
import type { TableFilterOperator, TableJoinType } from "../../../engines/table/operations";

const DEFAULT_STEPS: Pipeline391Step[] = [
  { kind: "filter", table: "left", column: 1, operator: "equals", value: "si" },
  { kind: "join", leftKeyColumns: [0], rightKeyColumns: [0], joinType: "inner" },
  { kind: "export", format: "csv" },
];
const FILTER_OPERATORS: TableFilterOperator[] = ["equals", "not-equals", "contains", "not-contains", "starts-with", "ends-with", "empty", "not-empty"];
const JOIN_TYPES: TableJoinType[] = ["inner", "left", "right", "full"];
type FilterStep = Extract<Pipeline391Step, { kind: "filter" }>;
type JoinStep = Extract<Pipeline391Step, { kind: "join" }>;

function download(name: string, value: string, type: string): void {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseIndexes(text: string): number[] {
  return text === "" ? [] : text.split(",").map((value) => value.trim() === "" ? NaN : Number(value.trim()));
}

/** UI in the existing CSV Join route: recipe and both source texts remain browser-local. */
export function DataPipeline391() {
  const [sources, setSources] = useState<Pipeline391Sources>({ left: "id,gruppo\n1,si\n2,no\n3,si", right: "id,tag\n1,α\n2,β\n3,γ" });
  const [steps, setSteps] = useState<Pipeline391Step[]>(DEFAULT_STEPS);
  const [result, setResult] = useState<Pipeline391Result | null>(null);
  const [expected, setExpected] = useState<Pipeline391Recipe["expected"]>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);

  function invalidate() {
    revision.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setResult(null);
    setExpected(undefined);
    setError("");
  }

  function editSource(which: "left" | "right", value: string) {
    invalidate();
    setSources((previous) => ({ ...previous, [which]: value }));
  }

  function replaceStep(index: number, step: Pipeline391Step) {
    invalidate();
    setSteps((previous) => previous.map((current, position) => position === index ? step : current));
  }

  function editFilter(index: number, patch: Partial<FilterStep>) {
    const existing = steps[index];
    if (existing?.kind === "filter") replaceStep(index, { ...existing, ...patch });
  }

  function editJoin(index: number, patch: Partial<JoinStep>) {
    const existing = steps[index];
    if (existing?.kind === "join") replaceStep(index, { ...existing, ...patch });
  }

  function addFilter(afterJoin: boolean) {
    invalidate();
    const where = afterJoin ? steps.length - 1 : steps.findIndex((step) => step.kind === "join");
    const next = [...steps];
    next.splice(where, 0, { kind: "filter", table: afterJoin ? "current" : "left", column: 0, operator: "equals", value: "" });
    setSteps(next);
  }

  function removeFilter(index: number) {
    invalidate();
    setSteps((previous) => previous.filter((_, position) => position !== index));
  }

  async function execute(replay = false) {
    const token = ++revision.current;
    controller.current?.abort();
    const job = new AbortController();
    controller.current = job;
    setBusy(true);
    setError("");
    if (!replay) setResult(null);
    try {
      const next = await runPipeline391({ version: 1, steps, ...(expected === undefined ? {} : { expected }) }, sources, {
        signal: job.signal,
        ...(replay && result !== null ? { expectedSourceSha256: result.sourceSha256 } : {}),
      });
      if (replay && result !== null && next.outputSha256 !== result.outputSha256) throw new Error("PIPELINE_REPLAY_HASH_MISMATCH");
      if (revision.current === token) setResult(next);
    } catch (cause) {
      if (revision.current === token) {
        setResult(null);
        setError(cause instanceof Error ? cause.message : "Pipeline non riuscita");
      }
    } finally {
      if (revision.current === token) { setBusy(false); controller.current = null; }
    }
  }

  function cancel() {
    invalidate();
    setError("Esecuzione annullata: le due sorgenti restano invariate.");
  }

  async function importRecipe(file?: File) {
    if (file === undefined) return;
    invalidate();
    const token = revision.current;
    try {
      if (file.size > 16_384) throw new Error("PIPELINE_RECIPE_TOO_LARGE");
      const recipe = parsePipeline391Recipe(JSON.parse(await file.text()) as unknown);
      if (revision.current !== token) return;
      setSteps([...recipe.steps]);
      setExpected(recipe.expected);
    } catch (cause) {
      if (revision.current === token) setError(cause instanceof Error ? cause.message : "PIPELINE_INVALID_RECIPE");
    }
  }

  const recipe: Pipeline391Recipe = { version: 1, steps,
    ...(result !== null ? { expected: { sourceSha256: result.sourceSha256, outputSha256: result.outputSha256 } }
      : expected === undefined ? {} : { expected }),
  };
  const joinIndex = steps.findIndex((step) => step.kind === "join");

  return <section class="section" data-str391-pipeline aria-labelledby="str391-title">
    <div class="section-head"><div>
      <h2 class="section-title" id="str391-title">Pipeline CSV locale · salva e ripeti</h2>
      <p class="section-sub">Filtra, unisci per chiave, filtra il risultato ed esporta. Scarica la sequenza JSON per riutilizzarla con gli stessi ingressi. I CSV rimangono sul dispositivo.</p>
    </div></div>
    <div class="tool-form-card">
      <label class="field"><span>Tabella CSV sinistra (origine)</span><textarea data-str391-left rows={5} value={sources.left} onInput={(event) => editSource("left", event.currentTarget.value)} /></label>
      <label class="field"><span>Tabella CSV destra (origine)</span><textarea data-str391-right rows={5} value={sources.right} onInput={(event) => editSource("right", event.currentTarget.value)} /></label>
      <h3>Passi della sequenza (in ordine)</h3>
      <ol data-str391-steps>
        {steps.map((step, index) => <li key={index}>
          {step.kind === "filter" ? <div>
            <strong>Filtro {step.table === "current" ? "risultato" : step.table === "left" ? "sinistra" : "destra"}</strong>
            {index < joinIndex && <label class="field"><span>Tabella</span><select aria-label={`Tabella filtro ${index + 1}`} value={step.table} onChange={(event) => editFilter(index, { table: event.currentTarget.value as "left" | "right" })}><option value="left">Sinistra</option><option value="right">Destra</option></select></label>}
            <label class="field"><span>Colonna (da 0)</span><input aria-label={`Colonna filtro ${index + 1}`} type="number" min="0" value={step.column} onInput={(event) => editFilter(index, { column: Number(event.currentTarget.value) })} /></label>
            <label class="field"><span>Operatore</span><select aria-label={`Operatore filtro ${index + 1}`} value={step.operator} onChange={(event) => editFilter(index, { operator: event.currentTarget.value as TableFilterOperator })}>{FILTER_OPERATORS.map((operator) => <option value={operator}>{operator}</option>)}</select></label>
            <label class="field"><span>Valore del filtro</span><input aria-label={`Valore filtro ${index + 1}`} value={step.value} onInput={(event) => editFilter(index, { value: event.currentTarget.value })} /></label>
            <button type="button" onClick={() => removeFilter(index)}>Rimuovi filtro {index + 1}</button>
          </div> : step.kind === "join" ? <div>
            <strong>Join per chiavi (NULL e vuoti non corrispondono)</strong>
            <label class="field"><span>Chiavi sinistra (posizioni da 0, separate da virgola)</span><input aria-label="Chiavi join sinistra" value={step.leftKeyColumns.join(",")} onInput={(event) => editJoin(index, { leftKeyColumns: parseIndexes(event.currentTarget.value) })} /></label>
            <label class="field"><span>Chiavi destra</span><input aria-label="Chiavi join destra" value={step.rightKeyColumns.join(",")} onInput={(event) => editJoin(index, { rightKeyColumns: parseIndexes(event.currentTarget.value) })} /></label>
            <label class="field"><span>Tipo join</span><select aria-label="Tipo join" value={step.joinType} onChange={(event) => editJoin(index, { joinType: event.currentTarget.value as TableJoinType })}>{JOIN_TYPES.map((value) => <option value={value}>{value}</option>)}</select></label>
          </div> : <strong>Esporta CSV UTF-8</strong>}
        </li>)}
      </ol>
      <div class="tool-actions">
        <button type="button" onClick={() => addFilter(false)}>Aggiungi filtro prima del join</button>
        <button type="button" onClick={() => addFilter(true)}>Aggiungi filtro sul risultato</button>
        <button type="button" data-str391-save onClick={() => { try { download("pipeline-391.json", serializePipeline391Recipe(recipe), "application/json"); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Sequenza non valida"); } }}>Salva sequenza JSON</button>
      </div>
      <label class="field"><span>Ricarica sequenza JSON</span><input data-str391-import type="file" accept=".json,application/json" onChange={(event) => { void importRecipe(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
      <div class="tool-actions">
        <button type="button" data-str391-run onClick={() => { void execute(); }} disabled={busy}>Esegui sequenza</button>
        <button type="button" data-str391-replay disabled={busy || result === null} onClick={() => { void execute(true); }}>Ripeti e verifica hash</button>
        <button type="button" data-str391-cancel onClick={cancel}>Annulla / scarta risultato</button>
      </div>
      <p role="status" data-str391-status>{busy ? "RUNNING" : result === null ? "NOT_RUN" : "READY"}</p>
      {error !== "" && <p role="alert" data-str391-error>{error}</p>}
      {result !== null && !busy && <div data-str391-result>
        <h3>Risultato riproducibile</h3>
        <p>SHA-256 output: <code data-str391-hash>{result.outputSha256}</code></p>
        <p>SHA-256 input sinistro: <code>{result.sourceSha256.left}</code></p>
        <p>SHA-256 input destro: <code>{result.sourceSha256.right}</code></p>
        <ol>{result.trace.map((entry) => <li key={entry.step}>{entry.explanation}</li>)}</ol>
        <pre data-str391-preview>{result.output.slice(0, 6_000)}</pre>
        <button type="button" data-str391-download onClick={() => download("pipeline-391.csv", result.output, "text/csv;charset=utf-8")}>Scarica CSV completo</button>
      </div>}
    </div>
  </section>;
}
