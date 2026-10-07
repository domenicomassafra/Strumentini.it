import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { DoiIsbnOutput } from "../../tools/doi-isbn-normalizer/types";
import {
  gutterStateFor,
  InlineError,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";
import { ResearchResultV2 } from "./research-knowledge/ResearchResultV2";

export function DoiIsbnNormalizerTool() {
  const [kind, setKind] = useState<"doi" | "isbn">("doi");
  const [value, setValue] = useState("");
  const operation = useToolOperation<DoiIsbnOutput>(
    (signal) => toolRuntime.run("doi-isbn-normalizer", { kind, value }, {}, signal),
    { formatError: () => "Identificatore non valido. Controlla formato e cifra di controllo." },
  );

  async function submit(event: Event) {
    event.preventDefault();
    await operation.run();
  }

  function changeKind(next: "doi" | "isbn") {
    setKind(next);
    operation.reset();
  }

  function reset() {
    setKind("doi");
    setValue("");
    operation.reset();
  }

  function reuseResult(field: string, text: string) {
    if (field !== "value") return;
    setValue(text);
    operation.reset();
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit}>
        <fieldset class="segmented">
          <legend>Tipo di identificatore</legend>
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
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning}>Normalizza e valida</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>

      <ToolResultPanel
        eyebrow="Risultato"
        placeholder="L'identificatore normalizzato apparirà qui."
        busy={operation.isRunning}
        state={gutterStateFor(operation.status)}
      >
        {operation.result !== null && (
          <ResearchResultV2
            tool="doi-isbn-normalizer"
            value={operation.result}
            onReuse={reuseResult}
            onRetry={operation.retry}
            onReset={reset}
          />
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
