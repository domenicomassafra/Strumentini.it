import type { ResearchPackManifest } from "../../engines/research-knowledge";

export interface ResearchPackManifestInput {
  name: string;
  tools: string[] | string;
}

export interface ResearchPackManifestOutput extends ResearchPackManifest {}
