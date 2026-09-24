export interface DomainFrequencyCounterInput {
  urls: string[] | string;
}

export interface DomainFrequencyCounterOutput {
  domains: Array<{ domain: string; count: number; urls: string[] }>;
  total: number;
  unique: number;
  engineVersion: string;
}
