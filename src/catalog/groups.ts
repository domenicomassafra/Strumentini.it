/**
 * Public categories.
 *
 * The 13 internal `ToolManifest.category` values are a facet of the tool
 * factory: they are bound into 200 manifests, the oracles, and the certification
 * index, and they stay exactly as they are. This module is the *public* layer
 * over them — the ten groups a visitor can actually hold in their head, each
 * one between 18 and 21 tools.
 *
 * Nothing here renames a tool or changes a manifest. `memberCategories` is the
 * entire mapping, and `toolsInGroup` is the only reader a page needs.
 */

import { catalog } from "../generated/catalog";
import type { ToolSummary } from "./manifest";
import type { ToolIconKey } from "../ui/tool-icons";

export interface CatalogGroup {
  readonly slug: string;
  /** The card title. */
  readonly label: string;
  /** One line under the title. */
  readonly summary: string;
  /** The two lines of the category page hero. */
  readonly intro: string;
  /** The glyph on the group's card and hero tile, from the tool icon set. */
  readonly icon: ToolIconKey;
  /** Index into the tone wheel, 1–8. */
  readonly tone: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly memberCategories: readonly string[];
}

export const groups: readonly CatalogGroup[] = [
  {
    slug: "immagini",
    label: "Immagini",
    summary: "Comprimi, converti, ridimensiona e ritaglia.",
    intro: "Tutti gli strumenti per modificare, convertire e ottimizzare le tue immagini, in modo semplice e veloce.",
    icon: "image",
    tone: 1,
    memberCategories: ["files-assets", "image-visual"],
  },
  {
    slug: "pdf",
    label: "PDF e documenti",
    summary: "Unisci, dividi, comprimi e ispeziona i PDF.",
    intro: "Unisci, dividi, comprimi e controlla i tuoi PDF senza caricarli su nessun server.",
    icon: "document",
    tone: 3,
    memberCategories: ["documents"],
  },
  {
    slug: "file",
    label: "File e archivi",
    summary: "Checksum, duplicati, rinomina e archivi ZIP.",
    intro: "Verifica l'integrità dei file, trova i duplicati, rinomina in blocco e prepara archivi puliti.",
    icon: "archive",
    tone: 4,
    memberCategories: ["files"],
  },
  {
    slug: "testo",
    label: "Testo",
    summary: "Pulisci, confronta, conta e normalizza il testo.",
    intro: "Pulisci, confronta e misura il testo: maiuscole, caratteri invisibili, duplicati, differenze fra versioni.",
    icon: "text",
    tone: 5,
    memberCategories: ["text"],
  },
  {
    slug: "dati",
    label: "Dati e CSV",
    summary: "Pulisci CSV, mappa colonne, esporta tabelle.",
    intro: "Prepara i tuoi dati prima di consegnarli: separatori, codifica, colonne, duplicati e profili di qualità.",
    icon: "table",
    tone: 6,
    memberCategories: ["data"],
  },
  {
    slug: "date",
    label: "Date e orari",
    summary: "Giorni lavorativi, fusi orari, scadenze.",
    intro: "Conta giorni lavorativi, converti fusi orari, calcola scadenze e durate senza fogli di calcolo.",
    icon: "calendar",
    tone: 2,
    memberCategories: ["date-time"],
  },
  {
    slug: "sviluppo",
    label: "Sviluppo web",
    summary: "Hash, Base64, cron, JSON, JWT, regex.",
    intro: "Gli strumenti quotidiani di chi lavora sul web: codifiche, hash, cron, JSON, JWT e regole di validazione.",
    icon: "code",
    tone: 8,
    memberCategories: ["developer"],
  },
  {
    slug: "marketing",
    label: "Marketing e URL",
    summary: "UTM, metriche a pagamento, anteprime, QR.",
    intro: "Costruisci e ripulisci link, controlla i parametri di campagna, calcola le metriche a pagamento, genera QR.",
    icon: "link",
    tone: 7,
    memberCategories: ["marketing", "web-operations"],
  },
  {
    slug: "ricerca",
    label: "Ricerca e fonti",
    summary: "BibTeX, DOI, citazioni, elenchi di lettura.",
    intro: "Tieni in ordine la bibliografia: BibTeX, DOI e ISBN, citazioni duplicate, date delle fonti, note.",
    icon: "research",
    tone: 8,
    memberCategories: ["research"],
  },
  {
    slug: "business",
    label: "Soldi e business",
    summary: "Margini, tariffe, fatture, pareggio.",
    intro: "I conti che servono per preventivare: margini, ricarichi, tariffe, pareggio, fatture e sconti.",
    icon: "calculator",
    tone: 5,
    memberCategories: ["business-math", "client-work-math"],
  },
];

export const groupBySlug: ReadonlyMap<string, CatalogGroup> = new Map(
  groups.map((group) => [group.slug, group]),
);

/** The public group a tool belongs to. Falls back to the first group so a new
 *  category in the factory can never make a tool unreachable. */
export function groupForCategory(category: string): CatalogGroup {
  return groups.find((group) => group.memberCategories.includes(category)) ?? groups[0]!;
}

export function toolsInGroup(group: CatalogGroup): readonly ToolSummary[] {
  return catalog.filter((tool) => group.memberCategories.includes(tool.category));
}

/** Deterministic tone for a tone-less surface (search rows, related tools). */
export function toneForCategory(category: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  return groupForCategory(category).tone;
}
