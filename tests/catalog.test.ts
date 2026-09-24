import { describe, expect, it } from "vitest";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import { compileFactoryCatalog } from "../src/tool-factory/catalog";
import { ToolFactoryValidationError } from "../src/tool-factory/manifest";

describe("catalog compilation seam", () => {
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
});
