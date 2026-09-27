import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function MetaPreviewTool() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("meta-preview", { title, description }, {}, signal), { formatError: () => "Enter a title and description." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Meta title</span><input aria-label="Meta title" value={title} onInput={(event) => setTitle(event.currentTarget.value)} /></label><label class="field"><span>Meta description</span><textarea aria-label="Meta description" rows={5} value={description} onInput={(event) => setDescription(event.currentTarget.value)} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Preview metadata</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Search preview" placeholder="Length checks and escaped preview text appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
