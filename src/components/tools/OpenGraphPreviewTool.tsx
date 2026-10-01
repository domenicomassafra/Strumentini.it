import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function OpenGraphPreviewTool() {
  const [html, setHtml] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("open-graph-preview", { html }, {}, signal), { formatError: () => "Incolla HTML che contenga tag meta og: o twitter:." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Intestazione HTML o metadati</span><textarea aria-label="Intestazione HTML o metadati" rows={10} value={html} onInput={(event) => setHtml(event.currentTarget.value)} placeholder="Incolla intestazione HTML o metadati" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Estrai tag social</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Anteprima social" placeholder="Qui appariranno i tag estratti e gli avvisi sui campi mancanti." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
