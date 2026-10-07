import { describe, expect, it } from "vitest";
import type { HandoffToolSummary, ToolSummary } from "../src/catalog/manifest";
import { catalog } from "../src/generated/catalog";
import { handoffCatalog } from "../src/generated/handoff-catalog";
import {
  MAX_RELATED_TOOL_SUGGESTIONS,
  buildRelatedToolGraph,
} from "../src/runtime/related-tool-graph";

function tool(
  id: string,
  overrides: Partial<ToolSummary> = {},
): ToolSummary {
  return {
    id,
    route: `/tools/${id}`,
    name: id,
    summary: `Summary for ${id}`,
    aliases: [],
    jobs: [`job-${id}`],
    category: "test",
    inputTypes: ["text"],
    capabilities: [],
    engine: "test",
    runtime: { location: "LOCAL", network: "forbidden" },
    profileFields: [],
    gold: { maintenanceClass: "E", oracleEntryId: "cand-001", fixtureFamilies: ["test"] },
    ...overrides,
  };
}

function handoffTargets(tools: readonly ToolSummary[]): readonly HandoffToolSummary[] {
  return tools.flatMap((entry) => {
    const handoff = entry.handoff;
    if (handoff === undefined || (handoff.accepts ?? []).length === 0) return [];
    return [{ id: entry.id, route: entry.route, name: entry.name, handoff }];
  });
}

