import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";

export function DomainSubdomainGrouperTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("domain-subdomain-grouper", { text }, {}, signal), { formatError: () => "Paste URLs or domains to group." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URLs or domains</span><textarea aria-label="URLs or domains" rows={9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={"https://www.example.com\nhttps://api.example.com\nhttps://example.co.uk"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Grouping…">Group hosts</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Domain groups" placeholder="Registrable-domain groups and observed subdomains appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
