import { PdfTool } from "./pdf/PdfTool";

export function PdfToMarkdownTool() {
  return <PdfTool
    toolId="pdf-to-markdown"
    title="PDF file"
    description="Export only page-scoped extracted text to Markdown with explicit page provenance and declared structural losses."
    actionLabel="Export Markdown"
    optionMode="pdf-to-markdown"
  />;
}
