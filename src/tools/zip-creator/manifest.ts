import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "zip-creator",
  route: "/tools/zip-creator",
  name: "ZIP Creator",
  summary: "Comprimi ed estrai file ZIP e GZIP in locale con limiti, controllo dei percorsi e CRC32.",
  aliases: ["make zip", "create zip archive", "extract zip", "gzip", "unzip", "gunzip"],
  jobs: ["create and extract bounded local ZIP and GZIP archives"],
  category: "files",
  inputTypes: ["file", "folder", "zip"],
  implementation: "../tools/zip-creator/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "file", capabilities: ["download", "retry", "reset", "provenance", "before-after"] },
  handoff: { emits: [{ type: "file", format: "zip", maxBytes: 104_857_600 }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-171", fixtureFamilies: ["zip-signatures"] },
} as const satisfies ToolManifest;
