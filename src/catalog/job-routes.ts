import { catalog } from "../generated/catalog";
import type { ToolSummary } from "./manifest";

/** Editorial routes between *existing* jobs. No transfer is implied by a link. */
const routeDefinitions = [
  {
    id: "immagini-da-condividere",
    title: "Prepara un'immagine da condividere",
    description: "Verifica se il browser supporta HEIC/HEIF, converti solo i file compatibili, poi comprimi e controlla i metadati EXIF. Compatibilità con foto reali da iPhone non certificata.",
    toolIds: ["image-format-conversion", "image-compression", "exif-remover"],
  },
  {
    id: "pdf-metadati",
    title: "Controlla i metadati di un PDF",
    description: "Ispeziona il PDF originale, rimuovi i metadati e verifica il file ottenuto. Il contenuto visibile resta da controllare a parte.",
    toolIds: ["pdf-metadata-inspector", "pdf-metadata-remover", "pdf-metadata-inspector"],
  },
  {
    id: "tabella-pulita",
    title: "Prepara un CSV pulito",
    description: "Converti un TSV in CSV, normalizza il file e rimuovi le righe duplicate prima di riutilizzare i dati.",
    toolIds: ["tsv-to-csv", "csv-cleaner", "csv-dedupe"],
  },
  {
    id: "sottotitoli-trascrizione",
    title: "Dai sottotitoli a un testo leggibile",
    description: "Converti SRT/WebVTT in trascrizione e conta le parole del testo esportato.",
    toolIds: ["subtitle-srt-vtt-transform", "word-character-line-counter"],
  },
] as const;

export interface JobRoute {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tools: readonly ToolSummary[];
}

/** Reject stale job IDs rather than silently showing dead links. */
export function buildJobRoutes(tools: readonly ToolSummary[]): readonly JobRoute[] {
  const byId = new Map(tools.map((tool) => [tool.id, tool]));
  if (byId.size !== tools.length || new Set(tools.map((tool) => tool.route)).size !== tools.length) {
    throw new Error("Job routes: catalog has duplicate IDs or paths");
  }
  return routeDefinitions.map((entry) => ({
    id: entry.id,
    title: entry.title,
    description: entry.description,
    tools: entry.toolIds.map((id) => {
      const tool = byId.get(id);
      if (tool === undefined) throw new Error(`Job route ${entry.id}: missing catalog tool ${id}`);
      return tool;
    }),
  }));
}

export const jobRoutes = buildJobRoutes(catalog);

const topics = [
  { title: "Conversioni e calcoli", toolIds: ["image-format-conversion", "basic-unit-converter"] },
  { title: "Italia", toolIds: ["italian-document-expiry", "iban-validator"] },
  { title: "Sicurezza e privacy", toolIds: ["pdf-metadata-remover", "exif-remover"] },
  { title: "Audio e video", toolIds: ["subtitle-srt-vtt-transform", "video-inspector"] },
] as const;

/** Examples of available jobs, not claims about popularity or total category size. */
export const discoveryTopics = topics.map(({ title, toolIds }) => ({
  title,
  tools: toolIds.map((id) => {
    const tool = catalog.find((entry) => entry.id === id);
    if (tool === undefined) throw new Error(`Discovery topic ${title}: missing catalog tool ${id}`);
    return tool;
  }),
}));

const watermarkTool = catalog.find((entry) => entry.id === "pdf-watermark");
if (watermarkTool === undefined) throw new Error("Discovery: missing canonical PDF watermark tool");
/** The existing PDF page owns this anchored mode; it is not a separate tool. */
export const visualSignatureRoute = `${watermarkTool.route}/#firma-grafica-visiva`;

export function nextJobSteps(toolId: string): readonly { route: JobRoute; next: ToolSummary }[] {
  return jobRoutes.flatMap((route) => route.tools.flatMap((tool, index) =>
    tool.id === toolId && index + 1 < route.tools.length
      ? [{ route, next: route.tools[index + 1]! }]
      : [],
  ));
}
