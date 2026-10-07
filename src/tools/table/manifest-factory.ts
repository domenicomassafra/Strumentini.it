import type { FactoryToolManifest } from "../../tool-factory/manifest";
import type { ResultCapability } from "../../catalog/manifest";

export interface TableManifestSpec {
  id: string;
  name: string;
  summary: string;
  aliases: readonly string[];
  jobs: readonly string[];
  inputTypes: readonly string[];
  keywords: readonly string[];
  packIds?: readonly string[];
  roleTags?: readonly string[];
  gold: FactoryToolManifest["gold"];
  handoff?: FactoryToolManifest["handoff"];
  component: string;
  clientDirective?: "load" | "idle" | "visible";
}

export function makeTableManifest(spec: TableManifestSpec): FactoryToolManifest {
  const emitsCsv = (spec.handoff?.emits ?? []).some((descriptor) => descriptor.type === "table" && descriptor.format === "csv");
  const acceptsCsv = (spec.handoff?.accepts ?? []).some((descriptor) => descriptor.type === "table" && descriptor.format === "csv");
  const resultCapabilities: ResultCapability[] = ["copy", "download"];
  if (emitsCsv && acceptsCsv) resultCapabilities.push("reuse");
  if (emitsCsv) resultCapabilities.push("handoff");
  resultCapabilities.push("reset");
  return {
    id: spec.id,
    route: `/tools/${spec.id}`,
    name: spec.name,
    summary: spec.summary,
    aliases: [...spec.aliases],
    keywords: [...spec.keywords],
    jobs: [...spec.jobs],
    category: "data",
    inputTypes: [...spec.inputTypes],
    packIds: [...(spec.packIds ?? ["data-cleanup", "research-evidence"])],
    roleTags: [...(spec.roleTags ?? ["data", "knowledge-work"])],
    implementation: `../tools/${spec.id}/module.ts`,
    engine: "table-operations",
    runtime: { location: "LOCAL", network: "forbidden" },
    privacyClass: "LOCAL",
    capabilities: ["file-read", "file-write"],
    profileFields: [],
    ...(spec.handoff === undefined ? {} : { handoff: spec.handoff }),
    result: { class: "table", capabilities: resultCapabilities },
    gold: spec.gold,
    version: "0.1.0",
    deterministic: true,
    dependencies: [],
    lazyDependencies: [],
    bundle: { eager: false, lazy: true, initialBytes: 0, maxBytes: 250_000 },
    offline: "FULL",
    acceptance: {
      independentOracle: true,
      fixtureFamilies: [...spec.gold.fixtureFamilies],
      privacy: true,
      accessibility: true,
      bundle: true,
    },
    page: { component: spec.component, clientDirective: spec.clientDirective ?? "load" },
  };
}

export function tableHandoff(maxBytes = 10 * 1024 * 1024) {
  return {
    accepts: [{ type: "table" as const, format: "csv" as const, maxBytes, requiresUniqueHeaders: false, acceptsRaggedRows: true }],
    emits: [{ type: "table" as const, format: "csv" as const }],
  };
}
