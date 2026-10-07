import { PdfTool } from "./pdf/PdfTool";
export function PdfImageExtractorTool() { return <PdfTool toolId="pdf-image-extractor" title="PDF file" description="Extract page-scoped embedded JPEG bytes with object/page provenance, optional dedupe, and explicit unsupported-filter reporting." actionLabel="Extract images" optionMode="image-extraction" />; }
