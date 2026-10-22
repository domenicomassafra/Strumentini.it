import { describe, expect, it } from "vitest";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";

describe("#285 real workerd suite is required by change-impact CI", () => {
  it("runs the separate local Worker/D1 integration gate for every sensitive path", () => {
    const suites = ["tests/release-validation.test.ts", "tests/auth-worker.test.ts"];
    for (const path of ["vitest.workerd.config.ts", "tests/workerd/setup.ts", "tests/workerd/worker-api.test.ts", "worker/index.ts", "worker/migrations/0001_init.sql"]) {
      const plan = buildImpactPlan([path], suites);
      const expected = path.startsWith("worker/migrations/") ? "d1" : "worker-auth";
      expect(plan.domains, path).toContain(expected);
      if (path.startsWith("tests/workerd/") || path === "vitest.workerd.config.ts") {
        expect(plan.domains).toContain("d1");
      }
      expect(plan.commands, path).toContainEqual({ program: "npm", args: ["run", "test:workerd"] });
      expect(plan.gates.map((gate) => gate.id), path).toContain("auth-integration");
    }
  });
});
