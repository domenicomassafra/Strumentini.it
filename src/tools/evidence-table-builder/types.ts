export interface EvidenceTableBuilderInput {
  records: unknown;
}

export interface EvidenceTableBuilderOutput {
  csv: string;
  headers: string[];
  rows: unknown[];
  rowCount: number;
  engineVersion: string;
}
