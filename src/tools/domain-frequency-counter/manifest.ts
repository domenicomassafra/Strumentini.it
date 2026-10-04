import type { ToolManifest } from "../../catalog/manifest";

export const domainFrequencyCounterManifest = {
  id: "domain-frequency-counter",
  route: "/tools/domain-frequency-counter",
  name: "Domain / Source Frequency Counter",
  summary: "Count research URLs by normalized domain and sort the frequency table deterministically.",
  aliases: ["source frequency", "domain counter", "research source tally"],
  jobs: ["count source domains", "tally research urls", "summarize source frequency"],
  category: "research",
  inputTypes: ["url", "lines"],
  implementation: "../tools/domain-frequency-counter/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-195", fixtureFamilies: ["research-source-inventory"] },
} as const satisfies ToolManifest;

export default domainFrequencyCounterManifest;
