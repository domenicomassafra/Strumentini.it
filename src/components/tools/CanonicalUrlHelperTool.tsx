import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { canonicalUrlHelperManifest } from "../../tools/canonical-url-helper/manifest";
import { InlineError, StructuredTextResultV2, ToolActions, ToolFormCard, ToolOperation, ToolSubmitButton, useToolOperation } from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function CanonicalUrlHelperTool() {
  const [pageUrl, setPageUrl] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("canonical-url-helper", { pageUrl, canonicalUrl }, {}, signal), { formatError: () => "Inserisci l'URL della pagina e la destinazione canonica." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URL della pagina</span><input aria-label="URL della pagina" value={pageUrl} onInput={(event) => setPageUrl(event.currentTarget.value)} placeholder="https://example.com/articolo" /></label><label class="field"><span>Destinazione canonica</span><input aria-label="Destinazione canonica" value={canonicalUrl} onInput={(event) => setCanonicalUrl(event.currentTarget.value)} placeholder="/articolo" /></label><p class="file-note">Costruisce e controlla la sintassi del tag in locale; non apre il sito e non verifica quale canonical venga pubblicato dal server.</p><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Crea tag canonico</ToolSubmitButton></ToolActions></ToolFormCard></form><StructuredTextResultV2 eyebrow="URL canonico" placeholder="Qui appariranno URL risolto, tag sicuro e avvisi sulle regole applicate." state={operation.status} value={operation.result} declaration={canonicalUrlHelperManifest.result} summaryLabel="Risultato" summaryValue="URL canonico risolto localmente" metrics={[]} provenance="Guida sintattica locale; nessuna verifica del sito live e nessuna richiesta di rete." filename="canonical-url-helper.json" onReset={operation.reset} /></ToolOperation>;
}
