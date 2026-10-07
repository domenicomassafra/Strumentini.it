import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { emailDomainExtractorManifest } from "../../tools/email-domain-extractor/manifest";
import { InlineError, StructuredTextResultV2, ToolActions, ToolFormCard, ToolOperation, ToolSubmitButton, useToolOperation } from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function EmailDomainExtractorTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("email-domain-extractor", { text }, {}, signal), { formatError: () => "Incolla uno o più indirizzi email." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Indirizzi email</span><textarea aria-label="Indirizzi email" rows={9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder="nome@example.com, team@example.co.uk" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Estrai domini email</ToolSubmitButton></ToolActions></ToolFormCard></form><StructuredTextResultV2 eyebrow="Domini email" placeholder="Qui appariranno indirizzi univoci, domini e valori non riconosciuti." state={operation.status} value={operation.result} declaration={emailDomainExtractorManifest.result} summaryLabel="Risultato" summaryValue="Domini email estratti" metrics={[]} provenance="Elaborazione locale; nessuna richiesta di rete." filename="email-domain-extractor.json" onReset={operation.reset} /></ToolOperation>;
}
