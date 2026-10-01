import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function RobotsDirectiveHelperTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("robots-directive-helper", { text }, {}, signal), { formatError: () => "Incolla il contenuto di robots.txt." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>robots.txt</span><textarea aria-label="robots.txt" rows={10} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={"User-agent: *\nDisallow: /privato\nSitemap: https://example.com/sitemap.xml"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Analizza direttive</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="robots.txt analizzato" placeholder="Qui appariranno gruppi, regole, sitemap e righe non valide." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
