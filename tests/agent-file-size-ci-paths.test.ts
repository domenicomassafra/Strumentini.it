import { describe, expect, it } from "vitest";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";

describe("#43 agent file size gate in CI", () => {
  it("recognizes only the reviewed new paths and retains security review", () => {
    const paths = [".agent-size-baseline", ".agent-size-ignore", ".githooks/pre-commit", ".github/workflows/agent-file-size.yml"];
    const plan = buildImpactPlan(paths, ["tests/release-validation.test.ts"]);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.domains).toEqual(["ci"]);
    expect(plan.blockers).toEqual([]);
    expect(plan.gates.map((gate) => gate.id)).toContain("security-review");
    expect(buildImpactPlan([".agent-size-override"], ["tests/release-validation.test.ts"]).status).toBe("NO_GO");
  });
});
