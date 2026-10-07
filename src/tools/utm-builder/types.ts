export interface UtmBuilderInput {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  id?: string;
  term?: string;
  content?: string;
}

export interface UtmBuilderOutput {
  url: string;
  encodingPolicy: string;
  duplicatePolicy: string;
  engineVersion: string;
}
