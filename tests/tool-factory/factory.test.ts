import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { businessDayManifest } from "../../src/tools/business-day/manifest";
import {
  assertGeneratedCatalogCurrent,
  compileFactoryCatalog,
  renderCatalogSource,
  renderLoaderSource,
} from "../../src/tool-factory/catalog";
import { ToolFactoryValidationError, type FixtureIndex, type OracleRegistry } from "../../src/tool-factory/manifest";
import { createToolScaffold } from "../../src/tool-factory/scaffold";

const validScaffold = {
  id: "factory-demo",
  name: "Factory Demo",
  summary: "Exercise the local tool factory seam.",
  category: "text",
  engine: "text-list",
  jobs: ["exercise the factory"],
  gold: {
    maintenanceClass: "E" as const,
    oracleEntryId: "cand-001",
    fixtureFamilies: ["list-set-ops"],
  },
};

function issueText(action: () => unknown): string {
  try {
    action();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("tool factory", () => {
  it("creates a valid standard tool scaffold without eager runtime code", () => {
    const scaffold = createToolScaffold(validScaffold);
    expect(scaffold.manifest.route).toBe("/tools/factory-demo");
    expect(scaffold.files.map(({ path }) => path)).toEqual([
      "src/tools/factory-demo/manifest.ts",
      "src/tools/factory-demo/module.ts",
      "src/components/tools/FactoryDemoTool.tsx",
      "src/pages/tools/factory-demo.astro",
      "tests/tool-factory/factory-demo.test.ts",
      "tests/tool-factory/factory-demo.gold.test.ts",
    ]);
    expect(scaffold.files.find(({ path }) => path.endsWith("module.ts"))?.content).toContain("TOOL_IMPLEMENTATION_REQUIRED");
    expect(scaffold.files.find(({ path }) => path.endsWith("factory-demo.gold.test.ts"))?.content).toContain("test.todo");
    const compiled = compileFactoryCatalog([scaffold.manifest]);
    expect(compiled.routeMap["factory-demo"]).toBe("/tools/factory-demo");
    expect(compiled.loaders).toEqual([{ id: "factory-demo", implementation: "../tools/factory-demo/module.ts" }]);
  });

  it("fails duplicate ids, routes, aliases, and jobs", () => {
    const duplicate = { ...businessDayManifest, aliases: ["shared alias"], jobs: ["shared job"] };
    const other = {
      ...duplicate,
      id: "other-tool",
      route: "/tools/other-tool",
      implementation: "../tools/other-tool/module.ts",
    };
    const text = issueText(() => compileFactoryCatalog([duplicate, other]));
    expect(text).toContain("alias \"shared alias\" duplicates business-day");
    expect(text).toContain("job \"shared job\" duplicates business-day");
    const same = issueText(() => compileFactoryCatalog([businessDayManifest, businessDayManifest]));
    expect(same).toContain("duplicate tool id");
    expect(same).toContain("duplicate tool route");
  });

  it("fails duplicate public names and summaries", () => {
    const duplicateSummary = {
      ...businessDayManifest,
      id: "other-tool",
      route: "/tools/other-tool",
      implementation: "../tools/other-tool/module.ts",
      name: "Other Tool",
    };
    expect(issueText(() => compileFactoryCatalog([businessDayManifest, duplicateSummary]))).toContain("duplicate tool summary");

    const duplicateName = {
      ...businessDayManifest,
      id: "other-tool",
      route: "/tools/other-tool",
      implementation: "../tools/other-tool/module.ts",
      summary: "A distinct public summary.",
    };
    expect(issueText(() => compileFactoryCatalog([businessDayManifest, duplicateName]))).toContain("duplicate tool name");
  });

  it("fails malformed manifests and mismatched canonical routes", () => {
    const badRoute = { ...businessDayManifest, route: "/tools/not-business-day" };
    expect(issueText(() => compileFactoryCatalog([badRoute]))).toContain("route must be /tools/business-day");
    const badSchema = { ...businessDayManifest, unexpected: true };
    expect(issueText(() => compileFactoryCatalog([badSchema]))).toContain("manifest[0]");
    expect(() => createToolScaffold({ ...validScaffold, id: "Bad_Id" })).toThrow(ToolFactoryValidationError);
  });

  it("fails missing oracle and fixture bindings", () => {
    const registry: OracleRegistry = { entries: [] };
    const fixtureIndex: FixtureIndex = { families: [] };
    const text = issueText(() => compileFactoryCatalog([businessDayManifest], {
      oracleRegistry: registry,
      fixtureIndex,
      requireOracleBindings: true,
    }));
    expect(text).toContain("oracle registry entry not found: cand-083");
    expect(text).toContain("fixture family not found: business-days");
  });

  it("fails privacy and dependency policy contradictions", () => {
    const privacy = {
      ...businessDayManifest,
      capabilities: ["content-network"],
    };
    expect(issueText(() => compileFactoryCatalog([privacy]))).toContain("LOCAL tools cannot declare network capabilities");
    const remote = {
      ...businessDayManifest,
      privacyClass: "REMOTE" as const,
      privacy: { class: "REMOTE" as const, disclosure: "Content is sent to the selected service." },
      runtime: { location: "REMOTE" as const, network: "forbidden" as const },
    };
    expect(issueText(() => compileFactoryCatalog([remote]))).toContain("REMOTE tools must declare network=required");
    const dependency = { ...businessDayManifest, dependencies: [{ name: "pkg", version: "1.0.0", license: "MIT" }] };
    expect(compileFactoryCatalog([dependency]).dependencyInventory[0]?.toolIds).toEqual(["business-day"]);
  });

  it("keeps generated catalog output deterministic and current", async () => {
    const toolsRoot = new URL("../../src/tools/", import.meta.url);
    const entries = await readdir(toolsRoot, { withFileTypes: true });
    const manifests: unknown[] = [];
    for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory()) continue;
      const manifestUrl = new URL(`${entry.name}/manifest.ts`, toolsRoot);
      try {
        await readFile(manifestUrl, "utf8");
      } catch {
        continue;
      }
      const imported = await import(`${manifestUrl.href}?factory-test=${Date.now()}`) as { default?: unknown };
      if (imported.default !== undefined) manifests.push(imported.default);
    }
    const registry = JSON.parse(await readFile(new URL("../../quality/oracles/registry.json", import.meta.url), "utf8")) as OracleRegistry;
    const fixtureIndex = JSON.parse(await readFile(new URL("../../quality/fixtures/index.json", import.meta.url), "utf8")) as FixtureIndex;
    const artifacts = compileFactoryCatalog(manifests, {
      oracleRegistry: registry,
      fixtureIndex,
      requireOracleBindings: true,
    });
    const catalog = await readFile(new URL("../../src/generated/catalog.ts", import.meta.url), "utf8");
    const loaders = await readFile(new URL("../../src/generated/tool-loaders.ts", import.meta.url), "utf8");
    expect(catalog).toBe(renderCatalogSource(artifacts));
    expect(loaders).toBe(renderLoaderSource(artifacts));
    expect(() => assertGeneratedCatalogCurrent(artifacts, { catalog, loaders })).not.toThrow();
  }, 30_000);
});
