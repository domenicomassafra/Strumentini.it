import type {
  HandoffToolSummary,
  ResultDeclaration,
  RuntimeToolIndexEntry,
  ToolSummary,
  WorkbenchToolSummary,
} from "./manifest";
import type { SearchToolMetadata } from "../search/types";

export interface SearchProjectionDecoration {
  readonly packTags?: readonly string[];
  readonly roleTags?: readonly string[];
  readonly quality?: "verified" | "checking";
  readonly keywords?: readonly string[];
}

export interface CatalogProjections {
  readonly search: readonly SearchToolMetadata[];
  readonly workbench: readonly WorkbenchToolSummary[];
  readonly runtime: readonly RuntimeToolIndexEntry[];
  readonly handoff: readonly HandoffToolSummary[];
}

export interface ResultV2RendererSeam {
  readonly toolId: string;
  readonly kind: "shared" | "bespoke";
  readonly component: string;
  readonly source: string;
}

export interface ResultV2MigrationOwner {
  readonly toolId: string;
  readonly owner: string;
}

export type ResultV2DeclarationState =
  | { readonly state: "missing" }
  | {
      readonly state: "declared";
      readonly class: ResultDeclaration["class"];
      readonly capabilities: ResultDeclaration["capabilities"];
    };

export interface ResultV2InventoryEntry {
  readonly toolId: string;
  readonly engine: string;
  readonly rendererSeam: Omit<ResultV2RendererSeam, "toolId">;
  readonly resultDeclaration: ResultV2DeclarationState;
  readonly migrationOwner: string | null;
}

function searchMetadata(summary: ToolSummary, decoration: SearchProjectionDecoration | undefined): SearchToolMetadata {
  return {
    id: summary.id,
    route: summary.route,
    name: summary.name,
    summary: summary.summary,
    aliases: [...summary.aliases],
    jobs: [...summary.jobs],
    ...(decoration?.keywords === undefined ? {} : { keywords: [...decoration.keywords] }),
    category: summary.category,
    inputTypes: [...summary.inputTypes],
    engine: summary.engine,
    runtime: { ...summary.runtime },
    packTags: [...(decoration?.packTags ?? [])],
    roleTags: [...(decoration?.roleTags ?? [])],
    quality: decoration?.quality ?? "checking",
  };
}

function workbenchSummary(summary: ToolSummary): WorkbenchToolSummary {
  return {
    id: summary.id,
    route: summary.route,
    name: summary.name,
    summary: summary.summary,
    category: summary.category,
    inputTypes: [...summary.inputTypes],
    runtime: { ...summary.runtime },
    profileFields: summary.profileFields.map((field) => ({ ...field })),
    ...(summary.handoff === undefined ? {} : { handoff: summary.handoff }),
  };
}

function runtimeIndexEntry(summary: ToolSummary): RuntimeToolIndexEntry {
  return {
    id: summary.id,
    route: summary.route,
    name: summary.name,
    category: summary.category,
    profileFields: summary.profileFields.map((field) => ({ ...field })),
  };
}

function handoffSummary(summary: ToolSummary): HandoffToolSummary | undefined {
  if (summary.handoff?.accepts === undefined || summary.handoff.accepts.length === 0) return undefined;
  return { id: summary.id, route: summary.route, name: summary.name, handoff: summary.handoff };
}

export function projectCatalog(
  summaries: readonly ToolSummary[],
  searchDecorations: ReadonlyMap<string, SearchProjectionDecoration> = new Map(),
): CatalogProjections {
  return {
    search: summaries.map((summary) => searchMetadata(summary, searchDecorations.get(summary.id))),
    workbench: summaries.map(workbenchSummary),
    runtime: summaries.map(runtimeIndexEntry),
    handoff: summaries.flatMap((summary) => {
      const target = handoffSummary(summary);
      return target === undefined ? [] : [target];
    }),
  };
}

function uniqueByToolId<T extends { readonly toolId: string }>(
  values: readonly T[],
  label: string,
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const value of values) {
    if (byId.has(value.toolId)) throw new Error(`Result v2 inventory: duplicate ${label} id ${value.toolId}`);
    byId.set(value.toolId, value);
  }
  return byId;
}

