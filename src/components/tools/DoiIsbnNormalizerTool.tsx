import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { DoiIsbnOutput } from "../../tools/doi-isbn-normalizer/types";
import { gutterStateFromResult } from "./shared/ToolGutter";

export function DoiIsbnNormalizerTool() {
  const [kind, setKind] = useState<"doi" | "isbn">("doi");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<DoiIsbnOutput | null>(null);
  const [error, setError] = useState("");

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    const run = await toolRuntime.run("doi-isbn-normalizer", { kind, value });
    if (!run.ok) {
      setResult(null);
      setError(run.message);
      return;
    }
    setResult(run.value as DoiIsbnOutput);
  }

  function changeKind(next: "doi" | "isbn") {
    setKind(next);
    setResult(null);
    setError("");
  }

  function reset() {
    setKind("doi");
    setValue("");
    setResult(null);
    setError("");
  }

  const gutterState = gutterStateFromResult(result, error);
  return (
    <div class="tool-operation">
      <form onSubmit={submit}>
        <fieldset class="segmented">
          <legend>Identifier type</legend>
          <label><input type="radio" name="kind" checked={kind === "doi"} onChange={() => changeKind("doi")} /> DOI</label>
          <label><input type="radio" name="kind" checked={kind === "isbn"} onChange={() => changeKind("isbn")} /> ISBN</label>
        </fieldset>
        <label class="field">
          <span>{kind === "doi" ? "DOI" : "ISBN"}</span>
          <input
            type="text"
            value={value}
            onInput={(event) => setValue(event.currentTarget.value)}
            placeholder={kind === "doi" ? "doi:10.1000/182" : "978-0-306-40615-7"}
            autoCapitalize="off"
            spellcheck={false}
          />
        </label>
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions">
          <button class="primary" type="submit">Normalize &amp; validate</button>
          <button type="button" onClick={reset}>Reimposta</button>
        </div>
      </form>

      <section class="result-panel gutter" data-state={gutterState} aria-live="polite">
        <p class="eyebrow">Result</p>
        {result === null ? <p class="result-placeholder">The normalized identifier appears here.</p> : result.valid ? (
          result.kind === "DOI" ? (
            <>
              <strong class="gutter-value">Valid DOI shape</strong>
              <dl class="assumptions">
                <div><dt>Normalized</dt><dd><code>{result.normalized}</code></dd></div>
                <div><dt>Resolver URL</dt><dd><code>{result.url}</code></dd></div>
              </dl>
            </>
          ) : (
            <>
              <strong class="gutter-value">Valid {result.kind}</strong>
              <dl class="assumptions">
                <div><dt>Digits</dt><dd><code>{result.digits}</code></dd></div>
                {result.kind === "ISBN-10" && <div><dt>ISBN-13</dt><dd><code>{result.isbn13}</code></dd></div>}
              </dl>
            </>
          )
        ) : (
          <>
            <strong class="gutter-value">Invalid</strong>
            <p>{result.reason}</p>
          </>
        )}
      </section>
    </div>
  );
}
