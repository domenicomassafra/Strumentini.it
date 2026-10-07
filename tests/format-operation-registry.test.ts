import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS,
  validateFormatOperationRegistry,
} from "../src/quality/format-operations";

async function registryRows(): Promise<unknown[]> {
  return JSON.parse(await readFile(new URL("../quality/format-operations/registry.json", import.meta.url), "utf8")) as unknown[];
}

describe("format-operation classification registry", () => {
  it("classifies every required high-priority directional job exactly once", async () => {
    const rows = await registryRows();
    const report = validateFormatOperationRegistry(rows, REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS);
    expect(report.issues).toEqual([]);
    expect(report.rows).toHaveLength(REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS.length);
  });

  it("fails when a required row is missing", async () => {
    const rows = await registryRows();
    const missing = rows.filter((row) => (row as { id?: string }).id !== "compress-jpeg");
    const report = validateFormatOperationRegistry(missing, REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS);
    expect(report.issues).toContain("missing high-priority format-operation row: compress-jpeg");
  });

  it("fails duplicate and unclassified rows", async () => {
    const rows = await registryRows();
    const duplicate = rows.find((row) => (row as { id?: string }).id === "compress-jpeg");
    expect(duplicate).toBeDefined();
    const duplicated = validateFormatOperationRegistry([...rows, duplicate], REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS);
    expect(duplicated.issues).toContain("duplicate format-operation id: compress-jpeg");

    const invalid = { ...(duplicate as Record<string, unknown>), id: "future-format", state: "UNKNOWN" };
    const unclassified = validateFormatOperationRegistry([...rows, invalid], REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS);
    expect(unclassified.issues.some((issue) => issue.includes("Invalid option"))).toBe(true);
  });

  it("requires a refusal reason instead of silently omitting unsupported directions", () => {
    const report = validateFormatOperationRegistry([{
      id: "fake-refusal",
      source: "fixture",
      operation: "convert",
      inputFormats: ["a"],
      outputFormats: ["b"],
      priority: "low",
      state: "REFUSE",
      fidelity: "fixture",
    }]);
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toMatch(/REFUSE rows require a reason/u);
  });
});
