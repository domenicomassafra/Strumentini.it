import { PdfTool } from "./pdf/PdfTool";
export function PdfPageReorderTool() { return <PdfTool toolId="pdf-page-reorder" title="PDF file" description="Enter every page exactly once in the desired order." actionLabel="Reorder pages" optionMode="order" />; }
