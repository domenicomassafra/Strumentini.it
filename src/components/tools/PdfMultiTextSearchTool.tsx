import { PdfTool } from "./pdf/PdfTool";
import { PdfProductivityRoutes33 } from "./pdf/PdfProductivityRoutes33";

export function PdfMultiTextSearchTool() {
  return <><PdfTool
    toolId="pdf-multi-text-search"
    title="PDF files"
    description="Search page-scoped text across multiple local PDFs while isolating unreadable, encrypted, no-text and no-match states."
    actionLabel="Search PDFs"
    inputMode="multi"
    optionMode="multi-search"
  /><PdfProductivityRoutes33 current="pdf-multi-text-search" /></>;
}
