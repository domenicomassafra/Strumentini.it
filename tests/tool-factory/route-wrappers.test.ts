import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readRouteWrapperSpecs, renderRouteWrapper } from "../../src/tool-factory/route-wrappers";

const root = resolve(import.meta.dirname, "../..");

describe("generated Astro tool routes (#503)", () => {
  it("preserves the exact catalog-backed standard route set", async () => {
    const specs = await readRouteWrapperSpecs(root);
    expect(specs).toHaveLength(256);
    expect(new Set(specs.map(([id]) => id)).size).toBe(specs.length);
    expect(specs.find(([id]) => id === "pdf-compression-lite")).toEqual([
      "pdf-compression-lite", "../../components/tools/PdfCompressionLiteTool", "PdfCompressionLiteTool",
    ]);
  });

  it("keeps a local Preact island with client:load and an explicit tool id", async () => {
    const specs = await readRouteWrapperSpecs(root);
    const route = specs.find(([id]) => id === "pdf-compression-lite");
    expect(route).toBeDefined();
    if (route === undefined) return;
    const markup = renderRouteWrapper(route);
    expect(markup).toContain('import { PdfCompressionLiteTool } from "../../components/tools/PdfCompressionLiteTool";');
    expect(markup).toContain('<ItalianToolPage toolId="pdf-compression-lite">');
    expect(markup).toContain('<PdfCompressionLiteTool client:load />');
    expect(markup).not.toContain("client:only");
    expect(markup).not.toContain("client:idle");
  });

  it("materializes the same route source used by Astro and existing audits", async () => {
    const specs = await readRouteWrapperSpecs(root);
    for (const spec of specs) {
      const path = resolve(root, "src/pages/tools", `${spec[0]}.astro`);
      expect(await readFile(path, "utf8")).toBe(renderRouteWrapper(spec));
    }
  });
});
