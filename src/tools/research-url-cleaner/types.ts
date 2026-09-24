export interface ResearchUrlCleanerInput {
  url: string;
}

export interface ResearchUrlCleanerOutput {
  valid: boolean;
  input: string;
  url?: string;
  removedParameters: string[];
  removedFragment: boolean;
  reason?: string;
  engineVersion: string;
}
