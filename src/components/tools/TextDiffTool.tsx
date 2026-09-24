import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { TextDiffOutput } from "../../tools/text-diff/types";
import {
  InlineError,
  ToolActions,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";

const OPERATION_LABELS = {
  equal: { symbol: "=", label: "Unchanged" },
  remove: { symbol: "−", label: "Removed" },
  add: { symbol: "+", label: "Added" },
} as const;

export function TextDiffTool() {
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const operation = useToolOperation<TextDiffOutput>(
    (signal: AbortSignal) => toolRuntime.run("text-diff", { before, after }, {}, signal),
    {
      formatError: (run) => run.message === "INVALID_DIFF_TOO_LARGE"
        ? "This line-by-line diff exceeds the bounded local LCS limit. Split the text into smaller sections."
        : run.message,
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

  return (
    <div className="diff-operation">
      <form onSubmit={submit}>
        <div class="field-grid">
          <label class="field">
            <span>Before</span>
            <textarea rows={13} value={before} onInput={(event) => setBefore(event.currentTarget.value)} placeholder={"alpha\nbeta"} />
          </label>
          <label class="field">
            <span>After</span>
            <textarea rows={13} value={after} onInput={(event) => setAfter(event.currentTarget.value)} placeholder={"alpha\ngamma"} />
          </label>
        </div>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel="Comparing…">Compare text</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Line diff" placeholder="The diff appears here." className="diff-result" bare atomic={false} busy={operation.isRunning}>
        {operation.result !== null && (
          <>
            <p class="diff-summary">{operation.result.additions} added · {operation.result.removals} removed · {operation.result.unchanged} unchanged</p>
            <ol class="diff-list">
              {operation.result.operations.map((operationItem, index) => {
                const presentation = OPERATION_LABELS[operationItem.kind];
                return (
                  <li class={`diff-row diff-${operationItem.kind}`} data-kind={operationItem.kind} key={`${index}-${operationItem.text}`}>
                    <span class="diff-symbol" aria-hidden="true">{presentation.symbol}</span>
                    <strong>{presentation.label}</strong>
                    <code>{operationItem.text.replace(/\n$/u, "") || "(blank line)"}</code>
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
