import { describe, expect, it } from "vitest";
import { RESULT_V2_SEMANTIC_FIXTURES } from "../quality/fixtures/result-v2-semantic-classes/fixtures";
import { RESULT_CLASSES } from "../src/catalog/manifest";
import {
  assertResultV2SemanticConformance,
  RESULT_V2_CLASS_CONTRACTS,
  type ResultV2SemanticFixture,
} from "../src/quality/result-v2-conformance";

describe("Result v2 semantic class conformance", () => {
  it("covers every manifest semantic class with required slots, actions, states, and accessibility", () => {
    const report = assertResultV2SemanticConformance(RESULT_V2_SEMANTIC_FIXTURES);
    expect(report.ok).toBe(true);
    expect(report.classes.map((entry) => entry.class)).toEqual([...RESULT_CLASSES]);
    expect(report.classes).toHaveLength(9);
    for (const entry of report.classes) {
      const contract = RESULT_V2_CLASS_CONTRACTS[entry.class as keyof typeof RESULT_V2_CLASS_CONTRACTS];
      expect(entry.slots).toEqual(expect.arrayContaining([...contract.requiredSlots]));
      expect(entry.actions).toEqual(expect.arrayContaining([...contract.requiredActions]));
      expect(entry.states).toEqual(contract.requiredStates);
      expect(entry.a11y).toEqual(contract.requiredA11y);
    }
  });

  it("fails closed when a newly declared class has no fixture", () => {
    expect(() => assertResultV2SemanticConformance(
      RESULT_V2_SEMANTIC_FIXTURES,
      [...RESULT_CLASSES, "future-semantic-class"],
    )).toThrow(/future-semantic-class: missing semantic fixture/u);
  });

  it("fails when a representative fixture drops required semantic order", () => {
    const calculator = RESULT_V2_SEMANTIC_FIXTURES.find((fixture) => fixture.class === "calculator")!;
    const sabotaged: ResultV2SemanticFixture = {
      ...calculator,
      render: () => null,
    };
    const fixtures = RESULT_V2_SEMANTIC_FIXTURES.map((fixture) => fixture.class === "calculator" ? sabotaged : fixture);
    expect(() => assertResultV2SemanticConformance(fixtures)).toThrow(/calculator: required semantic slots\/order missing/u);
  });

  it("fails when a required action is declared but not actually ready", () => {
    const batch = RESULT_V2_SEMANTIC_FIXTURES.find((fixture) => fixture.class === "batch")!;
    const sabotaged: ResultV2SemanticFixture = {
      ...batch,
      actionContext: { ...batch.actionContext, downloadAllReady: false, primary: null },
    };
    const fixtures = RESULT_V2_SEMANTIC_FIXTURES.map((fixture) => fixture.class === "batch" ? sabotaged : fixture);
    expect(() => assertResultV2SemanticConformance(fixtures)).toThrow(/batch: required action download-all is unavailable/u);
  });
});
