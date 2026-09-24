import { PdfTool } from "./pdf/PdfTool";
export function PdfToImagesTool() { return <PdfTool toolId="pdf-to-images" title="PDF file" description="Extract directly embedded JPEG streams; unsupported rendering is reported instead of substituted." actionLabel="Extract images" />; }
