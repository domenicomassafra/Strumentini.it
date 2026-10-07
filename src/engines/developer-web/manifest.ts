import type { MaintenanceClass, ResultDeclaration, ToolCapability, ToolManifest } from "../../catalog/manifest";

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
  readonly capabilities?: readonly ToolCapability[];
}

const DEVELOPER_VALIDATOR_IDS = new Set(["jwt-inspector", "regex-tester"]);
const DEVELOPER_REUSABLE_TEXT_IDS = new Set([
  "json-formatter",
  "yaml-formatter",
  "toml-formatter",
  "json-yaml-converter",
  "url-codec",
  "html-entity-codec",
  "base64-codec",
  "query-string-editor",
  "base-converter",
  "chmod-permission-helper",
  "json-repair",
  "xml-formatter-validator",
  "css-minifier",
  "html-minifier",
]);

export function developerResultDeclaration(id: string): ResultDeclaration {
  if (DEVELOPER_VALIDATOR_IDS.has(id)) {
    return { class: "validator", capabilities: ["copy", "download", "retry", "reset"] };
  }
  return {
    class: "text-code",
    capabilities: [
      "copy",
      "download",
      ...(DEVELOPER_REUSABLE_TEXT_IDS.has(id) ? ["reuse"] as const : []),
      "reset",
    ],
  };
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
    ...(spec.capabilities === undefined ? {} : { capabilities: [...spec.capabilities] }),
    implementation: `../tools/${spec.id}/module.ts`,
    engine: "developer-web",
    runtime: { location: "LOCAL", network: "forbidden" },
    profileFields: [],
    result: developerResultDeclaration(spec.id),
    gold: {
      maintenanceClass: spec.maintenanceClass ?? "E",
      oracleEntryId: spec.oracleEntryId,
      fixtureFamilies: [...spec.fixtureFamilies, "developer-web-gold"],
    },
  };
}
