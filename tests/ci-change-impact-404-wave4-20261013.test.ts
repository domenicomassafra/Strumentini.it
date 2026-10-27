import { describe, expect, it } from "vitest";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";

const tests = [
  "tests/release-validation.test.ts",
  "tests/donor-provenance-366.test.ts",
  "tests/ci-change-impact-404.test.ts",
];

describe("#404 reviewed source-input coverage rather than docs-only bypass", () => {
  it("does not skip provenance audit when the exact source donor snapshot changes", () => {
    const plan = buildImpactPlan(["docs/donor-provenance-366-candidate-packages-2026-10-10.json"], tests);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.domains).toContain("ci");
    expect(plan.gates).toContainEqual(expect.objectContaining({ id: "security-review", status: "NOT_RUN" }));
    expect(plan.commands).toContainEqual({ program: "npm", args: ["run", "test"] });
    expect(buildImpactPlan(["docs/donor-provenance-366-active-2026-10-18.md"], tests).status).toBe("DOCS_ONLY");
  });

  it("keeps declared audit inputs in source CI without a frozen dashboard gate", () => {
    for (const path of [
      "src/quality/functional-audit.ts",
      "scripts/functional-audit-200.ts",
      "tests/functional-audit.test.ts",
    ]) {
      const plan = buildImpactPlan([path], tests);
      expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
      expect(plan.commands).toContainEqual({ program: "npm", args: ["run", "test"] });
    }
    const docsPR = buildImpactPlan([
      "PROJECT-STATUS.md", "HANDOFF.md", "docs/history/expansion-note.md",
    ], tests);
    expect(docsPR.status).toBe("DOCS_ONLY");
    expect(docsPR.commands).toEqual([]);
  });

  it("keeps ordinary docs-only paths source-check-free and unknown paths fail-closed", () => {
    const docs = buildImpactPlan(["docs/notes.md", "README.md"], tests);
    expect(docs).toMatchObject({ status: "DOCS_ONLY", commands: [], gates: [] });
    const unknown = buildImpactPlan([".unexpected/loader.sh"], tests);
    expect(unknown.status).toBe("NO_GO");
    expect(unknown.commands).toEqual([]);
  });

  it("recognizes retired research and design records while keeping executable census work in CI", () => {
    const historical = [
      ".impeccable/build/state.json",
      "IMPLEMENTATION-PLAN.md",
      "design/FRONTEND-SYSTEM-STANDARDIZATION.md",
      "research/implementation/10-hash-dependency-gate.md",
      "research/lanes/01-market-demand-jobs-census.md",
      "research/lanes/03-name-screen.csv",
      "research/lanes/06-oss-donor-evidence/deep-primary-metadata.json",
      "spikes/core-engines/README.md",
      "spikes/heavy-local-feasibility/README.md",
    ];
    const docs = buildImpactPlan(historical, tests);
    expect(docs.status).toBe("DOCS_ONLY");
    expect(docs.blockers).toEqual([]);

    const executable = buildImpactPlan([...historical, "research/lanes/06-oss-donor-evidence/build_census.py"], tests);
    expect(executable.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(executable.domains).toContain("ci");
    expect(executable.gates.map((gate) => gate.id)).toContain("security-review");
    for (const unreviewed of ["design/other-plan.md", "research/lanes/bootstrap.sh", "research/lanes/future-policy.json", ".impeccable/build/plugin.js"]) {
      expect(buildImpactPlan([unreviewed], tests).status, unreviewed).toBe("NO_GO");
    }
  });
});
