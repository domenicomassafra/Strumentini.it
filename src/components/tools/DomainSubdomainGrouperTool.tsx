import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function DomainSubdomainGrouperTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("domain-subdomain-grouper", { text }, {}, signal), { formatError: () => "Incolla URL o domini da raggruppare." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URL o domini</span><textarea aria-label="URL o domini" rows={9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={"https://www.example.com\nhttps://api.example.com\nhttps://example.co.uk"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Raggruppa host</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Gruppi di domini" placeholder="Qui appariranno i gruppi per dominio registrabile e i sottodomini osservati." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
