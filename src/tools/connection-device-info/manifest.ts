import type { ToolManifest } from "../../catalog/manifest";

export const connectionDeviceInfoManifest = {
  id: "connection-device-info",
  route: "/tools/connection-device-info",
  name: "Connection and Device Information",
  summary: "Show support-oriented browser/device facts locally, with public IP as a separate disclosed network action.",
  aliases: ["browser device info", "connection information", "viewport dpr info", "public ip checker"],
  jobs: ["inspect browser and device facts", "inspect viewport and screen", "check public IP explicitly"],
  category: "developer",
  inputTypes: ["browser", "network"],
  capabilities: ["clipboard", "reference-network"],
  implementation: "../tools/connection-device-info/module.ts",
  engine: "browser-diagnostics",
  runtime: { location: "REFERENCE", network: "reference-only" },
  privacy: {
    class: "REFERENCE",
    disclosure: "I dati browser/dispositivo sono letti localmente. Solo il pulsante IP pubblico contatta api64.ipify.org, che riceve l'indirizzo IP e i normali metadati della richiesta HTTP.",
  },
  profileFields: [],
  result: { class: "reference-network", capabilities: ["copy", "retry", "reset", "provenance"] },
  gold: {
    maintenanceClass: "D",
    oracleEntryId: "cand-219",
    fixtureFamilies: ["browser-diagnostics"],
  },
} as const satisfies ToolManifest & {
  readonly privacy: { readonly class: "REFERENCE"; readonly disclosure: string };
};

export default connectionDeviceInfoManifest;
