import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";

export function QrGeneratorTool() {
  const [payload, setPayload] = useState("");
  const operation = useToolOperation((signal: AbortSignal) => toolRuntime.run("qr-generator", { payload }, {}, signal), { formatError: () => "Enter a UTF-8 payload of 78 bytes or fewer." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}><ToolFormCard><label class="field"><span>QR payload</span><textarea aria-label="QR payload" rows={4} value={payload} onInput={(event) => setPayload(event.currentTarget.value)} placeholder="https://example.com/campaign" /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Generating…">Generate QR matrix</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="QR symbol" placeholder="The generated SVG and matrix metadata appear here." busy={operation.isRunning}>{operation.result !== null && <><img src={(operation.result as { dataUrl: string }).dataUrl} alt="Generated QR code" width="240" height="240" /><p><strong>Version:</strong> {(operation.result as { version: number }).version} · <strong>Size:</strong> {(operation.result as { size: number }).size} modules</p><details><summary>Matrix rows</summary><pre class="json-result" tabIndex={0} aria-label="QR matrix rows">{(operation.result as { matrixRows: readonly string[] }).matrixRows.join("\n")}</pre></details></>}</ToolResultPanel></ToolOperation>;
}
