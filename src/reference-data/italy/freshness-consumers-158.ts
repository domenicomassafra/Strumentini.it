/**
 * STR-158: audited entry points that consume versioned Italian public rules.
 * Consumers sharing an engine inherit its guard. Custom arithmetic and values
 * typed by the user have no automatic normative annual claim.
 */
export interface ItalyFreshnessConsumer158 {
  readonly consumerId: string;
  readonly path: string;
  readonly datasetId: string;
  /** A static historical example can remain usable beyond its supported year. */
  readonly claim: "current-year" | "pinned-historical" | "source-version";
}

export const ITALY_FRESHNESS_CONSUMERS_158: readonly ItalyFreshnessConsumer158[] = [
  { consumerId: "inps-agricultural-2026", path: "src/engines/italy/inps-contributions.ts", datasetId: "inps-contributions-annual", claim: "current-year" },
  { consumerId: "inps-artigiani-commercianti-2026", path: "src/engines/italy/inps-contributions.ts", datasetId: "inps-contributions-annual", claim: "current-year" },
  { consumerId: "inps-gestione-separata-2026", path: "src/engines/italy/inps-contributions.ts", datasetId: "inps-contributions-annual", claim: "current-year" },
  { consumerId: "italy-contribution-components", path: "src/components/tools/ItalyContributionTools.tsx", datasetId: "inps-contributions-annual", claim: "current-year" },
  { consumerId: "italy-stipendio-2026", path: "src/engines/italy/stipendio-netto-130.ts", datasetId: "inps-contributions-annual", claim: "current-year" },
  { consumerId: "italy-stipendio-2026-irpef", path: "src/engines/italy/stipendio-netto-130.ts", datasetId: "national-irpef-gross-subset", claim: "current-year" },
  { consumerId: "national-irpef-calculator", path: "src/engines/italy/irpef-national-127.ts", datasetId: "national-irpef-gross-subset", claim: "current-year" },
  { consumerId: "salary-net-national-irpef", path: "src/engines/italy/salary-net-13.ts", datasetId: "national-irpef-gross-subset", claim: "current-year" },
  { consumerId: "salary-net-agricultural-2025", path: "src/engines/italy/salary-net-13.ts", datasetId: "inps-agricultural-fpld-2025", claim: "pinned-historical" },
  { consumerId: "irpef-2025-deductions-and-surtaxes", path: "src/engines/italy/irpef-components-128.ts", datasetId: "irpef-components-bari-puglia-2025", claim: "pinned-historical" },
  { consumerId: "forfettario-2025-ateco", path: "src/engines/italy/forfettario-133.ts", datasetId: "forfettario-ateco2007-coefficients", claim: "pinned-historical" },
  { consumerId: "forfettario-2025-inps", path: "src/engines/italy/forfettario-133.ts", datasetId: "forfettario-inps-gs-2025", claim: "pinned-historical" },
  { consumerId: "vat-legally-scoped-2025", path: "src/reference-data/italy/fiscal-annual-vat-117.ts", datasetId: "vat-2025-limited-window", claim: "pinned-historical" },
  { consumerId: "tfr-december-2025-foi", path: "src/engines/italy/tfr-134-135.ts", datasetId: "tfr-foi-december-2025", claim: "pinned-historical" },
  { consumerId: "tfr-tax-illustration-irpef", path: "src/engines/italy/tfr-134-135.ts", datasetId: "national-irpef-gross-subset", claim: "current-year" },
  { consumerId: "invoice-stamp-2024", path: "src/engines/italy/invoice-stamp-reference-152.ts", datasetId: "invoice-stamp-reference-2024", claim: "pinned-historical" },
  { consumerId: "italian-2026-bridge-leave", path: "src/engines/italy/bridge-leave-optimizer.ts", datasetId: "italy-national-holidays", claim: "current-year" },
  { consumerId: "codice-fiscale-geography", path: "src/engines/italy/codice-fiscale-121.ts", datasetId: "italy-administrative-geography", claim: "source-version" },
  { consumerId: "codice-fiscale-anpr", path: "src/engines/italy/codice-fiscale-121-anpr.ts", datasetId: "italy-administrative-geography", claim: "source-version" },
  { consumerId: "fatturapa-xml-reader", path: "src/engines/italy/fatturapa-reader.ts", datasetId: "fatturapa-technical-schema", claim: "source-version" },
  { consumerId: "fatturapa-csv-batch", path: "src/engines/italy/fatturapa-batch.ts", datasetId: "fatturapa-technical-schema", claim: "source-version" },
  { consumerId: "italy-national-irpef-route", path: "src/pages/tools/irpef-annuale.astro", datasetId: "national-irpef-gross-subset", claim: "current-year" },
  { consumerId: "italy-irpef-components-route", path: "src/pages/tools/irpef-componenti.astro", datasetId: "irpef-components-bari-puglia-2025", claim: "pinned-historical" },
  { consumerId: "italy-salary-route", path: "src/pages/tools/stipendio-netto.astro", datasetId: "national-irpef-gross-subset", claim: "current-year" },
  { consumerId: "italy-fiscal-2026-route", path: "src/pages/tools/calcoli-fiscali-italia.astro", datasetId: "inps-contributions-annual", claim: "current-year" },
  { consumerId: "italy-forfettario-route", path: "src/pages/tools/partita-iva-validator.astro", datasetId: "forfettario-ateco2007-coefficients", claim: "pinned-historical" },
  { consumerId: "italy-vat-window-route", path: "src/pages/tools/iva-calcolo.astro", datasetId: "vat-2025-limited-window", claim: "pinned-historical" },
] as const;
