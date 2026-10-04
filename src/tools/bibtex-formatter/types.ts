import type { BibtexEntry } from "../../engines/research-knowledge";

export interface BibtexFormatterInput {
  text: string;
}

export interface BibtexFormatterOutput {
  bibtex: string;
  entries: BibtexEntry[];
  entryCount: number;
  directiveCount: number;
  truncated: boolean;
  warnings: Array<{ record: number; code: string; message: string }>;
  engineVersion: string;
}
