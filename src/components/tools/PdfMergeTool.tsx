import { PdfTool } from "./pdf/PdfTool";
export function PdfMergeTool() { return <PdfTool toolId="pdf-merge" title="PDF files" description="Combine selected PDFs into one local document." actionLabel="Merge PDFs" inputMode="multi" />; }
