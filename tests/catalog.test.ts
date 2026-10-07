import { describe, expect, it } from "vitest";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import { catalog } from "../src/generated/catalog";
import { groupForCategory, groups, toolsInGroup } from "../src/catalog/groups";
import { compileFactoryCatalog, renderCatalogSource } from "../src/tool-factory/catalog";
import { ToolFactoryValidationError } from "../src/tool-factory/manifest";

describe("catalog compilation seam", () => {
  it("keeps every generated tool reachable through exactly one public catalog group", () => {
    const groupedIds = groups.flatMap((group) => toolsInGroup(group).map((tool) => tool.id));
    expect(groupedIds).toHaveLength(catalog.length);
    expect(new Set(groupedIds).size).toBe(catalog.length);
    expect(new Set(groupedIds)).toEqual(new Set(catalog.map((tool) => tool.id)));
    expect(groupForCategory("media").slug).toBe("file");
  });

  it("compiles one canonical manifest into metadata and lazy loader metadata", () => {
    const compiled = compileFactoryCatalog([businessDayManifest]);
    expect(compiled.summaries).toHaveLength(1);
    expect(compiled.summaries[0]).toMatchObject({
      id: "business-day",
      route: "/tools/business-day",
      runtime: { location: "LOCAL", network: "forbidden" },
      gold: { oracleEntryId: "cand-083", fixtureFamilies: ["business-days"] },
    });
    expect(compiled.loaders).toEqual([
      { id: "business-day", implementation: "../tools/business-day/module.ts" },
    ]);
  });

  it("fails duplicate ids and routes", () => {
    expect(() => compileFactoryCatalog([businessDayManifest, businessDayManifest])).toThrow(ToolFactoryValidationError);
  });

  it("fails LOCAL manifests that permit network", () => {
    const invalid = {
      ...businessDayManifest,
      runtime: { location: "LOCAL", network: "required" },
    };
    expect(() => compileFactoryCatalog([invalid])).toThrow(/LOCAL tools must declare network=forbidden/u);
  });

  it("fails duplicate public names and summaries", () => {
    const duplicateSummary = {
      ...businessDayManifest,
      id: "other-tool",
      route: "/tools/other-tool",
      name: "Other Tool",
      implementation: "../tools/other-tool/module.ts",
    };
    expect(() => compileFactoryCatalog([businessDayManifest, duplicateSummary])).toThrow(/duplicate tool summary/u);

    const duplicateName = {
      ...businessDayManifest,
      id: "other-tool",
      route: "/tools/other-tool",
      summary: "A distinct public summary.",
      implementation: "../tools/other-tool/module.ts",
    };
    expect(() => compileFactoryCatalog([businessDayManifest, duplicateName])).toThrow(/duplicate tool name/u);

    const longSummary = {
      ...businessDayManifest,
      summary: "x".repeat(161),
    };
    expect(() => compileFactoryCatalog([longSummary])).toThrow();
  });
  it("preserves typed handoff descriptors and rejects duplicate declarations", () => {
    const withHandoff = {
      ...businessDayManifest,
      handoff: { emits: [{ type: "table" as const, format: "csv" }] },
    };
    expect(compileFactoryCatalog([withHandoff]).summaries[0]?.handoff).toEqual(withHandoff.handoff);
    const invalid = {
      ...withHandoff,
      handoff: { accepts: [{ type: "table" as const, format: "csv" }, { type: "table" as const, format: "csv" }] },
    };
    expect(() => compileFactoryCatalog([invalid])).toThrow(/duplicate handoff accepts descriptor/u);
  });

  it("preserves semantic Result v2 declarations in catalog summaries", () => {
    const withResult = {
      ...businessDayManifest,
      result: {
        class: "calculator" as const,
        capabilities: ["copy", "provenance"] as const,
      },
    };
    const compiled = compileFactoryCatalog([withResult]);
    const summary = compiled.summaries[0];
    expect(summary?.result).toEqual(withResult.result);
    expect(summary?.result).not.toHaveProperty("renderer");
    const generated = renderCatalogSource(compiled);
    expect(generated).toContain('"result": {');
    expect(generated).toContain('"class": "calculator"');
    expect(generated).not.toContain("renderer");
  });

  it("rejects unknown or renderer-specific Result v2 declarations", () => {
    expect(() => compileFactoryCatalog([{
      ...businessDayManifest,
      result: { class: "calculator" },
    }])).toThrow(/result\.capabilities/u);
    expect(() => compileFactoryCatalog([{
      ...businessDayManifest,
      result: { class: "generic", capabilities: [] },
    }])).toThrow(/result\.class/u);
    expect(() => compileFactoryCatalog([{
      ...businessDayManifest,
      result: { class: "calculator", capabilities: ["print"] },
    }])).toThrow(/result\.capabilities\.0/u);
    expect(() => compileFactoryCatalog([{
      ...businessDayManifest,
      result: { class: "calculator", capabilities: [], renderer: "CalculatorResult" },
    }])).toThrow(/result: Unrecognized key/u);
    expect(() => compileFactoryCatalog([{
      ...businessDayManifest,
      result: { class: "calculator", capabilities: ["copy", "copy"] },
    }])).toThrow(/duplicate value "copy"/u);
  });
});
