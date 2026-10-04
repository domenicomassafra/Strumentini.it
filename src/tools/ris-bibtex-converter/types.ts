import type { BibtexEntry, ConversionWarning } from "../../engines/research-knowledge";

export type RisBibtexDirection = "ris-to-bibtex" | "bibtex-to-ris";

export interface RisBibtexConverterInput {
  text: string;
  direction?: RisBibtexDirection;
}

export interface RisBibtexConverterOutput {
  direction: RisBibtexDirection;
  bibtex?: string;
  ris?: string;
  entries: BibtexEntry[];
  warnings: ConversionWarning[];
  unknownTags?: Array<{ record: number; tags: string[] }>;
  unknownFields?: Array<{ entry: number; fields: string[] }>;
  skippedTagLines?: number;
  truncated?: boolean;
  engineVersion: string;
}
