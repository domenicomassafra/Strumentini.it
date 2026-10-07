import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { utmParserManifest } from "../../tools/utm-parser/manifest";
import { InlineError, StructuredTextResultV2, ToolActions, ToolFormCard, ToolOperation, ToolSubmitButton, useToolOperation } from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function UtmParserTool() {
  const [url, setUrl] = useState("");
  const [bulk, setBulk] = useState(false);
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("utm-parser", { url, bulk }, {}, signal), { formatError: () => "Inserisci uno o più URL HTTP(S) validi." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>{bulk ? "URL della campagna, uno per riga" : "URL della campagna"}</span><textarea aria-label="URL della campagna" rows={bulk ? 7 : 4} value={url} onInput={(event) => setUrl(event.currentTarget.value)} placeholder="https://example.com/?utm_source=newsletter&utm_medium=email" /></label><label class="checkbox-field"><input aria-label="Modalità bulk UTM parser" type="checkbox" checked={bulk} onChange={(event) => setBulk(event.currentTarget.checked)} /> <span>Modalità bulk: isola gli errori per URL e conserva indice/riga sorgente</span></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Analizza campi UTM</ToolSubmitButton></ToolActions></ToolFormCard></form><StructuredTextResultV2 eyebrow="Campi analizzati" placeholder="Qui appariranno i campi UTM, la policy duplicati e gli eventuali errori per riga." state={operation.status} value={operation.result} declaration={utmParserManifest.result} summaryLabel="Risultato" summaryValue={bulk ? "URL UTM analizzati in bulk" : "Campi UTM analizzati"} metrics={[]} provenance="Elaborazione locale; nessuna richiesta di rete." filename="utm-parser.json" onReset={operation.reset} /></ToolOperation>;
}
