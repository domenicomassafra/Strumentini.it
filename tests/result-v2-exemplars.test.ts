import { describe, expect, it } from "vitest";
import {
  CalculatorResultV2Exemplar,
  TransformResultV2Exemplar,
  ValidatorResultV2Exemplar,
} from "../src/components/tools/shared/ResultV2Exemplars";
import { ResultActions } from "../src/components/tools/shared/ResultActions";
import { ResultExplanation, ResultPrimaryAnswer } from "../src/components/tools/shared/ResultPrimitives";

type VNodeLike = { type: unknown; props: Record<string, unknown> };

function assertExemplar(node: VNodeLike, expectedPrimaryAction: "copy" | "download"): void {
  const children = node.props.children as VNodeLike[];
  expect(children[0]?.type).toBe(ResultExplanation);
  expect(children[1]?.type).toBe(ResultActions);

  const explanation = children[0]!;
  const primary = explanation.props.primary as VNodeLike;
  expect(primary.type).toBe(ResultPrimaryAnswer);

  const actions = children[1]!;
  const actionModels = actions.props.actions as Array<{ id: string; primary: boolean }>;
  expect(actionModels.filter((action) => action.primary)).toEqual([
    expect.objectContaining({ id: expectedPrimaryAction, primary: true }),
  ]);
}

describe("Result v2 answer/action exemplars", () => {
  it("keeps calculator primary answer ahead of details and explicit copy primary action", () => {
    assertExemplar(CalculatorResultV2Exemplar() as VNodeLike, "copy");
  });

  it("keeps validator primary answer ahead of provenance and explicit copy primary action", () => {
    assertExemplar(ValidatorResultV2Exemplar() as VNodeLike, "copy");
  });

  it("keeps transform primary answer ahead of details and explicit download primary action", () => {
    assertExemplar(TransformResultV2Exemplar() as VNodeLike, "download");
  });
});
