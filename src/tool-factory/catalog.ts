import type { ToolSummary } from "../catalog/manifest";
import { renderLegacyCatalogSource, renderLoaderSource as renderGeneratedLoaderSource } from "../catalog/projections";
import {
  collectManifestIssues,
  ToolFactoryValidationError,
  safeParseToolManifest,
  type FactoryToolManifest,
  type FactoryValidationContext,
  type FixtureIndex,
  type OracleRegistry,
} from "./manifest";

export type FactoryCatalogSummary = Omit<FactoryToolManifest, "implementation">;

export interface FactorySearchEntry {
  readonly id: string;
  readonly route: string;
  readonly name: string;
  readonly summary: string;
  readonly aliases: readonly string[];
  readonly jobs: readonly string[];
  readonly keywords: readonly string[];
  readonly category: string;
  readonly inputTypes: readonly string[];
  readonly packIds: readonly string[];
  readonly roleTags: readonly string[];
  readonly engine: string;
  readonly runtime: FactoryToolManifest["runtime"];
}

export interface FactoryLoaderEntry {
  readonly id: string;
  readonly implementation: string;
}

export type FactoryDependencyEntry = FactoryToolManifest["dependencies"][number] & {
  readonly toolIds: readonly string[];
};

export interface FactoryCertificationEntry {
  readonly id: string;
  readonly maintenanceClass: string;
  readonly oracleEntryId: string;
  readonly fixtureFamilies: readonly string[];
  readonly independentOracle: boolean;
}

export interface FactoryCatalogArtifacts {
  readonly summaries: readonly FactoryCatalogSummary[];
  readonly loaders: readonly FactoryLoaderEntry[];
  readonly routeMap: Readonly<Record<string, string>>;
  readonly searchIndex: readonly FactorySearchEntry[];
  readonly packIndex: Readonly<Record<string, readonly string[]>>;
  readonly dependencyInventory: readonly FactoryDependencyEntry[];
  readonly certifications: readonly FactoryCertificationEntry[];
}

