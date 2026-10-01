import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function RoasCalculatorTool() {
  const [spend, setSpend] = useState("");
  const [revenue, setRevenue] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("roas-calculator", { spend, revenue }, {}, signal), { formatError: () => "Inserisci valori non negativi per spesa e ricavi." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><div class="field-grid"><label class="field"><span>Spesa</span><input aria-label="Spesa" inputMode="decimal" value={spend} onInput={(event) => setSpend(event.currentTarget.value)} placeholder="200,00" /></label><label class="field"><span>Ricavi</span><input aria-label="Ricavi" inputMode="decimal" value={revenue} onInput={(event) => setRevenue(event.currentTarget.value)} placeholder="1000,00" /></label></div><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Calcola ROAS</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="ROAS" placeholder="Qui appariranno rapporto, percentuale e criterio di arrotondamento." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