describe("related-tool and handoff graph policy", () => {
  it("keeps executable CSV and binary handoffs separate from non-transfer related suggestions", () => {
    const source = tool("source", {
      jobs: ["clean data"],
      inputTypes: ["csv"],
      handoff: { emits: [
        { type: "table", format: "csv" },
        { type: "file", format: "zip" },
        { type: "structured", format: "json" },
      ] },
    });
    const csv = tool("csv-target", {
      handoff: { accepts: [{ type: "table", format: "csv", maxBytes: 1024 }] },
      inputTypes: ["csv"],
    });
    const file = tool("file-target", {
      handoff: { accepts: [{ type: "file" }] },
      inputTypes: ["file"],
    });
    const structured = tool("structured-target", {
      handoff: { accepts: [{ type: "structured", format: "json" }] },
      inputTypes: ["json"],
    });
    const graph = buildRelatedToolGraph([structured, source, file, csv], handoffTargets([structured, source, file, csv]));
    const entry = graph.entries.find((candidate) => candidate.toolId === source.id)!;

    expect(entry.handoffs.map(({ targetId, runtime }) => [targetId, runtime])).toEqual([
      ["csv-target", "table-csv-v1"],
      ["file-target", "binary-v1"],
    ]);
    expect(entry.related.map(({ targetId }) => targetId)).toContain("structured-target");
    expect(entry.related.map(({ targetId }) => targetId)).not.toContain("csv-target");
    expect(entry.related.find(({ targetId }) => targetId === "structured-target")?.evidence)
      .toContainEqual({ kind: "declared-descriptor-match", values: ["structured:json"] });
  });

  it("does not fabricate compatibility from category or mismatched descriptor formats", () => {
    const source = tool("source", {
      category: "same",
      inputTypes: ["alpha"],
      handoff: { emits: [{ type: "table", format: "csv" }] },
    });
    const sameCategory = tool("same-category", { category: "same", inputTypes: ["beta"] });
    const mismatched = tool("mismatched", {
      category: "other",
      inputTypes: ["xml"],
      handoff: { accepts: [{ type: "table", format: "tsv" }] },
    });
    const entry = buildRelatedToolGraph(
      [source, sameCategory, mismatched],
      handoffTargets([source, sameCategory, mismatched]),
    ).entries.find((candidate) => candidate.toolId === source.id)!;

    expect(entry.handoffs).toEqual([]);
    expect(entry.related).toEqual([]);
  });

  it("rejects duplicate ids, duplicate routes and stale/dead handoff projections", () => {
    const source = tool("source");
    expect(() => buildRelatedToolGraph([source, source], [])).toThrow(/duplicate tool id source/u);
    expect(() => buildRelatedToolGraph([source, tool("other", { route: source.route })], [])).toThrow(/duplicate route/u);
    expect(() => buildRelatedToolGraph([tool("misaligned", { route: "/tools/somewhere-else" })], []))
      .toThrow(/dead or misaligned route/u);
    expect(() => buildRelatedToolGraph([source], [{
      id: "missing",
      route: "/tools/missing",
      name: "missing",
      handoff: { accepts: [{ type: "file" }] },
    }])).toThrow(/dead or stale handoff target missing/u);
    expect(() => buildRelatedToolGraph([tool("bad", { route: "/outside/bad" })], [])).toThrow(/invalid local route/u);
  });

  it("deduplicates edges, bounds related suggestions and stays deterministic across input order", () => {
    const source = tool("source", {
      jobs: ["same job"],
      inputTypes: ["text"],
      handoff: { emits: [{ type: "file", format: "zip" }, { type: "file", format: "zip" }] },
    });
    const binaryTarget = tool("binary-target", {
      handoff: { accepts: [{ type: "file" }, { type: "file" }] },
      inputTypes: ["file"],
    });
    const related = Array.from({ length: 8 }, (_, index) => tool(`related-${index}`, {
      jobs: ["same job"],
      inputTypes: ["text"],
    }));
    const targets: HandoffToolSummary[] = [{
      id: binaryTarget.id,
      route: binaryTarget.route,
      name: binaryTarget.name,
      handoff: { accepts: [{ type: "file" }] },
    }];
    const canonicalBinary = { ...binaryTarget, handoff: { accepts: [{ type: "file" }] } } satisfies ToolSummary;
    const canonicalTools = [source, canonicalBinary, ...related];

    const forward = buildRelatedToolGraph(canonicalTools, targets);
    const reverse = buildRelatedToolGraph([...canonicalTools].reverse(), [...targets].reverse());
    const entry = forward.entries.find((candidate) => candidate.toolId === source.id)!;
    expect(entry.handoffs).toHaveLength(1);
    expect(entry.related).toHaveLength(MAX_RELATED_TOOL_SUGGESTIONS);
    expect(entry.related.map(({ targetId }) => targetId)).toEqual(["related-0", "related-1", "related-2", "related-3"]);
    expect(reverse).toEqual(forward);
  });

  it("sabotage: suppresses self handoffs and collapses overlapping descriptor matches into one runtime edge", () => {
    const source = tool("source", {
      handoff: {
        accepts: [{ type: "file" }],
        emits: [{ type: "file", format: "zip" }],
      },
    });
    const target = tool("target", {
      handoff: {
        accepts: [
          { type: "file" },
          { type: "file", format: "zip" },
        ],
      },
    });
    const tools = [target, source];
    const entry = buildRelatedToolGraph(tools, handoffTargets(tools)).entries.find(({ toolId }) => toolId === "source")!;

    expect(entry.handoffs).toHaveLength(1);
    expect(entry.handoffs[0]).toMatchObject({ sourceId: "source", targetId: "target", runtime: "binary-v1" });
    expect(entry.handoffs.some(({ targetId }) => targetId === "source")).toBe(false);
  });

  it("sabotage: descriptor compatibility alone never creates an executable edge without a supported runtime", () => {
    const source = tool("source", {
      handoff: { emits: [{ type: "date-time" }, { type: "structured", format: "json" }] },
    });
    const dateTarget = tool("date-target", {
      handoff: { accepts: [{ type: "date-time" }] },
    });
    const structuredTarget = tool("structured-target", {
      handoff: { accepts: [{ type: "structured", format: "json" }] },
    });
    const tools = [structuredTarget, source, dateTarget];
    const entry = buildRelatedToolGraph(tools, handoffTargets(tools)).entries.find(({ toolId }) => toolId === "source")!;

    expect(entry.handoffs).toEqual([]);
    expect(entry.related.map(({ targetId }) => targetId)).toEqual(["date-target", "structured-target"]);
    expect(entry.related.every(({ evidence }) => evidence.some(({ kind }) => kind === "declared-descriptor-match"))).toBe(true);
  });

  it("sabotage: CSV graph compatibility follows the real runtime's exact format contract", () => {
    const source = tool("source", {
      inputTypes: ["csv"],
      handoff: { emits: [{ type: "table", format: "csv" }] },
    });
    const wrongCaseTarget = tool("wrong-case-target", {
      inputTypes: ["blob"],
      handoff: { accepts: [{ type: "table", format: "CSV" }] },
    });
    const tools = [wrongCaseTarget, source];
    const entry = buildRelatedToolGraph(tools, handoffTargets(tools)).entries.find(({ toolId }) => toolId === "source")!;

    expect(entry.handoffs).toEqual([]);
    expect(entry.related).toEqual([]);
  });

  it("matches representative current catalog chains without inventing unsupported transfer runtimes", () => {
    const graph = buildRelatedToolGraph(catalog, handoffCatalog);
    const csvCleaner = graph.entries.find(({ toolId }) => toolId === "csv-cleaner")!;
    expect(csvCleaner.handoffs).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetId: "csv-dedupe", runtime: "table-csv-v1" }),
      expect.objectContaining({ targetId: "csv-column-map", runtime: "table-csv-v1" }),
    ]));

    const zipCreator = graph.entries.find(({ toolId }) => toolId === "zip-creator")!;
    expect(zipCreator.handoffs).toContainEqual(expect.objectContaining({
      targetId: "checksum-verifier",
      runtime: "binary-v1",
    }));

    const csvToJson = graph.entries.find(({ toolId }) => toolId === "csv-to-json")!;
    expect(csvToJson.handoffs.some(({ targetId }) => targetId === "json-to-csv")).toBe(false);
    expect(csvToJson.related.some(({ targetId, evidence }) =>
      targetId === "json-to-csv" && evidence.some(({ kind }) => kind === "declared-descriptor-match")
    )).toBe(true);
  });
});
