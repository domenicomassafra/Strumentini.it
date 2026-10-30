import { describe, expect, it } from "vitest";
import { browserMatrixIsSuccessful } from "../scripts/acceptance/browser-performance-verdict.mjs";

const valid = () => ({
  browserMatrix: { requestedEngines: [{ engine: "chrome", status: "PASS" }] },
  freshAcceptance: [{ command: "npm run acceptance:onboarding", status: "PASS" }],
});
const passes = (receipt: ReturnType<typeof valid>, required = ["chrome"], commands = ["npm run acceptance:onboarding"]) =>
  browserMatrixIsSuccessful(receipt, required, commands);

describe("#459 browser release evidence exit verdict", () => {
  it("accepts only observed PASS across every engine and sibling acceptance", () => {
    expect(passes(valid())).toBe(true);
    expect(passes({ ...valid(), browserMatrix: { requestedEngines: [{ engine: "edge", status: "FAIL" }] } })).toBe(false);
    expect(passes({ ...valid(), freshAcceptance: [{ command: "onboarding", status: "FAIL" }] })).toBe(false);
    expect(passes({ ...valid(), freshAcceptance: [{ command: "android", status: "NOT_RUN" }] })).toBe(false);
    expect(passes({ ...valid(), browserMatrix: { requestedEngines: [] } })).toBe(false);
    expect(passes({ ...valid(), freshAcceptance: [] })).toBe(false);
    expect(passes(valid(), ["chrome", "edge"])).toBe(false);
    expect(passes(valid(), ["chrome"], ["npm run acceptance:onboarding", "npm run acceptance:business-math"])).toBe(false);
    expect(passes({ ...valid(), freshAcceptance: [...valid().freshAcceptance, ...valid().freshAcceptance] })).toBe(false);
    const required = ["npm run acceptance:onboarding", "npm run acceptance:business-math"];
    const pair = { browserMatrix: { requestedEngines: [{ engine: "chrome", status: "PASS" }, { engine: "edge", status: "PASS" }] },
      freshAcceptance: [{ command: required[0]!, status: "PASS" }, { command: required[1]!, status: "PASS" }] };
    expect(passes(pair, ["chrome", "edge"], required)).toBe(true);
    expect(passes({ ...pair, browserMatrix: { requestedEngines: [pair.browserMatrix.requestedEngines[0]!, pair.browserMatrix.requestedEngines[0]!] } }, ["chrome", "edge"], required)).toBe(false);
    expect(passes({ ...pair, freshAcceptance: [pair.freshAcceptance[0]!, pair.freshAcceptance[0]!] }, ["chrome", "edge"], required)).toBe(false);
  });
});
