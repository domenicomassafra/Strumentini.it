import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function UtmParserTool() {
  const [url, setUrl] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("utm-parser", { url }, {}, signal), { formatError: () => "Inserisci un URL HTTP(S) valido." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URL della campagna</span><textarea aria-label="URL della campagna" rows={4} value={url} onInput={(event) => setUrl(event.currentTarget.value)} placeholder="https://example.com/?utm_source=newsletter&utm_medium=email" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Analizza campi UTM</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Campi analizzati" placeholder="Qui appariranno i campi UTM e i parametri ordinati." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
