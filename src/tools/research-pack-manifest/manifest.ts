import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

export const researchPackManifestToolManifest = {
  id: "research-pack-manifest",
  route: "/tools/research-pack-manifest",
  name: "Research Pack Manifest",
  summary: "Create a sorted, checksummed local manifest for a named research tool pack.",
  aliases: ["research pack builder", "tool pack manifest", "pack checksum"],
  jobs: ["create a research pack", "sort pack tool ids", "checksum a tool pack"],
  category: "research",
  inputTypes: ["structured", "lines"],
  implementation: "../tools/research-pack-manifest/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: researchResultV2Declaration("research-pack-manifest"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-200", fixtureFamilies: ["research-source-inventory", "sha2-known-answers"] },
} as const satisfies ToolManifest;

export default researchPackManifestToolManifest;
