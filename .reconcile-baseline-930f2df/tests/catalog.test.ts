import { describe, expect, it } from "vitest";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import { CatalogCompileError, compileCatalog } from "../scripts/lib/catalog-compiler";

describe("catalog compilation seam", () => {
  it("compiles one canonical manifest into metadata and lazy loader metadata", () => {
    const compiled = compileCatalog([businessDayManifest]);
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
    expect(() => compileCatalog([businessDayManifest, businessDayManifest])).toThrow(CatalogCompileError);
  });

  it("fails LOCAL manifests that permit network", () => {
    const invalid = {
      ...businessDayManifest,
      runtime: { location: "LOCAL", network: "required" },
    };
    expect(() => compileCatalog([invalid])).toThrow(/LOCAL tools must declare network=forbidden/u);
  });
});
