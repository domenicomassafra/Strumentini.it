export interface UtmBuilderInput {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export interface UtmBuilderOutput {
  url: string;
  engineVersion: string;
}
