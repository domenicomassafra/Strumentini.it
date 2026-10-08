import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { resultV2Inventory } from "../src/catalog/result-v2-inventory.generated";
import { qualityIndex } from "../src/generated/quality";
import { toolRuntime } from "../src/runtime/tool-runtime";
import videoInspectorModule from "../src/tools/video-inspector/module";
import videoInspectorManifest from "../src/tools/video-inspector/manifest";

function videoFixture(): Blob {
  const data = readFileSync(new URL("../quality/fixtures/video-inspection/video-plus-audio.mp4", import.meta.url));
  return new Blob([new Uint8Array(data)]);
}

describe("STR-232 — public catalog registration", () => {
  it("registers an indexed LOCAL tool with an actual runtime loader and Italian copy", async () => {
    expect(catalog).toHaveLength(260);
    const entries = catalog.filter((tool) => tool.id === "video-inspector");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      route: "/tools/video-inspector",
      name: "Ispeziona MP4 e calcola il bitrate",
      runtime: { location: "LOCAL", network: "forbidden" },
      gold: { oracleEntryId: "cand-260", fixtureFamilies: ["video-inspection-mp4"] },
    });
    expect(videoInspectorManifest.capabilities).toContain("file-read");
    expect(toolRuntime.preflight("video-inspector").ok).toBe(true);
    const { toolLoaders } = await import("../src/generated/tool-loaders");
    const loader = toolLoaders["video-inspector"];
    expect(loader).toBeTypeOf("function");
    expect((await loader()).default.run).toBeTypeOf("function");
    expect(resultV2Inventory.find((entry) => entry.toolId === "video-inspector")).toMatchObject({
      engine: "video",
      rendererSeam: { component: "VideoInspectorTool", kind: "bespoke" },
      resultDeclaration: { state: "declared", class: "file" },
      migrationOwner: ".scratch/strumentini-expansion-20261005/issues/232-video-inspector-and-target-size-calculator.md",
    });
  });

  it("has independent fixture bindings without Gold certification", () => {
    const oracle = JSON.parse(readFileSync(new URL("../quality/oracles/registry.json", import.meta.url), "utf8"));
    const index = JSON.parse(readFileSync(new URL("../quality/fixtures/index.json", import.meta.url), "utf8"));
    const vectors = JSON.parse(readFileSync(new URL("../quality/fixtures/video-inspection/vectors.json", import.meta.url), "utf8"));
    expect(oracle.entry_count).toBe(260);
    expect(oracle.entries.find((entry: { id: string }) => entry.id === "cand-260")).toMatchObject({
      confidence: "medium",
      unresolved_gaps: expect.arrayContaining([expect.stringContaining("HEVC/VFR")]),
    });
    expect(index.families.find((entry: { id: string }) => entry.id === "video-inspection-mp4")).toMatchObject({
      path: "quality/fixtures/video-inspection/vectors.json",
    });
    for (const entry of vectors.files as { path: string }[]) {
      expect(readFileSync(new URL(`../${entry.path}`, import.meta.url)).length).toBeGreaterThan(0);
    }
    expect(qualityIndex.tools.some((tool: { toolId: string }) => tool.toolId === "video-inspector")).toBe(false);
  });

  it("runs bounded inspection and target-size planner through the registered module", async () => {
    const controller = new AbortController();
    const inspected = await videoInspectorModule.run({ operation: "inspect", file: videoFixture() }, { defaults: {} }, controller.signal);
    expect(inspected).toMatchObject({ videoTracks: 1, audioTracks: 1, durationSeconds: 1.2 });
    const planned = await videoInspectorModule.run({
      operation: "target-size", durationSeconds: 100, targetSize: 100, unit: "MB",
    }, { defaults: {} });
    expect(planned).toMatchObject({ totalStreamBitrateBps: 8_000_000, videoBitrateBps: null, achievesTargetSize: "unknown" });
    await expect(videoInspectorModule.run({ operation: "inspect", file: new Blob(["invalid"]) }, { defaults: {} }))
      .rejects.toThrow(/UNSUPPORTED_VIDEO_CONTAINER/u);
    expect(() => videoInspectorModule.run({ operation: "transcode" }, { defaults: {} }))
      .toThrow(/INVALID_VIDEO_INPUT/u);
  });
});
