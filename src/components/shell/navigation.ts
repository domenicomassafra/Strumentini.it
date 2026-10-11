/**
 * One navigation declaration table, read by the header, the mobile panel, and
 * the footer. Adding a destination is a single edit here.
 */

import { groups } from "../../catalog/groups";
import type { ToolIconKey } from "../../ui/tool-icons";

export interface NavPanelItem {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
  readonly icon?: ToolIconKey;
  readonly tone?: number;
}

export interface NavEntry {
  readonly id: string;
  readonly label: string;
  /** A plain destination. Mutually exclusive with `panel`. */
  readonly href?: string;
  readonly panel?: readonly NavPanelItem[];
}

const categoryPanel: readonly NavPanelItem[] = groups.map((group) => ({
  label: group.label,
  href: `/categorie/${group.slug}/`,
  description: group.summary,
  icon: group.icon,
  tone: group.tone,
}));

export const primaryNav: readonly NavEntry[] = [
  {
    id: "strumenti",
    label: "Strumenti",
    panel: [
      { label: "Tutti gli strumenti", href: "/strumenti/", description: "Tutto il catalogo, con filtri e ricerca", icon: "list" },
      { label: "Preferiti e recenti", href: "/preferiti/", description: "Quello che usi di più, in cima", icon: "compare" },
      { label: "Categorie", href: "/categorie/", description: "Dieci gruppi di strumenti", icon: "folder" },
    ],
  },
  { id: "categorie", label: "Categorie", panel: categoryPanel },
  { id: "risorse", label: "Risorse", href: "/risorse/" },
];

export interface FooterColumn {
  readonly title: string;
  readonly items: readonly NavPanelItem[];
}

export const footerColumns: readonly FooterColumn[] = [
  {
    title: "Strumenti",
    items: [
      { label: "Tutti gli strumenti", href: "/strumenti/" },
      { label: "Preferiti e recenti", href: "/preferiti/" },
      { label: "Categorie", href: "/categorie/" },
      { label: "Configura i tuoi strumenti", href: "/onboarding/" },
    ],
  },
  {
    title: "Categorie",
    items: groups.slice(0, 6).map((group) => ({ label: group.label, href: `/categorie/${group.slug}/` })),
  },
  {
    title: "Risorse",
    items: [
      { label: "Chi siamo e trasparenza", href: "/chi-siamo/" },
      { label: "Come funziona", href: "/risorse/#come-funziona" },
      { label: "Privacy", href: "/risorse/#privacy" },
      { label: "Domande frequenti", href: "/risorse/#domande-frequenti" },
      { label: "Qualità dei risultati", href: "/risorse/#qualita" },
    ],
  },
  {
    title: "Il tuo spazio",
    items: [
      { label: "Accedi o registrati", href: "/accedi/" },
      { label: "Impostazioni", href: "/impostazioni/" },
    ],
  },
];
