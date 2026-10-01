import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function CpaCpcCpmCalculatorTool() {
  const [metric, setMetric] = useState("cpa");
  const [spend, setSpend] = useState("");
  const [denominator, setDenominator] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("cpa-cpc-cpm-calculator", { metric, spend, denominator }, {}, signal), { formatError: () => "Scegli una metrica e inserisci spesa e denominatore maggiore di zero." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Metrica</span><select aria-label="Metrica" value={metric} onChange={(event) => setMetric(event.currentTarget.value)}><option value="cpa">CPA — acquisizioni</option><option value="cpc">CPC — clic</option><option value="cpm">CPM — impressioni</option></select></label><div class="field-grid"><label class="field"><span>Spesa</span><input aria-label="Spesa" inputMode="decimal" value={spend} onInput={(event) => setSpend(event.currentTarget.value)} placeholder="200,00" /></label><label class="field"><span>Quantità di riferimento</span><input aria-label="Quantità di riferimento" inputMode="decimal" value={denominator} onInput={(event) => setDenominator(event.currentTarget.value)} placeholder="8" /></label></div><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Calcola metrica</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Metrica di rendimento" placeholder="Qui appariranno valore calcolato, unità e formula." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
