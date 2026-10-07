import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const evidenceTableBuilderManifest = {
  id: "evidence-table-builder",
  route: "/tools/evidence-table-builder",
  name: "Evidence Table Builder",
  summary: "Build a deterministic CSV evidence table from local source records.",
  aliases: ["research table builder", "evidence csv builder"],
  jobs: ["build an evidence table", "create a source csv", "format research records"],
  category: "research",
  inputTypes: ["structured", "table"],
  implementation: "../tools/evidence-table-builder/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("evidence-table-builder"),
  handoff: { emits: [{ type: "table", format: "csv" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-196", fixtureFamilies: ["research-source-inventory"] },
} as const satisfies ToolManifest;

export default evidenceTableBuilderManifest;
