import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function RedirectChainInspectorTool() {
  const [hops, setHops] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("redirect-chain-inspector", { hops }, {}, signal), { formatError: () => "Inserisci un passaggio per riga nel formato URL | stato | destinazione | ritardoMs." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Passaggi di reindirizzamento</span><textarea aria-label="Passaggi di reindirizzamento" rows={8} value={hops} onInput={(event) => setHops(event.currentTarget.value)} placeholder={"https://example.com/a|301|https://example.com/b\nhttps://example.com/b|200"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Analizza catena</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Catena di reindirizzamenti" placeholder="Qui appariranno stati, destinazioni, cicli e avvisi di oscuramento." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
