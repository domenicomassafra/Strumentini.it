import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { TrackingCleanerOutput } from "../../tools/tracking-cleaner/types";
import {
  InlineError,
  ToolActions,
  ToolOperation,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function TrackingCleanerTool() {
  const [url, setUrl] = useState("");
  const operation = useToolOperation<TrackingCleanerOutput>(
    (signal: AbortSignal) => toolRuntime.run("tracking-cleaner", { url }, {}, signal),
    { formatError: () => "Inserisci un URL HTTP(S) valido." },
  );

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit}>
        <label class="field">
          <span>URL da pulire</span>
          <textarea aria-label="URL da pulire" rows={4} value={url} onInput={(event) => setUrl(event.currentTarget.value)} />
        </label>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Rimuovi parametri di tracciamento</ToolSubmitButton>
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder="Qui appariranno l'URL pulito e le chiavi rimosse." busy={operation.isRunning}>
        {operation.result !== null && (
          <>
            <code class="long-result">{operation.result.url}</code>
            <p><strong>Rimossi:</strong> {operation.result.dropped.length ? operation.result.dropped.join(", ") : "Nessuno — URL già pulito"}</p>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
