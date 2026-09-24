import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";

export function CpaCpcCpmCalculatorTool() {
  const [metric, setMetric] = useState("cpa");
  const [spend, setSpend] = useState("");
  const [denominator, setDenominator] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("cpa-cpc-cpm-calculator", { metric, spend, denominator }, {}, signal), { formatError: () => "Enter a metric, spend, and a non-zero denominator." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Metric</span><select aria-label="Metric" value={metric} onChange={(event) => setMetric(event.currentTarget.value)}><option value="cpa">CPA — conversions</option><option value="cpc">CPC — clicks</option><option value="cpm">CPM — impressions</option></select></label><div class="field-grid"><label class="field"><span>Spend</span><input aria-label="Spend" inputMode="decimal" value={spend} onInput={(event) => setSpend(event.currentTarget.value)} placeholder="200.00" /></label><label class="field"><span>Denominator</span><input aria-label="Denominator" inputMode="decimal" value={denominator} onInput={(event) => setDenominator(event.currentTarget.value)} placeholder="8" /></label></div><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Calculating…">Calculate metric</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Performance metric" placeholder="The calculated value, units, and formula appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
