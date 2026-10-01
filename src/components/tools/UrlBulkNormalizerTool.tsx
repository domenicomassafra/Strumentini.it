import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function UrlBulkNormalizerTool() {
  const [urls, setUrls] = useState("");
  const [dropTracking, setDropTracking] = useState(false);
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("url-bulk-normalizer", { urls, sortQuery: true, removeFragment: false, removeTrailingSlash: false, dropTracking }, {}, signal), { formatError: () => "Inserisci almeno un URL per riga." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URL, uno per riga</span><textarea aria-label="URL, uno per riga" rows={7} value={urls} onInput={(event) => setUrls(event.currentTarget.value)} placeholder={"https://EXAMPLE.com/?b=2&a=1\nhttps://example.com/percorso"} /></label><label class="checkbox-field"><input type="checkbox" checked={dropTracking} onChange={(event) => setDropTracking(event.currentTarget.checked)} /> <span>Rimuovi i parametri di tracciamento conosciuti</span></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Normalizza elenco</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Elenco normalizzato" placeholder="Ogni URL normalizzato e gli eventuali errori per riga appariranno qui." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
