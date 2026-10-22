import { describe, expect, it } from "vitest";
import { parsePipeline391Recipe, runPipeline391 } from "../src/engines/table/pipeline-391";
import { left391, right391, recipe391 } from "./fixtures/str-391";

describe("STR-391: refusals preserve both source inputs and prior result", () => {
  it("rejects unsupported, mistyped, out-of-order and unbounded recipe steps", () => {
    const invalid = [
      { version: 2, steps: recipe391.steps },
      { version: 1, steps: [{ kind: "execute", command: "rm" }, ...recipe391.steps] },
      { version: 1, steps: [{ kind: "export", format: "csv" }, ...recipe391.steps] },
      { version: 1, steps: [recipe391.steps[1], recipe391.steps[0], recipe391.steps[2]] },
      { version: 1, steps: [recipe391.steps[0], { ...recipe391.steps[1], leftKeyColumns: [0, 0] }, recipe391.steps[2]] },
      { version: 1, steps: [recipe391.steps[0], recipe391.steps[1], { kind: "export", format: "xlsx" }] },
      { version: 1, steps: [{ kind: "filter", table: "left", column: -1, operator: "equals", value: "x" }, recipe391.steps[1], recipe391.steps[2]] },
      { version: 1, steps: [...recipe391.steps, { kind: "filter", table: "current", column: 1, operator: "equals", value: "si" }] },
      { version: 1, steps: [recipe391.steps[1], recipe391.steps[1], recipe391.steps[2]] },
      { version: 1, steps: recipe391.steps, expected: { sourceSha256: { left: "forged", right: "forged" }, outputSha256: "bad" } },
    ];
    for (const value of invalid) expect(() => parsePipeline391Recipe(value)).toThrow(/PIPELINE_/u);
  });

  it("rejects changed sources and invalid columns without mutating either CSV", async () => {
    const source = { left: left391, right: right391 };
    const previous = await runPipeline391(recipe391, source);
    await expect(runPipeline391(recipe391, { ...source, left: `${left391}\n4,si` }, { expectedSourceSha256: previous.sourceSha256 })).rejects.toThrow("PIPELINE_SOURCE_CHANGED");
    const badColumn = { version: 1, steps: [{ kind: "filter", table: "left", column: 17, operator: "equals", value: "si" }, ...recipe391.steps.slice(1)] };
    await expect(runPipeline391(badColumn, source)).rejects.toThrow("INVALID_COLUMN");
    expect(source.left).toBe(left391);
    expect(source.right).toBe(right391);
    expect(previous.output).toBe("id,gruppo,id_right,tag_right\n1,si,1,α\n3,si,3,γ");
    const altered = { ...recipe391, expected: { sourceSha256: previous.sourceSha256, outputSha256: "0".repeat(64) } };
    await expect(runPipeline391(altered, source)).rejects.toThrow("PIPELINE_REPLAY_HASH_MISMATCH");
  });

  it("rejects a pre-cancelled run, never returning partial output", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runPipeline391(recipe391, { left: left391, right: right391 }, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("refuses oversize data and join explosions through the existing bounded engines", async () => {
    const first = `id,gruppo\n${Array.from({ length: 1800 }, (_, index) => `1,row${index}`).join("\n")}`;
    const right = `id,tag\n${Array.from({ length: 100 }, (_, index) => `1,tag${index}`).join("\n")}`;
    const joinOnly = { version: 1, steps: recipe391.steps.slice(1) };
    await expect(runPipeline391(joinOnly, { left: first, right })).rejects.toThrow(/TABLE_JOIN_EXPLOSION/u);
  });
});
