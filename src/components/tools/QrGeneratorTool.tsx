import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function QrGeneratorTool() {
  const [payload, setPayload] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("qr-generator", { payload }, {}, signal), { formatError: () => "Inserisci un contenuto UTF-8 di massimo 78 byte." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>Contenuto QR</span><textarea aria-label="Contenuto QR" rows={4} value={payload} onInput={(event) => setPayload(event.currentTarget.value)} placeholder="https://example.com/campagna" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Genera matrice QR</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Codice QR" placeholder="Qui appariranno SVG generato e metadati della matrice." busy={operation.isRunning}>{operation.result !== null && <><img src={(operation.result as { dataUrl: string }).dataUrl} alt="Codice QR generato" width="240" height="240" /><p><strong>Versione:</strong> {(operation.result as { version: number }).version} · <strong>Dimensione:</strong> {(operation.result as { size: number }).size} moduli</p><details><summary>Righe della matrice</summary><pre class="json-result">{(operation.result as { matrixRows: readonly string[] }).matrixRows.join("\n")}</pre></details></>}</ToolResultPanel></ToolOperation>;
}
