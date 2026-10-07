import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "secret-token-pattern-scanner",
  route: "/tools/secret-token-pattern-scanner",
  name: "Secret / Token Pattern Scanner",
  summary: "Scan bounded local text for common secret patterns and show redacted findings.",
  aliases: ["secret / token pattern scanner"],
  jobs: ["scan text for secret patterns", "find token-like strings"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/secret-token-pattern-scanner/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "validator", capabilities: ["copy", "retry", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-175", fixtureFamilies: ["url-security", "html-entities"] },
} as const satisfies ToolManifest;

export default manifest;
