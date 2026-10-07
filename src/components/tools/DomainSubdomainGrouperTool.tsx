import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { domainSubdomainGrouperManifest } from "../../tools/domain-subdomain-grouper/manifest";
import { InlineError, StructuredTextResultV2, ToolActions, ToolFormCard, ToolOperation, ToolSubmitButton, useToolOperation } from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function DomainSubdomainGrouperTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("domain-subdomain-grouper", { text }, {}, signal), { formatError: () => "Incolla URL o domini da raggruppare." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URL o domini</span><textarea aria-label="URL o domini" rows={9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={"https://www.example.com\nhttps://api.example.com\nhttps://example.co.uk"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Raggruppa host</ToolSubmitButton></ToolActions></ToolFormCard></form><StructuredTextResultV2 eyebrow="Gruppi di domini" placeholder="Qui appariranno i gruppi per dominio registrabile e i sottodomini osservati." state={operation.status} value={operation.result} declaration={domainSubdomainGrouperManifest.result} summaryLabel="Risultato" summaryValue="Domini raggruppati" metrics={[]} provenance="Elaborazione locale; nessuna richiesta di rete." filename="domain-subdomain-grouper.json" onReset={operation.reset} /></ToolOperation>;
}
