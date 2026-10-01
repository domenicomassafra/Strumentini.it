import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function MetaPreviewTool() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("meta-preview", { title, description }, {}, signal), { formatError: () => "Inserisci titolo e descrizione." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Titolo meta</span><input aria-label="Titolo meta" value={title} onInput={(event) => setTitle(event.currentTarget.value)} /></label><label class="field"><span>Descrizione meta</span><textarea aria-label="Descrizione meta" rows={5} value={description} onInput={(event) => setDescription(event.currentTarget.value)} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Mostra anteprima</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Anteprima di ricerca" placeholder="I controlli di lunghezza e il testo di anteprima sicuro appariranno qui." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
