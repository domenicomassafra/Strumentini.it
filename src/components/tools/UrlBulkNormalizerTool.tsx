import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function UrlBulkNormalizerTool() {
  const [urls, setUrls] = useState("");
  const [dropTracking, setDropTracking] = useState(false);
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("url-bulk-normalizer", { urls, sortQuery: true, removeFragment: false, removeTrailingSlash: false, dropTracking }, {}, signal), { formatError: () => "Enter at least one URL per line." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URLs, one per line</span><textarea aria-label="URLs, one per line" rows={7} value={urls} onInput={(event) => setUrls(event.currentTarget.value)} placeholder={"https://EXAMPLE.com/?b=2&a=1\nhttps://example.com/path"} /></label><label class="checkbox-field"><input type="checkbox" checked={dropTracking} onChange={(event) => setDropTracking(event.currentTarget.checked)} /> <span>Drop known tracking parameters</span></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Normalize list</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Normalized list" placeholder="Each normalized URL and row error appears here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
