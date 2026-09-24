import { PdfTool } from "./pdf/PdfTool";
export function PdfPageDeleteExtractTool() { return <PdfTool toolId="pdf-page-delete-extract" title="PDF file" description="Extract selected pages into a new PDF or delete them from a local copy." actionLabel="Apply page operation" optionMode="delete-extract" />; }
