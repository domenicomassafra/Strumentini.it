import type { MaintenanceClass, ToolManifest } from "../../catalog/manifest";

export interface DeveloperWebManifestSpec {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly aliases: readonly string[];
  readonly jobs: readonly string[];
  readonly inputTypes: readonly string[];
  readonly oracleEntryId: string;
  readonly fixtureFamilies: readonly string[];
  readonly maintenanceClass?: MaintenanceClass;
}

export function defineDeveloperWebManifest(spec: DeveloperWebManifestSpec): ToolManifest {
  return {
    id: spec.id,
    route: `/tools/${spec.id}`,
    name: spec.name,
    summary: spec.summary,
    aliases: [...spec.aliases],
    jobs: [...spec.jobs],
    category: "developer",
    inputTypes: [...spec.inputTypes],
    implementation: `../tools/${spec.id}/module.ts`,
    engine: "developer-web",
    runtime: { location: "LOCAL", network: "forbidden" },
    profileFields: [],
    gold: {
      maintenanceClass: spec.maintenanceClass ?? "E",
      oracleEntryId: spec.oracleEntryId,
      fixtureFamilies: [...spec.fixtureFamilies],
    },
  };
}
