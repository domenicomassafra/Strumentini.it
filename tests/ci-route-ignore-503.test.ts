import { describe, expect, it } from "vitest";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";

describe("#503 generated route ignore policy", () => {
  it("subjects changes to .gitignore to reviewed source checks", () => {
    const plan = buildImpactPlan([".gitignore"], ["tests/release-validation.test.ts"]);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.domains).toEqual(["ci"]);
    expect(plan.blockers).toEqual([]);
    expect(plan.commands).toContainEqual({ program: "npm", args: ["run", "test"] });
  });
});
