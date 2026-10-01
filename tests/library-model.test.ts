import { describe, expect, it } from "vitest";
import { filterLibrary, getLibraryFacets, paginateLibrary } from "../src/library/model";
import type { SearchToolMetadata } from "../src/search/types";

const fixture = (index: number): SearchToolMetadata => ({
  id: `fixture-${String(index).padStart(3, "0")}`,
  route: `/tools/fixture-${index}`,
  name: `Fixture Tool ${index}`,
  summary: `Fixture ${index}`,
  aliases: index % 10 === 0 ? ["batch helper"] : [],
  jobs: [index % 2 === 0 ? "convert table" : "clean text"],
  category: index % 2 === 0 ? "data" : "text",
  roleTags: index % 5 === 0 ? ["operations"] : [],
  packTags: index % 7 === 0 ? ["ops-core"] : [],
  inputTypes: [index % 2 === 0 ? "table" : "text"],
  engine: "fixture",
  runtime: index % 3 === 0
    ? { location: "REMOTE", network: "required" }
    : { location: "LOCAL", network: "forbidden" },
  quality: index % 4 === 0 ? "verified" : "checking",
});

describe("library model seam", () => {
  const tools = Array.from({ length: 500 }, (_, index) => fixture(index));

  it("keeps the 500-tool catalog bounded to one page of DOM rows", () => {
    const page = paginateLibrary(tools, 1, 50);
    expect(page.total).toBe(500);
    expect(page.pageCount).toBe(10);
    expect(page.items).toHaveLength(50);
    expect(page.items[0]?.id).toBe("fixture-000");
    expect(page.items[49]?.id).toBe("fixture-049");
  });

  it("filters deterministically by query, facets, runtime, and install state", () => {
    const result = filterLibrary(tools, {
      query: "convert table",
      category: "data",
      inputType: "table",
      runtime: "local",
      installState: "installed",
      quality: "verified",
    }, { installedToolIds: tools.filter((_, index) => index % 4 === 0).map(({ id }) => id) });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every(({ category }) => category === "data")).toBe(true);
    expect(result.every(({ runtime }) => runtime.location === "LOCAL")).toBe(true);
    expect(result.every(({ id }) => Number(id.slice(-3)) % 4 === 0)).toBe(true);
    expect(result.every(({ quality }) => quality === "verified")).toBe(true);
  });

  it("derives only present facets from metadata", () => {
    const facets = getLibraryFacets(tools);
    expect(facets.categories).toEqual(["data", "text"]);
    expect(facets.inputTypes).toEqual(["table", "text"]);
    expect(facets.roleTags).toEqual(["operations"]);
    expect(facets.packTags).toEqual(["ops-core"]);
  });
});
