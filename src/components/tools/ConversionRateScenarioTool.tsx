import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function ConversionRateScenarioTool() {
  const [visits, setVisits] = useState("");
  const [conversions, setConversions] = useState("");
  const [targetRatePercent, setTargetRatePercent] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("conversion-rate-scenario", { visits, conversions, targetRatePercent }, {}, signal), { formatError: () => "Enter visits, baseline conversions, and a target percentage." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><div class="field-grid"><label class="field"><span>Visits</span><input aria-label="Visits" inputMode="decimal" value={visits} onInput={(event) => setVisits(event.currentTarget.value)} placeholder="1000" /></label><label class="field"><span>Baseline conversions</span><input aria-label="Baseline conversions" inputMode="decimal" value={conversions} onInput={(event) => setConversions(event.currentTarget.value)} placeholder="25" /></label></div><label class="field"><span>Target conversion rate (%)</span><input aria-label="Target conversion rate" inputMode="decimal" value={targetRatePercent} onInput={(event) => setTargetRatePercent(event.currentTarget.value)} placeholder="3" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Project conversions</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Scenario" placeholder="Baseline, projected conversions, and lift appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
