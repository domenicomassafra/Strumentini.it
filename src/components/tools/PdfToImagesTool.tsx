import { PdfTool } from "./pdf/PdfTool";
import { PdfToPptx255Tool } from "./pdf/PdfToPptx255Tool";
export function PdfToImagesTool() { return <>
  <PdfTool toolId="pdf-to-images" title="PDF file" description="Renderizza davvero le pagine PDF selezionate in JPG/JPEG, PNG o WebP, localmente, con scala/DPI e qualità espliciti. Per estrarre i byte delle immagini incorporate usa lo strumento separato di estrazione immagini PDF." actionLabel="Converti pagine in immagini" optionMode="pdf-to-images" />
  <PdfToPptx255Tool />
</>; }
