import { PdfTool } from "./pdf/PdfTool";
export function PdfCompareLiteTool() { return <PdfTool toolId="pdf-compare-lite" title="PDF files" description="Compare page count, geometry, rotation, and bounded text between two local PDFs." actionLabel="Compare PDFs" inputMode="pair" />; }
