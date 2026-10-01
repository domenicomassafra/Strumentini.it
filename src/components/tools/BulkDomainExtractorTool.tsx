import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function BulkDomainExtractorTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("bulk-domain-extractor", { text }, {}, signal), { formatError: () => "Incolla URL o nomi di dominio." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URL o domini</span><textarea aria-label="URL o domini" rows={9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={"https://www.example.com/a\nhttps://shop.example.com/b"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Estrai domini</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Domini" placeholder="Qui appariranno domini univoci e valori non validi." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
