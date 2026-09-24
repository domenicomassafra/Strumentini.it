import type { ToolManifest } from "../../catalog/manifest";

export const pdfPasswordCheckManifest = {
  id: "pdf-password-check-remove",
  route: "/tools/pdf-password-check-remove",
  name: "PDF Password Check / Remove",
  summary: "Check whether a PDF declares encryption and produce a safe local copy only when no bypass is needed.",
  aliases: ["pdf password check", "remove pdf password", "pdf encryption check"],
  jobs: ["check pdf encryption", "remove pdf password when permitted", "inspect pdf password protection"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-password-check-remove/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-133", fixtureFamilies: ["pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfPasswordCheckManifest;
