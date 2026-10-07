import type { ToolManifest } from "../../catalog/manifest";

export const redirectChainInspectorManifest = {
  id: "redirect-chain-inspector",
  route: "/tools/redirect-chain-inspector",
  name: "Redirect-Chain Inspector",
  summary: "Inspect pasted redirect hops locally or, after explicit submit, retrieve a live redirect chain with partial timeout and loop evidence.",
  aliases: ["redirect chain checker", "hop sequence inspector", "live redirect checker"],
  jobs: ["review a redirect chain", "inspect pasted hop statuses", "retrieve a redirect chain on request"],
  category: "web-operations",
  inputTypes: ["structured", "text"],
  capabilities: ["reference-network"],
  implementation: "../tools/redirect-chain-inspector/module.ts",
  engine: "url-marketing",
  runtime: { location: "REFERENCE", network: "reference-only" },
  privacy: {
    class: "REFERENCE",
    disclosure: "La modalità locale non usa la rete. Solo dopo il submit della modalità live il browser richiede l'URL iniziale e i target di redirect esposti dalla catena; gli altri dati dell'attività non vengono inviati.",
  },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-074", fixtureFamilies: ["url-security", "query-params"] },
} as const satisfies ToolManifest & {
  readonly privacy: { readonly class: "REFERENCE"; readonly disclosure: string };
};

export default redirectChainInspectorManifest;
