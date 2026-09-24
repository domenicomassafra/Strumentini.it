import { describe, expect, it } from "vitest";
import { compileFactoryCatalog } from "../src/tool-factory/catalog";
import { doiIsbnNormalizerManifest } from "../src/tools/doi-isbn-normalizer/manifest";
import { listCompareManifest } from "../src/tools/list-compare/manifest";
import { textDiffManifest } from "../src/tools/text-diff/manifest";

describe("Ticket 08 catalog seams", () => {
  it("compiles three independently openable and searchable LOCAL tools", () => {
    const manifests = [listCompareManifest, textDiffManifest, doiIsbnNormalizerManifest] as const;
    const compiled = compileFactoryCatalog(manifests);
    expect(compiled.summaries.map(({ id }) => id)).toEqual([
      "doi-isbn-normalizer",
      "list-compare",
      "text-diff",
    ]);
    expect(new Set(compiled.summaries.map(({ route }) => route)).size).toBe(3);
    for (const summary of compiled.summaries) {
      expect(summary.route).toBe(`/tools/${summary.id}`);
      expect(summary.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
      expect(summary.aliases.length).toBeGreaterThan(0);
      expect(summary.jobs.length).toBeGreaterThan(0);
    }
  });

  it("shares the deep text-list engine without collapsing tool identities", () => {
    expect(listCompareManifest.engine).toBe("text-list");
    expect(textDiffManifest.engine).toBe("text-list");
    expect(listCompareManifest.id).not.toBe(textDiffManifest.id);
    expect(listCompareManifest.route).not.toBe(textDiffManifest.route);
    expect(doiIsbnNormalizerManifest.engine).toBe("research-reference");
  });
});
