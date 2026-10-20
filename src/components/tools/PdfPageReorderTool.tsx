import { PdfPageWorkspace372 } from "./pdf/PdfPageWorkspace372";
import { PdfOriginalText133Tool } from "./pdf/PdfOriginalText133Tool";

export function PdfPageReorderTool() {
  return <>
    <p class="file-note"><a href="#modifica-testo-originale">Vuoi cambiare il testo del PDF? Vai alla modifica del testo originale per i documenti supportati.</a></p>
    <PdfPageWorkspace372 />
    <PdfOriginalText133Tool />
  </>;
}
