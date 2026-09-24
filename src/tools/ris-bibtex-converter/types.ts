export type RisBibtexDirection = "ris-to-bibtex" | "bibtex-to-ris";

export interface RisBibtexConverterInput {
  text: string;
  direction?: RisBibtexDirection;
}

export interface RisBibtexConverterOutput {
  direction: RisBibtexDirection;
  bibtex?: string;
  ris?: string;
  entries: unknown[];
  warnings: string[];
  engineVersion: string;
}
