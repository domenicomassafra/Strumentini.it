import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const doiLinkBuilderManifest = {
  id: "doi-link-builder",
  route: "/tools/doi-link-builder",
  name: "DOI Link Builder",
  summary: "Build a resolver URL from a syntactically valid DOI without resolving it.",
  aliases: ["doi url builder", "doi resolver link"],
  jobs: ["construct a doi resolver link", "copy a doi resolver url"],
  category: "research",
  inputTypes: ["identifier", "text"],
  implementation: "../tools/doi-link-builder/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("doi-link-builder"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-182", fixtureFamilies: ["doi"] },
} as const satisfies ToolManifest;

export default doiLinkBuilderManifest;
