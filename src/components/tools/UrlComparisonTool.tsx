import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";

export function UrlComparisonTool() {
  const [leftUrl, setLeftUrl] = useState("");
  const [rightUrl, setRightUrl] = useState("");
  const [mode, setMode] = useState<"semantic" | "exact">("semantic");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("url-comparison", { leftUrl, rightUrl, mode }, {}, signal), { formatError: () => "Enter two valid HTTP(S) URLs." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>First URL</span><input aria-label="First URL" value={leftUrl} onInput={(event) => setLeftUrl(event.currentTarget.value)} /></label><label class="field"><span>Second URL</span><input aria-label="Second URL" value={rightUrl} onInput={(event) => setRightUrl(event.currentTarget.value)} /></label><label class="field"><span>Comparison mode</span><select aria-label="Comparison mode" value={mode} onChange={(event) => setMode(event.currentTarget.value as "semantic" | "exact")}><option value="semantic">Semantic (query order ignored)</option><option value="exact">Exact serialized form</option></select></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Comparing…">Compare URLs</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Comparison" placeholder="Differences and normalized URLs appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
