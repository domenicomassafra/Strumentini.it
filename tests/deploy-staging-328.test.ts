import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildImpactPlan, classifyPath } from "../scripts/ci-change-impact-404";
import {
  STAGING_ORIGIN,
  STAGING_PUBLIC_TURNSTILE_KEY,
  assertStagingConfig,
  assertStagingHtml,
} from "../scripts/deploy-staging-328";

describe("#328 staging publish refuses production build/binding", () => {
  const config = readFileSync(new URL("../worker/wrangler.staging.jsonc", import.meta.url), "utf8");
  it("accepts only the isolated checked-in Worker and D1 staging configuration", () => {
    expect(() => assertStagingConfig(config)).not.toThrow();
    const wrongRoute = config.replace('"routes": []', '"routes": [{"pattern":"strumentini.it"}]');
    expect(() => assertStagingConfig(wrongRoute)).toThrow(/isolated/u);
    const wrongD1 = config.replace("807467ce-5366-4104-9509-8c012f836e2a", "3351c8bf-31fc-4716-9d92-2b07c4d8fd2a");
    expect(() => assertStagingConfig(wrongD1)).toThrow(/isolated/u);
    expect(() => assertStagingConfig(config.replace('"routes": []', '"routes": [], "unsafe_extra": 1'))).toThrow(/unreviewed/u);
  });
  it("keeps the staging publisher in the strict Worker/D1/CI review lane", () => {
    for (const path of ["scripts/deploy-staging-328.ts", "tests/deploy-staging-328.test.ts"]) {
      expect(classifyPath(path)).toEqual(["worker-auth", "d1", "ci"]);
      const plan = buildImpactPlan([path], ["tests/release-validation.test.ts", "tests/deploy-staging-328.test.ts", "tests/auth-worker.test.ts"]);
      expect(plan.status).toBe("SOURCE_CHECKS_REQUIRED");
      expect(plan.gates.map((gate) => gate.id)).toContain("security-review");
      expect(plan.gates.map((gate) => gate.id)).toContain("d1-migration-review");
      expect(plan.commands).toContainEqual({ program: "npm", args: ["run", "test"] });
      expect(plan.selectedTests).toContain("tests/deploy-staging-328.test.ts");
    }
  });
  it("rejects the default production site key and missing staging origin", () => {
    const html = `<html><head><link href="${STAGING_ORIGIN}/accedi/"></head><body data-turnstile-site-key="${STAGING_PUBLIC_TURNSTILE_KEY}"></body></html>`;
    expect(() => assertStagingHtml(html)).not.toThrow();
    expect(() => assertStagingHtml(html.replace(STAGING_PUBLIC_TURNSTILE_KEY, "0x4AAAAAAFMra1fmqLYks6Ct"))).toThrow(/site-key|Turnstile key/u);
    expect(() => assertStagingHtml(html.replace(STAGING_ORIGIN, "https://strumentini.it"))).toThrow(/origin/u);
    expect(() => assertStagingHtml("<html></html>")).toThrow(/Turnstile/u);
  });
});
