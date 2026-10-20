import type { ItalianToolCopy } from "./tool-copy";

/** Restrictive PDF xref repair: isolated locale copy keeps the catalog module within file-size limits. */
export const STR418_TOOL_COPY_IT: Readonly<Record<string, ItalianToolCopy>> = {
  "pdf-compression-lite": {
    name: "Alleggerisci un PDF",
    summary: "Crea una copia più pulita rimuovendo metadati e riducendo contenuti testuali non compressi quando possibile.",
    searchTerms: ["comprimi pdf", "compressione pdf", "riduci peso pdf"],
  },
  "pdf-repair": {
    name: "Ripara un PDF danneggiato",
    summary: "Ripara soltanto un puntatore startxref guasto quando struttura e contenuti sono verificabili; rifiuta gli altri danni.",
    searchTerms: ["ripara PDF", "recupera PDF", "PDF danneggiato"],
  },
};
