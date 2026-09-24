export interface ResearchPackManifestInput {
  name: string;
  tools: string[] | string;
}

export interface ResearchPackManifestOutput {
  name: string;
  tools: string[];
  count: number;
  checksum: string;
  version: string;
  engineVersion: string;
}
