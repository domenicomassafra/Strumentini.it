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
  }, { formatError: () => "Incolla un SVG o una matrice QR oppure scegli un'immagine locale supportata dal browser." });
  return <ToolOperation busy={operation.isRunning}><form onSubmit={(event) => { event.preventDefault(); void operation.run(); }} noValidate><ToolFormCard><label class="field"><span>Immagine QR</span><input aria-label="Immagine QR" type="file" accept="image/*" disabled={operation.isRunning} onChange={(event) => setFile(event.currentTarget.files?.item(0) ?? null)} /><small>{file === null ? "Facoltativa · decodifica con BarcodeDetector nativo quando disponibile" : `${file.name} · elaborazione locale`}</small></label><label class="field"><span>SVG QR o matrice JSON</span><textarea aria-label="SVG QR o matrice JSON" rows={9} value={matrix} onInput={(event) => setMatrix(event.currentTarget.value)} placeholder="Incolla un SVG QR o una matrice JSON se non hai selezionato un'immagine." /></label><InlineError message={operation.error} /><ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Decodifica QR</ToolSubmitButton></ToolActions></ToolFormCard></form><ToolResultPanel eyebrow="Contenuto decodificato" placeholder="Qui appariranno byte decodificati e metadati QR." busy={operation.isRunning}>{operation.result !== null && <JsonResult value={operation.result} />}</ToolResultPanel></ToolOperation>;
}
