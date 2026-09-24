export interface DoiLinkBuilderInput {
  value: string;
}

export interface DoiLinkBuilderOutput {
  valid: boolean;
  normalized?: string;
  url?: string;
  reason?: string;
  engineVersion: string;
}
