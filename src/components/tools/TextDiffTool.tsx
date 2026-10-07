import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { TextDiffOutput } from "../../tools/text-diff/types";
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
import { CONTROL, it } from "./shared/controlLabels";
import { TextFamilyResultV2 } from "./text-writing/TextFamilyResultV2";

export function TextDiffTool() {
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const operation = useToolOperation<TextDiffOutput>(
    (signal: AbortSignal) => toolRuntime.run("text-diff", { before, after }, {}, signal),
    {
      formatError: (run) => run.message === "INVALID_DIFF_TOO_LARGE"
        ? "Il confronto riga per riga supera il limite locale. Dividi il testo in sezioni più piccole."
        : "Impossibile confrontare i testi. Controlla i valori inseriti.",
    },
  );

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function reset() {
    setBefore("");
    setAfter("");
    operation.reset();
  }

  const gutterState = gutterStateFor(operation.status);

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit}>
        <div class="field-grid">
          <label class="field">
            <span>Prima</span>
            <textarea rows={13} value={before} onInput={(event) => setBefore(event.currentTarget.value)} placeholder={"alpha\nbeta"} />
          </label>
          <label class="field">
            <span>Dopo</span>
            <textarea rows={13} value={after} onInput={(event) => setAfter(event.currentTarget.value)} placeholder={"alpha\ngamma"} />
          </label>
        </div>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Confronta i testi</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>{it(CONTROL.reset)}</ToolResetButton>
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Differenze riga per riga" placeholder={it(CONTROL.gutterIdle)} className="diff-result" atomic={false} busy={operation.isRunning} state={gutterState}>
        {operation.result !== null && (
          <TextFamilyResultV2 tool="text-diff" value={operation.result} onReset={reset} />
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
