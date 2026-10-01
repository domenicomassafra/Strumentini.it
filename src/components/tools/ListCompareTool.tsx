import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { EqualityMode } from "../../engines/text-list";
import type { ListCompareOutput } from "../../tools/list-compare/types";
import { gutterStateFromResult } from "./shared/ToolGutter";

const MODES: ReadonlyArray<{ value: EqualityMode; label: string }> = [
  { value: "exact", label: "Corrispondenza esatta" },
  { value: "trim", label: "Ignora spazi ai bordi" },
  { value: "nfc", label: "Unicode NFC" },
  { value: "trim-nfc", label: "Spazi ai bordi + NFC" },
];

function ResultList({ title, values }: { title: string; values: readonly string[] }) {
  return (
    <section class="list-result-block">
      <h3>{title} <span class="count-chip">{values.length}</span></h3>
      {values.length === 0 ? <p class="result-placeholder">Nessuno</p> : (
        <ol>{values.map((value, index) => <li key={`${index}-${value}`}><code>{value === "" ? "(riga vuota)" : value}</code></li>)}</ol>
      )}
    </section>
  );
}

export function ListCompareTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [equality, setEquality] = useState<EqualityMode>("exact");
  const [result, setResult] = useState<ListCompareOutput | null>(null);
  const [error, setError] = useState("");

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    const run = await toolRuntime.run("list-compare", { left, right, equality });
    if (!run.ok) {
      setResult(null);
      setError("Impossibile confrontare le liste. Controlla i valori inseriti.");
      return;
    }
    setResult(run.value as ListCompareOutput);
  }

  function reset() {
    setLeft("");
    setRight("");
    setEquality("exact");
    setResult(null);
    setError("");
  }

  const gutterState = gutterStateFromResult(result, error);
  return (
    <div class="tool-operation">
      <form onSubmit={submit}>
        <fieldset class="segmented">
          <legend>Regola di confronto</legend>
          {MODES.map((mode) => (
            <label key={mode.value}>
              <input
                type="radio"
                name="equality"
                value={mode.value}
                checked={equality === mode.value}
                onChange={() => setEquality(mode.value)}
              />
              {mode.label}
            </label>
          ))}
        </fieldset>

        <div class="field-grid">
          <label class="field">
            <span>Lista A</span>
            <textarea rows={11} value={left} onInput={(event) => setLeft(event.currentTarget.value)} placeholder={"alpha\nbeta\nbeta"} />
          </label>
          <label class="field">
            <span>Lista B</span>
            <textarea rows={11} value={right} onInput={(event) => setRight(event.currentTarget.value)} placeholder={"beta\ngamma"} />
          </label>
        </div>

        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions">
          <button class="primary" type="submit">Confronta liste</button>
          <button type="button" onClick={reset}>Reimposta</button>
        </div>
      </form>

      <section class="result-panel gutter" data-state={gutterState} aria-live="polite">
        <p class="eyebrow">Risultato</p>
        {result === null ? <p class="result-placeholder">I risultati del confronto appariranno qui.</p> : (
          <div class="stacked-results">
            <ResultList title="In entrambe" values={result.intersection} />
            <ResultList title="Solo in A" values={result.onlyLeft} />
            <ResultList title="Solo in B" values={result.onlyRight} />
            <ResultList title="A senza duplicati" values={result.leftDeduped} />
            <ResultList title="B senza duplicati" values={result.rightDeduped} />
          </div>
        )}
      </section>
    </div>
  );
}
