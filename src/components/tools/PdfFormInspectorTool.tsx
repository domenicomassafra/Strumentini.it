import { PdfFormEditor136Tool } from "./pdf/PdfFormEditor136Tool";
import { PdfTool } from "./pdf/PdfTool";

export function PdfFormInspectorTool() {
  return <>
    <PdfFormEditor136Tool />
    <details>
      <summary>Solo ispezione del PDF, senza modificare i campi</summary>
      <PdfTool toolId="pdf-form-inspector" title="Modulo PDF" description="Leggi nomi, tipi e valori dei campi AcroForm senza apportare modifiche." actionLabel="Esamina campi" />
    </details>
  </>;
}
