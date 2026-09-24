import type { ToolManifest } from "../../catalog/manifest";

export const redirectChainInspectorManifest = {
  id: "redirect-chain-inspector",
  route: "/tools/redirect-chain-inspector",
  name: "Redirect-Chain Inspector",
  summary: "Inspect a pasted redirect hop list locally for status, location, loops, and credential redaction.",
  aliases: ["redirect chain checker", "hop sequence inspector"],
  jobs: ["review a redirect chain", "inspect pasted hop statuses"],
  category: "web-operations",
  inputTypes: ["structured", "text"],
  implementation: "../tools/redirect-chain-inspector/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-074", fixtureFamilies: ["url-security", "query-params"] },
} as const satisfies ToolManifest;

export default redirectChainInspectorManifest;
