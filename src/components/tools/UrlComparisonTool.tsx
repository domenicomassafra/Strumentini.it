import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function UrlComparisonTool() {
  const [leftUrl, setLeftUrl] = useState("");
  const [rightUrl, setRightUrl] = useState("");
  const [mode, setMode] = useState<"semantic" | "exact">("semantic");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("url-comparison", { leftUrl, rightUrl, mode }, {}, signal), { formatError: () => "Inserisci due URL HTTP(S) validi." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Primo URL</span><input aria-label="Primo URL" value={leftUrl} onInput={(event) => setLeftUrl(event.currentTarget.value)} /></label><label class="field"><span>Secondo URL</span><input aria-label="Secondo URL" value={rightUrl} onInput={(event) => setRightUrl(event.currentTarget.value)} /></label><label class="field"><span>Modalità di confronto</span><select aria-label="Modalità di confronto" value={mode} onChange={(event) => setMode(event.currentTarget.value as "semantic" | "exact")}><option value="semantic">Semantica: ignora l'ordine dei parametri</option><option value="exact">Forma serializzata esatta</option></select></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Confronta URL</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Confronto" placeholder="Qui appariranno differenze e URL normalizzati." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
