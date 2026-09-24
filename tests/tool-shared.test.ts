import { describe, expect, it } from "vitest";
import { InlineError } from "../src/components/tools/shared/InlineError";
import { ToolResultPanel } from "../src/components/tools/shared/ToolResultPanel";
import { ToolSubmitButton } from "../src/components/tools/shared/ToolActions";
import { ProvenanceBadge } from "../src/components/tools/shared/Provenance";
import {
  cancelToolOperation,
  idleToolOperation,
  settleToolOperation,
  startToolOperation,
} from "../src/components/tools/shared/useToolOperation";

const failure = {
  ok: false as const,
  code: "INVALID_INPUT" as const,
  message: "Input is invalid.",
};

const success = {
  ok: true as const,
  tool: {} as never,
  value: { value: 42 },
  defaults: [],
};

describe("shared tool operation vocabulary", () => {
  it("keeps idle, running, success, error, and cancelled states explicit", () => {
    expect(idleToolOperation<number>()).toEqual({ status: "idle", result: null, error: "" });
    expect(startToolOperation<number>()).toEqual({ status: "running", result: null, error: "" });
    expect(settleToolOperation<number>(success)).toEqual({ status: "success", result: { value: 42 }, error: "" });
    expect(settleToolOperation<number>(failure, { formatError: () => "Check the input." }))
      .toEqual({ status: "error", result: null, error: "Check the input." });
    expect(cancelToolOperation<number>("Cancelled. No output was produced."))
      .toEqual({ status: "cancelled", result: null, error: "Cancelled. No output was produced." });
  });

  it("exposes alert and live-result semantics on shared primitives", () => {
    const error = InlineError({ message: "Something went wrong." }) as unknown as { props: Record<string, unknown> } | null;
    expect(error?.props.role).toBe("alert");
    expect(error?.props.class).toBe("error");
    expect(InlineError({ message: "" })).toBeNull();

    const panel = ToolResultPanel({
      eyebrow: "Result",
      placeholder: "Nothing yet.",
      atomic: false,
      busy: true,
    }) as unknown as { props: Record<string, unknown> };
    expect(panel.props["aria-live"]).toBe("polite");
    expect(panel.props["aria-atomic"]).toBe("false");
    expect(panel.props["aria-busy"]).toBe("true");
    expect(panel.props["aria-label"]).toBe("Result");

    const defaultPanel = ToolResultPanel({ eyebrow: "Result", placeholder: "Nothing yet." }) as unknown as { props: Record<string, unknown> };
    expect(defaultPanel.props["aria-atomic"]).toBe("false");

    const busyButton = ToolSubmitButton({ children: "Run", busy: true }) as unknown as { props: Record<string, unknown> };
    expect(busyButton.props.disabled).toBe(false);
    expect(busyButton.props["aria-disabled"]).toBe("true");
    expect(busyButton.props["aria-busy"]).toBe("true");

    const provenance = ProvenanceBadge({ provenance: "profile" }) as unknown as { props: Record<string, unknown> };
    expect(provenance.props.class).toBe("provenance");
  });
});
