import { PdfTool } from "./pdf/PdfTool";
export function ImagesToPdfTool() { return <PdfTool toolId="images-to-pdf" title="JPEG images" description="Create one page per JPEG image with native local embedding." actionLabel="Create PDF" inputMode="multi" accept="image/jpeg,.jpg,.jpeg" />; }
