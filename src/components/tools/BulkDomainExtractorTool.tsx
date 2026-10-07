import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { bulkDomainExtractorManifest } from "../../tools/bulk-domain-extractor/manifest";
import { InlineError, StructuredTextResultV2, ToolActions, ToolFormCard, ToolOperation, ToolSubmitButton, useToolOperation } from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function BulkDomainExtractorTool() {
  const [text, setText] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("bulk-domain-extractor", { text }, {}, signal), { formatError: () => "Incolla URL o nomi di dominio." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>URL o domini</span><textarea aria-label="URL o domini" rows={9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={"https://www.example.com/a\nhttps://shop.example.com/b"} /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Estrai domini</ToolSubmitButton></ToolActions></ToolFormCard></form><StructuredTextResultV2 eyebrow="Domini" placeholder="Qui appariranno domini univoci e valori non validi." state={operation.status} value={operation.result} declaration={bulkDomainExtractorManifest.result} summaryLabel="Risultato" summaryValue="Domini estratti" metrics={[]} provenance="Elaborazione locale; nessuna richiesta di rete." filename="bulk-domain-extractor.json" onReset={operation.reset} /></ToolOperation>;
}
