import type { ToolManifest } from "../../catalog/manifest";

export default {
  id: "epub-reader",
  route: "/tools/epub-reader",
  name: "Lettore EPUB offline",
  summary: "Leggi capitoli EPUB3 in locale e copia o esporta solo testo, senza eseguire contenuti attivi.",
  aliases: ["lettore epub", "leggi ebook epub", "estrai testo epub"],
  jobs: ["leggere capitoli EPUB3 in locale", "copiare o esportare testo di un ebook"],
  category: "files",
  inputTypes: ["file", "epub"],
  implementation: "../tools/epub-reader/module.ts",
  engine: "file-privacy",
  runtime: { location: "LOCAL", network: "forbidden" },
  capabilities: ["file-read", "clipboard", "file-write", "worker"],
  profileFields: [],
  result: { class: "file", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "R", oracleEntryId: "cand-272", fixtureFamilies: ["epub3-local-safe"] },
  deterministic: true,
} as const satisfies ToolManifest;
