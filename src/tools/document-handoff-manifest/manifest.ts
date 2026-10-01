import type { ToolManifest } from "../../catalog/manifest";

export const documentHandoffManifestManifest = {
  id: "document-handoff-manifest",
  route: "/tools/document-handoff-manifest",
  name: "Document Handoff Manifest",
  summary: "Create a deterministic local JSON manifest with safe names, PDF structure flags, sizes, and SHA-256 digests.",
  aliases: ["document manifest", "file handoff index", "pdf handoff checklist"],
  jobs: ["create a document manifest", "prepare a pdf handoff", "index local documents"],
  category: "documents",
  inputTypes: ["application/pdf", "file"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/document-handoff-manifest/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "document-manifest" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-140", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default documentHandoffManifestManifest;
