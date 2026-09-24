export interface BibtexFormatterInput {
  text: string;
}

export interface BibtexFormatterOutput {
  bibtex: string;
  entries: unknown[];
  entryCount: number;
  engineVersion: string;
}
