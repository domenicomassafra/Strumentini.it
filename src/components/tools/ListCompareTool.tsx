import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { EqualityMode } from "../../engines/text-list";
import type { ListCompareOutput } from "../../tools/list-compare/types";
import {
  InlineError,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "./shared";
import { TextFamilyResultV2 } from "./text-writing/TextFamilyResultV2";

const MODES: ReadonlyArray<{ value: EqualityMode; label: string }> = [
  { value: "exact", label: "Corrispondenza esatta" },
  { value: "trim", label: "Ignora spazi ai bordi" },
  { value: "nfc", label: "Unicode NFC" },
  { value: "trim-nfc", label: "Spazi ai bordi + NFC" },
];

export function ListCompareTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [equality, setEquality] = useState<EqualityMode>("exact");
  const operation = useToolOperation<ListCompareOutput>(
    (signal) => toolRuntime.run("list-compare", { left, right, equality }, {}, signal),
    { formatError: () => "Impossibile confrontare le liste. Controlla i valori inseriti." },
  );

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function reset() {
    setLeft("");
    setRight("");
    setEquality("exact");
    operation.reset();
  }

  return (
    <ToolOperation busy={operation.isRunning}>
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
                disabled={operation.isRunning}
              />
              {mode.label}
            </label>
          ))}
        </fieldset>

        <div class="field-grid">
          <label class="field">
            <span>Lista A</span>
            <textarea rows={11} value={left} onInput={(event) => setLeft(event.currentTarget.value)} placeholder={"alpha\nbeta\nbeta"} disabled={operation.isRunning} />
          </label>
          <label class="field">
            <span>Lista B</span>
            <textarea rows={11} value={right} onInput={(event) => setRight(event.currentTarget.value)} placeholder={"beta\ngamma"} disabled={operation.isRunning} />
          </label>
        </div>

        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel="Confronto in corso…">Confronta liste</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>Reimposta</ToolResetButton>
        </ToolActions>
      </form>

      <ToolResultPanel eyebrow="Risultato" placeholder="I risultati del confronto appariranno qui." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {operation.result !== null && (
          <TextFamilyResultV2 tool="list-compare" value={operation.result} onReset={reset} />
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
