import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function UtmParserTool() {
  const [url, setUrl] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("utm-parser", { url }, {}, signal), { formatError: () => "Enter a valid HTTP(S) URL." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Campaign URL</span><textarea aria-label="Campaign URL" rows={4} value={url} onInput={(event) => setUrl(event.currentTarget.value)} placeholder="https://example.com/?utm_source=newsletter&utm_medium=email" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Parse UTM fields</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Parsed fields" placeholder="UTM fields and ordered query entries appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
