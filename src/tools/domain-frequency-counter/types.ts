import type { DomainFrequencyResult } from "../../engines/research-knowledge";

export interface DomainFrequencyCounterInput {
  urls: string[] | string;
}

export interface DomainFrequencyCounterOutput extends DomainFrequencyResult {
  engineVersion: string;
}
