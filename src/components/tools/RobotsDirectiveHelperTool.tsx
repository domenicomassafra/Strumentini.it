import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";

export function RobotsDirectiveHelperTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("robots-directive-helper", { text }, {}, signal), { formatError: () => "Paste robots.txt content." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>robots.txt</span><textarea aria-label="robots.txt" rows={10} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={"User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Parsing…">Parse directives</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Parsed robots.txt" placeholder="Groups, rules, sitemaps, and malformed lines appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
