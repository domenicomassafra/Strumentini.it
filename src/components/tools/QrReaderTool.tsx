import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import { InlineError, ToolActions, ToolFormCard, ToolOperation, ToolResultPanel, ToolSubmitButton, useToolOperation } from "./shared";
import { JsonResult } from "./shared/JsonResult";
import { CONTROL, it } from "./shared/controlLabels";

export function QrReaderTool() {
  const [matrix, setMatrix] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const operation = useToolOperation(async (signal: AbortSignal) => {
    let bitmap: ImageBitmap | null = null;
    try {
      if (file !== null) bitmap = await createImageBitmap(file);
      return await toolRuntime.run("qr-reader", file === null ? { matrix: matrix.trim() } : { image: bitmap }, {}, signal);
    } finally {
      bitmap?.close();
    }
  }, { formatError: () => "Paste a QR SVG/matrix or choose a local image supported by this browser." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }} noValidate><ToolFormCard><label class="field"><span>QR image</span><input aria-label="QR image" type="file" accept="image/*" disabled={operation.isRunning} onChange={(event) => setFile(event.currentTarget.files?.item(0) ?? null)} /><small>{file === null ? "Optional · decoded by native BarcodeDetector when available" : `${file.name} · processed locally`}</small></label><label class="field"><span>QR SVG or JSON matrix</span><textarea aria-label="QR SVG or JSON matrix" rows={9} value={matrix} onInput={(event) => setMatrix(event.currentTarget.value)} placeholder="Paste a QR SVG or JSON matrix when no image is selected." /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Decode QR</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Decoded payload" placeholder="The decoded bytes and QR metadata appear here." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
