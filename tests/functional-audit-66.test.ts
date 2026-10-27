import { readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { functionalAuditRecordSchema, type FunctionalAuditRecord } from "../src/quality/functional-audit";
import { validateOriginal200FunctionalEvidence, type FunctionalEvidenceReaders } from "../scripts/functional-audit-evidence-66";

const root = resolve(import.meta.dirname, "..");
const assignmentIndex = JSON.parse(readFileSync(resolve(root, "quality/functional-audit/original-200.assignments.json"), "utf8")) as {
  readonly assignments: ReadonlyArray<{ readonly toolId: string }>;
};
const originals = new Set(assignmentIndex.assignments.map(({ toolId }) => toolId));
const tools = catalog.filter(({ id }) => originals.has(id));
const records = readdirSync(resolve(root, "quality/functional-audit/records"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => functionalAuditRecordSchema.parse(JSON.parse(
    readFileSync(resolve(root, "quality/functional-audit/records", name), "utf8"),
  ) as unknown));
const cases = JSON.parse(readFileSync(resolve(root, "tests/fixtures/original-200-functional-negative.json"), "utf8")) as ReadonlyArray<{
  readonly id: string;
  readonly toolId: string;
  readonly mutation: string;
  readonly expectedIssue: string;
}>;

function readers(
  replaceJson?: (ref: string, value: unknown) => unknown,
  replaceText?: (ref: string, value: string) => string,
): FunctionalEvidenceReaders {
  return {
    readJson: async (ref) => {
      const value = JSON.parse(await readFile(resolve(root, ref), "utf8")) as unknown;
      return replaceJson ? replaceJson(ref, structuredClone(value)) : value;
    },
    readText: async (ref) => {
      const value = await readFile(resolve(root, ref), "utf8");
      return replaceText ? replaceText(ref, value) : value;
    },
  };
}

describe("#66 original-200 functional-upgrade evidence gate", () => {
  it("links each of the 200 original routes to independent functional decisions and executable acceptance", async () => {
    expect(tools).toHaveLength(200);
    expect(records).toHaveLength(200);
    expect(records.filter(({ decision }) => decision === "UPGRADED").map(({ toolId }) => toolId).sort())
      .toEqual(["regex-tester", "ris-bibtex-converter", "uuid-generator"]);
    expect(records.filter(({ decision }) => decision === "REFUSED").map(({ toolId }) => toolId))
      .toEqual(["image-resize"]);
    const report = await validateOriginal200FunctionalEvidence(tools, records, readers());
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it.each(cases)("rejects negative proof fixture: $id", async ({ toolId, mutation, expectedIssue }) => {
    const original = records.find((entry) => entry.toolId === toolId);
    if (!original) throw new Error("Fixture does not name an original tool: " + toolId);
    const altered = structuredClone(original) as {
      -readonly [K in keyof FunctionalAuditRecord]: FunctionalAuditRecord[K];
    };
    const quality = original.evidence.find(({ kind }) => kind === "quality-receipt")?.ref;
    const browser = original.evidence.find(({ kind }) => kind === "browser-acceptance")?.ref;
    if (!quality || !browser) throw new Error("Fixture lacks source bindings: " + toolId);
    if (mutation === "missing-receipt") {
      altered.evidence = altered.evidence.filter(({ kind }) => kind !== "quality-receipt");
    }
    if (mutation === "visual-only") {
      altered.evidence = altered.evidence.filter(({ kind }) => kind !== "unit-test" && kind !== "oracle");
    }
    if (mutation === "promote-refusal") {
      (altered as { decision: string }).decision = "UPGRADED";
    }
    if (mutation === "unfinished-child") altered.childTickets = ["legacy-expansion:999"];
    const changes = readers(
      (ref, value) => {
        if (ref === quality && mutation === "wrong-tool") return { ...value as object, toolId: "another-tool" };
        if (ref === quality && mutation === "partial-receipt") return { ...value as object, status: "PARTIAL" };
        if (ref === quality && mutation === "wrong-fixtures") return { ...value as object, fixtureFamilies: ["unrelated"] };
        if (ref === browser && mutation === "missing-browser-route") {
          const entry = value as { tools: unknown[]; results?: unknown[] };
          return { ...entry, tools: entry.tools.filter((row) => row !== toolId),
            results: entry.results?.filter((row) => (row as { toolId?: string }).toolId !== toolId) };
        }
        return value;
      },
    );
    const report = await validateOriginal200FunctionalEvidence(tools.filter(({ id }) => id === toolId), [altered], changes);
    expect(report.ok).toBe(false);
    expect(report.issues.join("\n")).toContain(expectedIssue);
  });
});
