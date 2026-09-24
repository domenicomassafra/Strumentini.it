import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";

export function RoasCalculatorTool() {
  const [spend, setSpend] = useState("");
  const [revenue, setRevenue] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("roas-calculator", { spend, revenue }, {}, signal), { formatError: () => "Enter non-negative spend and revenue values." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><div class="field-grid"><label class="field"><span>Spend</span><input aria-label="Spend" inputMode="decimal" value={spend} onInput={(event) => setSpend(event.currentTarget.value)} placeholder="200.00" /></label><label class="field"><span>Revenue</span><input aria-label="Revenue" inputMode="decimal" value={revenue} onInput={(event) => setRevenue(event.currentTarget.value)} placeholder="1000.00" /></label></div><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Calculating…">Calculate ROAS</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="ROAS" placeholder="The ratio, percentage, and exact-rounding policy appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
