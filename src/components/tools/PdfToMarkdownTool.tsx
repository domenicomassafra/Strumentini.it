import { PdfTool } from "./pdf/PdfTool";
import { PdfToDocx57Tool } from "./pdf/PdfToDocx57Tool";

export function PdfToMarkdownTool() {
  return <><PdfTool
    toolId="pdf-to-markdown"
    title="PDF file"
    description="Export only page-scoped extracted text to Markdown with explicit page provenance and declared structural losses."
    actionLabel="Export Markdown"
    optionMode="pdf-to-markdown"
  /><PdfToDocx57Tool />
    <nav aria-label="Altre conversioni PDF disponibili" style={{ marginTop: "2rem" }}>
      <p>Altre esportazioni dello stesso gruppo (seleziona il PDF in ciascuno strumento):</p>
      <p><a href="/tools/pdf-tables-to-xlsx/">Tabella PDF selezionata → Excel XLSX, con anteprima delle celle</a></p>
      <p><a href="/tools/pdf-to-images/">PDF → PowerPoint PPTX: ogni pagina come immagine in una slide</a></p>
    </nav>
  </>;
}
