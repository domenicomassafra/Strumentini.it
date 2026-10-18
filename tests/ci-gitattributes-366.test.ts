/** Verbatim official license notices need unchanged Git bytes, with CI review. */
import { describe, expect, it } from "vitest";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";

describe("STR-366 Git attribute protection", () => {
  it("classifies .gitattributes as reviewed CI source, retaining security and full suite gates", () => {
    const plan = buildImpactPlan(
      [".gitattributes", "public/fonts/inter-OFL-1.1.txt"],
      ["tests/release-validation.test.ts"],
    );
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.blockers).toEqual([]);
    expect(plan.domains).toEqual(expect.arrayContaining(["ci", "frontend"]));
    expect(plan.gates.map((gate) => gate.id)).toContain("security-review");
    expect(plan.commands).toContainEqual({ program: "npm", args: ["run", "test"] });
  });

  it("does not permit unrecognized sibling dotfiles to evade the gate", () => {
    const plan = buildImpactPlan([".gitattributes-arbitrary"], ["tests/release-validation.test.ts"]);
    expect(plan.status).toBe("NO_GO");
    expect(plan.blockers).toContain('UNKNOWN_CHANGE_PATH: ".gitattributes-arbitrary"');
  });
});
