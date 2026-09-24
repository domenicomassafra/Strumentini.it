export interface DoiNormalizerInput {
  value: string;
}

export interface DoiNormalizerOutput {
  kind: "DOI";
  valid: boolean;
  normalized?: string;
  url?: string;
  reason?: string;
  engineVersion: string;
}
