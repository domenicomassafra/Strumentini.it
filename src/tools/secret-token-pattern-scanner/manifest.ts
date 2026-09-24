import type { ToolManifest } from "../../catalog/manifest";

export const manifest = {
  id: "secret-token-pattern-scanner",
  route: "/tools/secret-token-pattern-scanner",
  name: "Secret / Token Pattern Scanner",
  summary: "Secret / Token Pattern Scanner locally with bounded file selection and explicit privacy-safe output.",
  aliases: ["secret / token pattern scanner"],
  jobs: ["complete secret / token pattern scanner"],
  category: "files",
  inputTypes: ["file"],
  implementation: "../tools/secret-token-pattern-scanner/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-175", fixtureFamilies: ["url-security", "html-entities"] },
} as const satisfies ToolManifest;

export default manifest;
