import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { TextDiffOutput } from "../../tools/text-diff/types";

const OPERATION_LABELS = {
  equal: { symbol: "=", label: "Unchanged" },
  remove: { symbol: "−", label: "Removed" },
  add: { symbol: "+", label: "Added" },
} as const;

export function TextDiffTool() {
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [result, setResult] = useState<TextDiffOutput | null>(null);
  const [error, setError] = useState("");

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    const run = await toolRuntime.run("text-diff", { before, after });
    if (!run.ok) {
      setResult(null);
      setError(run.message === "INVALID_DIFF_TOO_LARGE"
        ? "This line-by-line diff exceeds the bounded local LCS limit. Split the text into smaller sections."
        : run.message);
      return;
    }
    setResult(run.value as TextDiffOutput);
  }

  function reset() {
    setBefore("");
    setAfter("");
    setResult(null);
    setError("");
  }

  return (
    <div class="diff-operation">
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
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions">
          <button class="primary" type="submit">Compare text</button>
          <button type="button" onClick={reset}>Reset</button>
        </div>
      </form>

      <section class="diff-result" aria-live="polite" aria-atomic="false">
        <p class="eyebrow">Line diff</p>
        {result === null ? <p class="result-placeholder">The diff appears here.</p> : (
          <>
            <p class="diff-summary">{result.additions} added · {result.removals} removed · {result.unchanged} unchanged</p>
            <ol class="diff-list">
              {result.operations.map((operation, index) => {
                const presentation = OPERATION_LABELS[operation.kind];
                return (
                  <li class={`diff-row diff-${operation.kind}`} data-kind={operation.kind} key={`${index}-${operation.text}`}>
                    <span class="diff-symbol" aria-hidden="true">{presentation.symbol}</span>
                    <strong>{presentation.label}</strong>
                    <code>{operation.text.replace(/\n$/u, "") || "(blank line)"}</code>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