export interface FactoryCatalogOptions extends FactoryValidationContext {
  readonly requireGoldOracle?: boolean;
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function summaryOf(manifest: FactoryToolManifest): FactoryCatalogSummary {
  const { implementation: _implementation, ...summary } = manifest;
  return summary;
}

function crossManifestIssues(manifests: readonly FactoryToolManifest[]): string[] {
  const issues: string[] = [];
  const ids = new Map<string, string>();
  const routes = new Map<string, string>();
  const aliases = new Map<string, string>();
  const jobs = new Map<string, string>();
  for (const manifest of manifests) {
    const previousId = ids.get(manifest.id);
    if (previousId !== undefined) issues.push(`${manifest.id}: duplicate tool id`);
    ids.set(manifest.id, manifest.id);
    const previousRoute = routes.get(manifest.route);
    if (previousRoute !== undefined) issues.push(`${manifest.route}: duplicate tool route`);
    routes.set(manifest.route, manifest.id);
    for (const alias of manifest.aliases) {
      const key = normalize(alias);
      const previous = aliases.get(key);
      if (previous !== undefined) issues.push(`${manifest.id}: alias ${JSON.stringify(alias)} duplicates ${previous}`);
      aliases.set(key, manifest.id);
    }
    for (const job of manifest.jobs) {
      const key = normalize(job);
      const previous = jobs.get(key);
      if (previous !== undefined) issues.push(`${manifest.id}: job ${JSON.stringify(job)} duplicates ${previous}`);
      jobs.set(key, manifest.id);
    }
  }
  for (const source of manifests) {
    for (const target of manifests) {
      if (source.id === target.id) continue;
      for (const emitted of source.handoff?.emits ?? []) {
        for (const accepted of target.handoff?.accepts ?? []) {
          if (emitted.type !== accepted.type) continue;
          if (emitted.format !== undefined && accepted.format !== undefined && emitted.format !== accepted.format) continue;
          if (emitted.acceptsRaggedRows === true && accepted.acceptsRaggedRows === false) {
            issues.push(`${source.id} -> ${target.id}: handoff ${emitted.type}:${emitted.format ?? "*"} emits ragged rows that the target rejects`);
          }
          if (emitted.requiresUniqueHeaders === false && accepted.requiresUniqueHeaders === true) {
            issues.push(`${source.id} -> ${target.id}: handoff ${emitted.type}:${emitted.format ?? "*"} emits non-unique headers that the target requires`);
          }
        }
      }
    }
  }
  return issues;
}

function buildPackIndex(manifests: readonly FactoryToolManifest[]): Record<string, readonly string[]> {
  const index: Record<string, string[]> = {};
  for (const manifest of manifests) {
    for (const packId of manifest.packIds) (index[packId] ??= []).push(manifest.id);
  }
  for (const packId of Object.keys(index).sort()) index[packId]?.sort((left, right) => left.localeCompare(right));
  return index;
}

function buildDependencyInventory(manifests: readonly FactoryToolManifest[]): FactoryDependencyEntry[] {
  const byName = new Map<string, { dependency: FactoryToolManifest["dependencies"][number]; toolIds: string[] }>();
  for (const manifest of manifests) {
    for (const dependency of manifest.dependencies) {
      const current = byName.get(dependency.name);
      if (current === undefined) {
        byName.set(dependency.name, { dependency, toolIds: [manifest.id] });
      } else {
        current.toolIds.push(manifest.id);
      }
    }
  }
  return [...byName.values()]
    .sort((left, right) => left.dependency.name.localeCompare(right.dependency.name))
    .map(({ dependency, toolIds }) => ({
      ...dependency,
      toolIds: toolIds.toSorted((left, right) => left.localeCompare(right)),
    }));
}

function buildSearchIndex(manifests: readonly FactoryToolManifest[]): FactorySearchEntry[] {
  return manifests.map((manifest) => ({
    id: manifest.id,
    route: manifest.route,
    name: manifest.name,
    summary: manifest.summary,
    aliases: [...manifest.aliases],
    jobs: [...manifest.jobs],
    keywords: [...manifest.keywords],
    category: manifest.category,
    inputTypes: [...manifest.inputTypes],
    packIds: [...manifest.packIds],
    roleTags: [...manifest.roleTags],
    engine: manifest.engine,
    runtime: { ...manifest.runtime },
  }));
}

export function compileFactoryCatalog(
  rawManifests: readonly unknown[],
  options: FactoryCatalogOptions = {},
): FactoryCatalogArtifacts {
  const issues: string[] = [];
  const manifests: FactoryToolManifest[] = [];
  rawManifests.forEach((raw, index) => {
    const parsed = safeParseToolManifest(raw);
    if (!parsed.ok) {
      issues.push(`manifest[${index}]: ${parsed.issues.join("; ")}`);
      return;
    }
    manifests.push(parsed.value);
    issues.push(...collectManifestIssues(parsed.value, options).map((issue) => `manifest[${index}]: ${issue}`));
  });
  if (options.requireGoldOracle === true) {
    for (const manifest of manifests) {
      if (manifest.acceptance.independentOracle !== true) {
        issues.push(`${manifest.id}: Gold oracle is required`);
      }
    }
  }
  issues.push(...crossManifestIssues(manifests));
  if (issues.length > 0) throw new ToolFactoryValidationError(issues);

  const sorted = manifests.toSorted((left, right) => left.id.localeCompare(right.id));
  const routeMap: Record<string, string> = {};
  for (const manifest of sorted) routeMap[manifest.id] = manifest.route;
  return {
    summaries: sorted.map(summaryOf),
    loaders: sorted.map(({ id, implementation }) => ({ id, implementation })),
    routeMap,
    searchIndex: buildSearchIndex(sorted),
    packIndex: buildPackIndex(sorted),
    dependencyInventory: buildDependencyInventory(sorted),
    certifications: sorted.map((manifest) => ({
      id: manifest.id,
      maintenanceClass: manifest.gold.maintenanceClass,
      oracleEntryId: manifest.gold.oracleEntryId,
      fixtureFamilies: [...manifest.gold.fixtureFamilies],
      independentOracle: manifest.acceptance.independentOracle,
    })),
  };
}

export function toLegacyCatalogSummary(summary: FactoryCatalogSummary): ToolSummary {
  return {
    id: summary.id,
    route: summary.route,
    name: summary.name,
    summary: summary.summary,
    aliases: summary.aliases,
    jobs: summary.jobs,
    category: summary.category,
    inputTypes: summary.inputTypes,
    engine: summary.engine,
    runtime: summary.runtime,
    profileFields: summary.profileFields,
    ...(summary.handoff === undefined ? {} : { handoff: summary.handoff }),
    gold: summary.gold,
  } as ToolSummary;
}

export function renderCatalogSource(artifacts: Pick<FactoryCatalogArtifacts, "summaries">): string {
  return renderLegacyCatalogSource(artifacts.summaries.map(toLegacyCatalogSummary));
}

export function renderLoaderSource(artifacts: Pick<FactoryCatalogArtifacts, "loaders">): string {
  return renderGeneratedLoaderSource(artifacts.loaders);
}

export function assertGeneratedCatalogCurrent(
  artifacts: FactoryCatalogArtifacts,
  files: Readonly<{ catalog: string; loaders: string }>,
): void {
  const expectedCatalog = renderCatalogSource(artifacts);
  const expectedLoaders = renderLoaderSource(artifacts);
  const differences: string[] = [];
  if (files.catalog !== expectedCatalog) differences.push("src/generated/catalog.ts");
  if (files.loaders !== expectedLoaders) differences.push("src/generated/tool-loaders.ts");
  if (differences.length > 0) throw new Error(`factory catalog output is stale: ${differences.join(", ")}`);
}

export function loadFactoryIndexes(registry: OracleRegistry, fixtureIndex: FixtureIndex): FactoryValidationContext {
  return {
    oracleRegistry: registry,
    fixtureIndex,
    requireOracleBindings: true,
    requireAcceptance: true,
  };
}

export const compileCatalog = compileFactoryCatalog;
