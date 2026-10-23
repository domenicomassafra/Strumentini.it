import type { ItalianToolCopy } from "./tool-copy";

// Keep public copy of existing file tools unchanged while respecting the
// 20 KiB per-file growth budget for the shared Italian catalog.
export const P7M176_TOOL_COPY_IT: Readonly<Record<string, ItalianToolCopy>> = {
  "p7m-extract": {
    name: "Apri P7M: estrai il documento",
    summary: "Estrae in locale il documento dentro un file firmato P7M/CMS e lo rende scaricabile, dichiarando sempre che la firma non è verificata.",
    searchTerms: ["apri p7m", "estrai p7m", "firma digitale p7m", "busta cms", "p7m non verificato"],
  },
};
