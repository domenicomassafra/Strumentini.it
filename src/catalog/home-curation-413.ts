import type { ToolSummary } from "./manifest";

/** Explicit editorial examples of common *jobs*, not user popularity metrics. */
export const EDITORIAL_STARTERS_413 = [
  { id: "pdf-merge", job: "Unire documenti PDF" },
  { id: "image-compression", job: "Ridurre il peso di un'immagine" },
  { id: "csv-cleaner", job: "Pulire un file CSV" },
  { id: "word-character-line-counter", job: "Contare parole e caratteri" },
  { id: "images-to-pdf", job: "Creare un PDF da immagini" },
  { id: "qr-generator", job: "Generare un codice QR" },
  { id: "date-difference", job: "Calcolare la distanza tra date" },
  { id: "margin-markup", job: "Calcolare margini e ricarichi" },
] as const;

/** No silent replacement, missing tool or invented catalog route is allowed. */
export function curateHomeTools413<T extends ToolSummary>(catalog: readonly T[]): readonly { tool: T; job: string }[] {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  if (byId.size !== catalog.length) throw new Error("CATALOG_DUPLICATE_ID");
  return EDITORIAL_STARTERS_413.map(({ id, job }) => {
    const tool = byId.get(id);
    if (!tool || tool.route !== `/tools/${id}` || tool.runtime.location !== "LOCAL" || tool.runtime.network !== "forbidden") {
      throw new Error(`EDITORIAL_TOOL_NOT_CURRENT_LOCAL_ROUTE:${id}`);
    }
    return { tool, job };
  });
}
