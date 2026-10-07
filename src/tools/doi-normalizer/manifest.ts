import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const doiNormalizerManifest = {
  id: "doi-normalizer",
  route: "/tools/doi-normalizer",
  name: "DOI Normalizer",
  summary: "Normalize DOI presentation and validate the deterministic DOI syntax locally.",
  aliases: ["doi cleanup", "doi canonicalizer"],
  jobs: ["canonicalize doi presentation", "validate a doi shape", "remove doi presentation"],
  category: "research",
  inputTypes: ["identifier", "text"],
  implementation: "../tools/doi-normalizer/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("doi-normalizer"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-181", fixtureFamilies: ["doi"] },
} as const satisfies ToolManifest;

export default doiNormalizerManifest;
