import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { TextDiffOutput } from "../../tools/text-diff/types";
import {
  InlineError,
  StatusMark,
  ToolActions,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";
import type { StatusMarkKind } from "./shared/StatusMark";

const OPERATION_LABELS = {
  equal: { mark: "missing" as StatusMarkKind, label: "Invariata" },
  remove: { mark: "error" as StatusMarkKind, label: "Rimossa" },
  add: { mark: "ok" as StatusMarkKind, label: "Aggiunta" },
} as const;

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
    <div class="tool-operation">
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
          <>
            <dl class="gutter-rows">
              <div><dt>Aggiunte</dt><dd>{operation.result.additions}</dd></div>
              <div><dt>Rimosse</dt><dd>{operation.result.removals}</dd></div>
              <div><dt>Invariate</dt><dd>{operation.result.unchanged}</dd></div>
            </dl>
            <ol class="diff-list">
              {operation.result.operations.map((operationItem, index) => {
                const presentation = OPERATION_LABELS[operationItem.kind];
                return (
                  <li class={`diff-row diff-${operationItem.kind}`} data-kind={operationItem.kind} key={`${index}-${operationItem.text}`}>
                    <span class="diff-symbol"><StatusMark kind={presentation.mark} /></span>
                    <strong>{presentation.label}</strong>
                    <code>{operationItem.text.replace(/\n$/u, "") || "(riga vuota)"}</code>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </ToolResultPanel>
    </div>
  );
}