export function projectResultV2Inventory(
  summaries: readonly ToolSummary[],
  rendererSeams: readonly ResultV2RendererSeam[],
  migrationOwners: readonly ResultV2MigrationOwner[] = [],
): readonly ResultV2InventoryEntry[] {
  const catalogIds = new Set<string>();
  for (const summary of summaries) {
    if (catalogIds.has(summary.id)) throw new Error(`Result v2 inventory: duplicate catalog id ${summary.id}`);
    catalogIds.add(summary.id);
  }

  const seamById = uniqueByToolId(rendererSeams, "renderer seam");
  const ownerById = uniqueByToolId(migrationOwners, "migration owner");
  for (const toolId of seamById.keys()) {
    if (!catalogIds.has(toolId)) throw new Error(`Result v2 inventory: renderer seam id is not in catalog: ${toolId}`);
  }
  for (const toolId of ownerById.keys()) {
    if (!catalogIds.has(toolId)) throw new Error(`Result v2 inventory: migration owner id is not in catalog: ${toolId}`);
  }

  return summaries
    .toSorted((left, right) => left.id.localeCompare(right.id, "it-IT"))
    .map((summary) => {
      const seam = seamById.get(summary.id);
      if (seam === undefined) throw new Error(`Result v2 inventory: missing renderer seam for catalog id ${summary.id}`);
      const owner = ownerById.get(summary.id);
      return {
        toolId: summary.id,
        engine: summary.engine,
        rendererSeam: {
          kind: seam.kind,
          component: seam.component,
          source: seam.source,
        },
        resultDeclaration: summary.result === undefined
          ? { state: "missing" as const }
          : {
              state: "declared" as const,
              class: summary.result.class,
              capabilities: [...summary.result.capabilities],
            },
        migrationOwner: owner?.owner ?? null,
      };
    });
}

const generatedHeader = "// AUTO-GENERATED by scripts/tool-factory/generate-catalog.ts. Do not edit.\n";

function renderArraySource(
  exportName: string,
  typeImport: string,
  typeName: string,
  values: readonly unknown[],
  pretty = false,
): string {
  return `${generatedHeader}import type { ${typeName} } from "${typeImport}";\n\n` +
    `export const ${exportName} = ${JSON.stringify(values, null, pretty ? 2 : undefined)} as const satisfies readonly ${typeName}[];\n`;
}

export function renderCatalogSource(summaries: readonly ToolSummary[]): string {
  return renderArraySource("catalog", "../catalog/manifest", "ToolSummary", summaries, true);
}

export function renderResultV2InventorySource(entries: readonly ResultV2InventoryEntry[]): string {
  return renderArraySource("resultV2Inventory", "./projections", "ResultV2InventoryEntry", entries, true);
}

export function renderLoaderSource(
  loaders: readonly { readonly id: string; readonly implementation: string }[],
): string {
  const loaderLines = loaders.map(
    ({ id, implementation }) => `  ${JSON.stringify(id)}: () => import(${JSON.stringify(implementation)}),`,
  );
  return `${generatedHeader}import type { ToolModule } from "../runtime/types";\n\n` +
    `export const toolLoaders: Readonly<Record<string, () => Promise<{ default: ToolModule }>>> = {\n${loaderLines.join("\n")}\n};\n`;
}

export function renderCatalogSources(
  summaries: readonly ToolSummary[],
  loaders: readonly { readonly id: string; readonly implementation: string }[],
  searchDecorations: ReadonlyMap<string, SearchProjectionDecoration> = new Map(),
): Readonly<Record<"catalog" | "loaders" | "searchCatalog" | "workbenchCatalog" | "runtimeToolIndex" | "handoffCatalog", string>> {
  const projections = projectCatalog(summaries, searchDecorations);
  return {
    catalog: renderCatalogSource(summaries),
    loaders: renderLoaderSource(loaders),
    searchCatalog: renderArraySource("searchCatalog", "../search/types", "SearchToolMetadata", projections.search),
    workbenchCatalog: renderArraySource("workbenchCatalog", "../catalog/manifest", "WorkbenchToolSummary", projections.workbench),
    runtimeToolIndex: renderArraySource("runtimeToolIndex", "../catalog/manifest", "RuntimeToolIndexEntry", projections.runtime),
    handoffCatalog: renderArraySource("handoffCatalog", "../catalog/manifest", "HandoffToolSummary", projections.handoff),
  };
}
