import { PdfTool } from "./pdf/PdfTool";
export function PdfSplitTool() { return <PdfTool toolId="pdf-split" title="PDF file" description="Split a PDF into explicit page groups such as 1-2; 3-4." actionLabel="Split PDF" optionMode="groups" />; }
