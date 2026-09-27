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
    { formatError: () => "Enter a valid http(s) URL and source, medium, and campaign values." },
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
            <span>Destination URL</span>
            <input aria-label="Destination URL" value={baseUrl} onInput={(event) => setBaseUrl(event.currentTarget.value)} placeholder="https://example.com/landing?ref=site#details" />
          </label>
          <div class="field-grid">
            <label class="field"><span>Source</span><input aria-label="Source" value={source} onInput={(event) => setSource(event.currentTarget.value)} /></label>
            <label class="field"><span>Medium</span><input aria-label="Medium" value={medium} onInput={(event) => setMedium(event.currentTarget.value)} /></label>
          </div>
          <label class="field"><span>Campaign</span><input aria-label="Campaign" value={campaign} onInput={(event) => setCampaign(event.currentTarget.value)} /></label>
          <InlineError message={operation.error} />
          <ToolActions>
            <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Build URL</ToolSubmitButton>
          </ToolActions>
        </ToolFormCard>
      </form>
      <ToolResultPanel eyebrow="Result" placeholder="Your campaign URL appears here." busy={operation.isRunning}>
        {operation.result !== null && <code class="long-result">{operation.result.url}</code>}
      </ToolResultPanel>
    </ToolOperation>
  );
}
