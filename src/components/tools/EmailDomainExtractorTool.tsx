import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";

export function EmailDomainExtractorTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("email-domain-extractor", { text }, {}, signal), { formatError: () => "Paste one or more email addresses." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Email addresses</span><textarea aria-label="Email addresses" rows={9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="name@example.com, team@example.co.uk" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Extracting…">Extract email domains</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Email domains" placeholder="Unique addresses, domains, and unmatched tokens appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
