import { describe, expect, it } from "vitest";
import { buildImpactPlan } from "../scripts/ci-change-impact-404";

const suites = [
  "tests/release-validation.test.ts",
  "tests/auth-worker.test.ts",
  "tests/google-auth-worker.test.ts",
  "tests/turnstile-worker.test.ts",
  "tests/vies-worker.test.ts",
  "tests/current-revision-worker-347.test.ts",
  "tests/pdf-redaction-237.test.ts",
  "tests/pdf-image-aware-218.test.ts",
  "tests/image-resize-engine.test.ts",
  "tests/italy-2026-consumers.test.ts",
  "tests/italy-source-packs.test.ts",
];

describe("STR-353 proposal CI classification", () => {
  it("routes reviewed #114 design previews through frontend CI while rejecting arbitrary design executables", () => {
    const reviewFiles = [
      "design/proposals-2026-10-25/README.md",
      "design/proposals-2026-10-25/index.html",
      "design/proposals-2026-10-25/previews/editorial-home-desktop.png",
      "design/proposals-2026-10-25/proposals-core.css",
      "design/proposals-2026-10-25/proposals-variants.css",
      "design/proposals-2026-10-25/proposals.js",
    ];
    const plan = buildImpactPlan(reviewFiles, suites);
    expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
    expect(plan.domains).toEqual(["docs", "frontend"]);
    expect(plan.blockers).toEqual([]);
    expect(plan.commands).toContainEqual({ program: "npm", args: ["run", "test"] });
    expect(plan.gates.map((gate) => gate.id)).toContain("browser-a11y");
    for (const unknown of [
      "design/unreviewed-executable.sh",
      "design/proposals-2026-10-25/build.sh",
      "design/proposals-2026-10-25/previews/unreviewed.js",
      "design/other-project/index.html",
    ]) {
      expect(buildImpactPlan([unknown], suites).status, unknown).toBe("NO_GO");
    }
  });
});
