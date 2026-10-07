import { PdfTool } from "./pdf/PdfTool";
export function PdfTextExtractionTool() { return <PdfTool toolId="pdf-text-extraction" title="PDF file" description="Read page-scoped text operators from supported local content streams with explicit page separators and mode." actionLabel="Extract text" optionMode="text-extraction" />; }
