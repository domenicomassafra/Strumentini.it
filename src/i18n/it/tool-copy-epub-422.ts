import type { ItalianToolCopy } from "./tool-copy";

// Keep public copy of existing file tools unchanged while respecting the
// 20 KiB per-file growth budget for the shared Italian catalog.
export const EPUB422_TOOL_COPY_IT: Readonly<Record<string, ItalianToolCopy>> = {
  "ai-code-fence-bundle": {
    name: "Blocchi di codice AI → file ZIP",
    summary: "Trasforma in locale i code fence incollati in file con nomi sicuri e deterministici, mostra l'albero previsto e scarica lo ZIP esatto.",
    searchTerms: ["chatgpt codice in file", "code fence zip", "blocchi codice in file", "risposta ai zip", "markdown code files"],
  },
  "archive-checksum-manifest": {
    name: "Checksum di un archivio",
    summary: "Calcola gli SHA-256 di un archivio ZIP o di più file e crea un elenco verificabile da conservare o condividere.",
  },
  "epub-reader": {
    name: "Leggi EPUB offline",
    summary: "Naviga capitoli EPUB3 e copia o esporta testo in locale, rifiutando script e risorse esterne.",
    searchTerms: ["lettore epub", "ebook offline", "epub3 testo"],
  },
};
