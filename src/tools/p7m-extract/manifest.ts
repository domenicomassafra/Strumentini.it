import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "p7m-extract",
  route: "/tools/p7m-extract",
  name: "Apri P7M: estrai il documento",
  summary:
    "Estrai in locale il documento contenuto in un file firmato P7M/CMS e scaricalo, con l'avviso sempre visibile che la firma NON è verificata.",
  aliases: ["apri p7m", "estrai p7m", "p7m online", "documento firmato p7m"],
  jobs: ["aprire un file p7m", "estrarre il documento da una firma p7m"],
  category: "documents",
  inputTypes: ["file", "p7m"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/p7m-extract/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "file", capabilities: ["download", "reset", "provenance"] },
  deterministic: true,
  gold: { maintenanceClass: "R", oracleEntryId: "cand-274", fixtureFamilies: ["p7m-cms-176"] },
} as const satisfies ToolManifest;
