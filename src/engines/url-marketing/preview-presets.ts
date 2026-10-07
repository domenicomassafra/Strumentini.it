export type PreviewPresetId = "search-mobile" | "search-desktop" | "social-card";

export interface PreviewPreset {
  readonly id: PreviewPresetId;
  readonly labelIt: string;
  readonly platformIt: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly source: string;
  readonly checkedAt: string;
  readonly approximationIt: string;
}

export const PREVIEW_PRESETS: readonly PreviewPreset[] = [
  {
    id: "search-mobile",
    labelIt: "Ricerca mobile",
    platformIt: "Motore di ricerca · viewport mobile",
    viewport: { width: 390, height: 844 },
    source: "Google Search Central — title links e meta description",
    checkedAt: "2026-09-23",
    approximationIt: "Anteprima indicativa: il motore di ricerca decide layout e troncamento finali.",
  },
  {
    id: "search-desktop",
    labelIt: "Ricerca desktop",
    platformIt: "Motore di ricerca · viewport desktop",
    viewport: { width: 1280, height: 800 },
    source: "Google Search Central — title links e meta description",
    checkedAt: "2026-09-23",
    approximationIt: "Anteprima indicativa: il motore di ricerca decide layout e troncamento finali.",
  },
  {
    id: "social-card",
    labelIt: "Scheda social generica",
    platformIt: "Open Graph · scheda social",
    viewport: { width: 390, height: 844 },
    source: "The Open Graph protocol (ogp.me) — basic metadata",
    checkedAt: "2026-09-23",
    approximationIt: "Anteprima indicativa: ogni piattaforma può ritagliare immagini e testo in modo diverso.",
  },
] as const;

export function getPreviewPreset(id: PreviewPresetId): PreviewPreset {
  const preset = PREVIEW_PRESETS.find((entry) => entry.id === id);
  if (preset === undefined) throw new Error("INVALID_PREVIEW_PRESET");
  return preset;
}
