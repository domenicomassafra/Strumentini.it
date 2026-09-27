import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function RedirectChainInspectorTool() {
  const [hops, setHops] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("redirect-chain-inspector", { hops }, {}, signal), { formatError: () => "Provide one hop per line as URL | status | location | delayMs." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Redirect hops</span><textarea aria-label="Redirect hops" rows={8} value={hops} onInput={(event) => setHops(event.currentTarget.value)} placeholder={"https://example.com/a|301|https://example.com/b\nhttps://example.com/b|200"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Inspect chain</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Redirect chain" placeholder="Hop statuses, locations, loops, and redaction warnings appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
