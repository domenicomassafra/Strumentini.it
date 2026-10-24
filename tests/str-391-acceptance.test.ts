import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parsePipeline391Recipe, runPipeline391, serializePipeline391Recipe, type Pipeline391Recipe } from "../src/engines/table/pipeline-391";
import { left391, right391, recipe391 } from "./fixtures/str-391";

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

describe("STR-391: chain filter → join → CSV export and exact replay", () => {
  it("matches an independently specified CSV oracle with SHA-256 of exact bytes", async () => {
    const expected = "id,gruppo,id_right,tag_right\n1,si,1,α\n3,si,3,γ";
    const sources = { left: left391, right: right391 };
    const first = await runPipeline391(recipe391, sources);
    expect(first.output).toBe(expected);
    expect(first.sourceSha256).toEqual({ left: sha(left391), right: sha(right391) });
    expect(first.outputSha256).toBe(sha(expected));
    expect(first.trace.map((step) => [step.operation, step.inputRows, step.outputRows])).toEqual([
      ["filter", 3, 2], ["join", 5, 2], ["export", 2, 2],
    ]);
    const saved = serializePipeline391Recipe(recipe391);
    expect(saved).not.toContain("gruppo\n1"); // data are never included in the recipe
    const replay = await runPipeline391(parsePipeline391Recipe(JSON.parse(saved)), sources, { expectedSourceSha256: first.sourceSha256 });
    expect(replay).toEqual(first);
    const provenRecipe = JSON.parse(serializePipeline391Recipe({ ...recipe391, expected: { sourceSha256: first.sourceSha256, outputSha256: first.outputSha256 } })) as unknown;
    expect(await runPipeline391(provenRecipe, sources)).toEqual(first);
    expect(sources).toEqual({ left: left391, right: right391 });
  });

  it("allows a second post-join filter with a reproducible traced row reduction", async () => {
    const recipe: Pipeline391Recipe = { version: 1, steps: [
      { kind: "filter", table: "right", column: 1, operator: "not-equals", value: "β" },
      { kind: "join", leftKeyColumns: [0], rightKeyColumns: [0], joinType: "left" },
      { kind: "filter", table: "current", column: 3, operator: "not-empty", value: "" },
      { kind: "export", format: "csv" },
    ] };
    const result = await runPipeline391(recipe, { left: left391, right: right391 });
    expect(result.output).toBe("id,gruppo,id_right,tag_right\n1,si,1,α\n3,si,3,γ");
    expect(result.trace.map((step) => step.outputRows)).toEqual([2, 3, 2, 2]);
  });
});
