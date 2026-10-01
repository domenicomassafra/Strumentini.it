import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { UtmBuilderOutput } from "../../tools/utm-builder/types";
import {
  InlineError,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function UtmBuilderTool() {
  const [baseUrl, setBaseUrl] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const operation = useToolOperation<UtmBuilderOutput>(
    (signal: AbortSignal) => toolRuntime.run("utm-builder", { baseUrl, source, medium, campaign }, {}, signal),
    { formatError: () => "Inserisci un URL HTTP(S) valido e i valori di sorgente, mezzo e campagna." },
  );

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  return (
    <ToolOperation className="single-column" busy={operation.isRunning}>
      <form onSubmit={submit}>
        <ToolFormCard>
          <label class="field">
            <span>URL di destinazione</span>
            <input aria-label="URL di destinazione" value={baseUrl} onInput={(event) => setBaseUrl(event.currentTarget.value)} placeholder="https://example.com/pagina?ref=sito#dettagli" />
          </label>
          <div class="field-grid">
            <label class="field"><span>Sorgente</span><input aria-label="Sorgente" value={source} onInput={(event) => setSource(event.currentTarget.value)} /></label>
            <label class="field"><span>Mezzo</span><input aria-label="Mezzo" value={medium} onInput={(event) => setMedium(event.currentTarget.value)} /></label>
          </div>
          <label class="field"><span>Campagna</span><input aria-label="Campagna" value={campaign} onInput={(event) => setCampaign(event.currentTarget.value)} /></label>
          <InlineError message={operation.error} />
          <ToolActions>
            <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Crea URL</ToolSubmitButton>
          </ToolActions>
        </ToolFormCard>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder="L'URL della campagna apparirà qui." busy={operation.isRunning}>
        {operation.result !== null && <code class="long-result">{operation.result.url}</code>}
      </ToolResultPanel>
    </ToolOperation>
  );
}
