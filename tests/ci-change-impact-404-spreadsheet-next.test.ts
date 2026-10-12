import { describe, expect, it } from "vitest";
import { buildImpactPlan, classifyPath } from "../scripts/ci-change-impact-404";

const availableTests = [
  "tests/release-validation.test.ts",
  "tests/spreadsheet-interchange.test.ts",
  "tests/donor-spreadsheets-370.test.ts",
  "tests/xml-interchange.test.ts",
  "tests/pdf-table-xlsx-254.test.ts",
  "tests/ooxml-68.test.ts",
];

const spreadsheetBoundaryPaths = [
  "src/engines/table/spreadsheet-interchange.ts",
  "src/engines/office-local/worker.ts",
  "src/engines/office-local/client.ts",
  "src/engines/office-local/worker-protocol.ts",
  "tests/spreadsheet-interchange.test.ts",
  "tests/donor-spreadsheets-370.test.ts",
];

describe("#404 source-boundary gates for locally parsed XLSX", () => {
  it("retains the full shared source suite and explicitly requires direct XLSX and independent donor tests", () => {
    const path = "src/engines/table/spreadsheet-interchange.ts";
    const plan = buildImpactPlan([path], availableTests);

    expect(classifyPath(path)).toEqual(["shared", "spreadsheet"]);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.blockers).toEqual([]);
    expect(plan.commands).toContainEqual({ program: "npm", args: ["run", "test"] });
    expect(plan.selectedTests).toEqual(expect.arrayContaining([
      "tests/release-validation.test.ts",
      "tests/spreadsheet-interchange.test.ts",
      "tests/donor-spreadsheets-370.test.ts",
      "tests/xml-interchange.test.ts",
      "tests/pdf-table-xlsx-254.test.ts",
      "tests/ooxml-68.test.ts",
    ]));
    expect(plan.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "security-review", status: "NOT_RUN" }),
      expect.objectContaining({ id: "physical-device", status: "NOT_RUN" }),
      expect.objectContaining({ id: "release-readiness", status: "NOT_RUN" }),
    ]));
    expect(plan.gates.every((gate) => gate.status === "NOT_RUN")).toBe(true);
  });

  it("keeps XLSX review and affected suites mandatory for its browser worker/client and their regression tests", () => {
    for (const path of spreadsheetBoundaryPaths) {
      const plan = buildImpactPlan([path], availableTests);
      expect(plan.domains, path).toContain("spreadsheet");
      expect(plan.selectedTests, path).toEqual(expect.arrayContaining([
        "tests/spreadsheet-interchange.test.ts", "tests/donor-spreadsheets-370.test.ts",
      ]));
      expect(plan.gates, path).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "security-review", status: "NOT_RUN" }),
        expect.objectContaining({ id: "physical-device", status: "NOT_RUN" }),
      ]));
    }
  });

  it("fails closed if either XLSX parser or hostile-donor regression suite disappears", () => {
    const path = "src/engines/table/spreadsheet-interchange.ts";
    for (const missing of ["tests/spreadsheet-interchange.test.ts", "tests/donor-spreadsheets-370.test.ts"]) {
      const plan = buildImpactPlan([path], availableTests.filter((test) => test !== missing));
      expect(plan.status, missing).toBe("NO_GO");
      expect(plan.blockers, missing).toContain(`MISSING_AFFECTED_SUITE: ${missing}`);
      expect(plan.commands).toEqual([]);
      expect(plan.gates).toContainEqual(expect.objectContaining({ id: "security-review", status: "NOT_RUN" }));
    }
  });

  it("keeps documentation changes documentation-only and does not invent reviewed gates", () => {
    const plan = buildImpactPlan(["docs/spreadsheet-format.md"], availableTests);
    expect(plan.status).toBe("DOCS_ONLY");
    expect(plan.domains).toEqual(["docs"]);
    expect(plan.commands).toEqual([]);
    expect(plan.gates).toEqual([]);
  });
});
