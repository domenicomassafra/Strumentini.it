import type { EvidenceTable } from "../../engines/research-knowledge";

export interface EvidenceTableBuilderInput {
  records: unknown;
}

export interface EvidenceTableBuilderOutput extends EvidenceTable {
  engineVersion: string;
}
