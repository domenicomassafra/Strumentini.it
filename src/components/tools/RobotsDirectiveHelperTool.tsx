import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { robotsDirectiveHelperManifest } from "../../tools/robots-directive-helper/manifest";
import { InlineError, StructuredTextResultV2, ToolActions, ToolFormCard, ToolOperation, ToolSubmitButton, useToolOperation } from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function RobotsDirectiveHelperTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("robots-directive-helper", { text }, {}, signal), { formatError: () => "Incolla il contenuto di robots.txt." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>robots.txt</span><textarea aria-label="robots.txt" rows={10} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={"User-agent: *\nDisallow: /privato\nSitemap: https://example.com/sitemap.xml"} /></label><p class="file-note">Analizza la sintassi del testo incollato. Non scarica robots.txt dal dominio e non conferma il comportamento live dei crawler.</p><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Analizza direttive</ToolSubmitButton></ToolActions></ToolFormCard></form><StructuredTextResultV2 eyebrow="robots.txt analizzato" placeholder="Qui appariranno gruppi, regole, sitemap e righe non valide." state={operation.status} value={operation.result} declaration={robotsDirectiveHelperManifest.result} summaryLabel="Risultato" summaryValue="Direttive analizzate localmente" metrics={[]} provenance="Guida sintattica locale; nessuna verifica del robots.txt live e nessuna richiesta di rete." filename="robots-directive-helper.json" onReset={operation.reset} /></ToolOperation>;
}
