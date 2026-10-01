import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function CanonicalUrlHelperTool() {
  const [pageUrl, setPageUrl] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("canonical-url-helper", { pageUrl, canonicalUrl }, {}, signal), { formatError: () => "Inserisci l'URL della pagina e la destinazione canonica." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URL della pagina</span><input aria-label="URL della pagina" value={pageUrl} onInput={(event) => setPageUrl(event.currentTarget.value)} placeholder="https://example.com/articolo" /></label><label class="field"><span>Destinazione canonica</span><input aria-label="Destinazione canonica" value={canonicalUrl} onInput={(event) => setCanonicalUrl(event.currentTarget.value)} placeholder="/articolo" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Crea tag canonico</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="URL canonico" placeholder="Qui appariranno URL risolto, tag sicuro e avvisi sulle regole applicate." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
