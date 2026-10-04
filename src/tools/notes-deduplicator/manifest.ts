import type { ToolManifest } from "../../catalog/manifest";

export const notesDeduplicatorManifest = {
  id: "notes-deduplicator",
  route: "/tools/notes-deduplicator",
  name: "Notes Deduplicator",
  summary: "Remove duplicate research notes using stable whitespace and case normalization.",
  aliases: ["research note dedupe", "note duplicate finder"],
  jobs: ["dedupe notes", "remove repeated notes", "normalize note identity"],
  category: "research",
  inputTypes: ["text", "lines"],
  implementation: "../tools/notes-deduplicator/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-197", fixtureFamilies: ["research-text-frequency"] },
} as const satisfies ToolManifest;

export default notesDeduplicatorManifest;
