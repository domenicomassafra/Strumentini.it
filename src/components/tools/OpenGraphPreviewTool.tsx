import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function OpenGraphPreviewTool() {
  const [html, setHtml] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("open-graph-preview", { html }, {}, signal), { formatError: () => "Paste HTML containing og: or twitter: meta tags." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>HTML head or metadata</span><textarea aria-label="HTML head or metadata" rows={10} value={html} onInput={(event) => setHtml(event.currentTarget.value)} placeholder="Paste HTML head or metadata" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Extract social tags</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Social card" placeholder="Extracted tags and missing-field warnings appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
