import type { ToolManifest } from "../../catalog/manifest";

export const utmBuilderManifest = {
  id: "utm-builder",
  route: "/tools/utm-builder",
  name: "UTM Builder",
  summary: "Build campaign URLs with explicit UTM parameters while preserving unrelated URL semantics.",
  aliases: ["campaign url builder", "utm link builder"],
  jobs: ["build campaign link", "add utm parameters", "create tracking url"],
  category: "marketing",
  inputTypes: ["url", "text"],
  implementation: "../tools/utm-builder/module.ts",
  engine: "campaign-url",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reuse", "reset"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-061", fixtureFamilies: ["utm-roundtrip", "url-percent-encoding"] },
} as const satisfies ToolManifest;

export default utmBuilderManifest;
