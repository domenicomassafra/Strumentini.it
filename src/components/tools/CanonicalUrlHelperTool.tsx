import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";

export function CanonicalUrlHelperTool() {
  const [pageUrl, setPageUrl] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("canonical-url-helper", { pageUrl, canonicalUrl }, {}, signal), { formatError: () => "Enter a page URL and a canonical target." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Page URL</span><input aria-label="Page URL" value={pageUrl} onInput={(event) => setPageUrl(event.currentTarget.value)} placeholder="https://example.com/article" /></label><label class="field"><span>Canonical target</span><input aria-label="Canonical target" value={canonicalUrl} onInput={(event) => setCanonicalUrl(event.currentTarget.value)} placeholder="/article" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Resolving…">Build canonical tag</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Canonical helper" placeholder="The resolved URL, escaped tag, and policy warnings appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
