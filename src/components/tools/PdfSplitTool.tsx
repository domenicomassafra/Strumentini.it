import { PdfTool } from "./pdf/PdfTool";
import { PdfProductivityRoutes33 } from "./pdf/PdfProductivityRoutes33";
export function PdfSplitTool() { return <><PdfTool toolId="pdf-split" title="PDF file" description="Split a PDF into explicit page groups such as 1-2; 3-4." actionLabel="Split PDF" optionMode="groups" /><PdfProductivityRoutes33 current="pdf-split" /></>; }
