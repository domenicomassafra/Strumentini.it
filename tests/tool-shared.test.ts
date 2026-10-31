import { describe, expect, it } from "vitest";
import { InlineError } from "../src/components/tools/shared/InlineError";
import {
  focusToolOperationRecovery,
  resultAccessibilityFor,
  ResultStateCue,
} from "../src/components/tools/shared/ResultAccessibility";
import { ToolSubmitButton } from "../src/components/tools/shared/ToolActions";
import { gutterStateFor, ToolGutter } from "../src/components/tools/shared/ToolGutter";
import { ToolResultPanel } from "../src/components/tools/shared/ToolResultPanel";
import { ProvenanceBadge } from "../src/components/tools/shared/Provenance";
import {
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "../src/components/tools/shared/ResultPrimitives";
import {
  cancelToolOperation,
  idleToolOperation,
  partialToolOperation,
  settleToolOperation,
  shouldCommitToolOperation,
  startToolOperation,
  warningToolOperation,
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
  it("keeps idle, running, success, warning, partial, error, and cancelled states explicit", () => {
    expect(idleToolOperation<number>()).toEqual({ status: "idle", result: null, error: "" });
    expect(startToolOperation<number>()).toEqual({ status: "running", result: null, error: "" });
    expect(settleToolOperation<number>(success)).toEqual({ status: "success", result: { value: 42 }, error: "" });
    expect(settleToolOperation<number>(failure, { formatError: () => "Check the input." }))
      .toEqual({ status: "error", result: null, error: "Check the input." });
    expect(settleToolOperation<number>(failure).error).toBe("Controlla i dati inseriti: uno o più campi non sono nel formato richiesto.");
    expect(cancelToolOperation<number>("Cancelled. No output was produced."))
      .toEqual({ status: "cancelled", result: null, error: "Cancelled. No output was produced." });
    expect(warningToolOperation({ value: 42 }, "Result is usable with a caveat."))
      .toEqual({ status: "warning", result: { value: 42 }, error: "", notice: "Result is usable with a caveat." });
    expect(partialToolOperation({ value: 21 }, "Only one file completed."))
      .toEqual({ status: "partial", result: { value: 21 }, error: "", notice: "Only one file completed." });
  });

  it("rejects stale or aborted completions", () => {
    expect(shouldCommitToolOperation(3, 3)).toBe(true);
    expect(shouldCommitToolOperation(2, 3)).toBe(false);
    expect(shouldCommitToolOperation(3, 3, true)).toBe(false);
  });

  it("keeps result announcements concise and outside the result payload", () => {
    const error = InlineError({ message: "Something went wrong." }) as unknown as { props: Record<string, unknown> } | null;
    expect(error?.props.role).toBe("alert");
    expect(error?.props.class).toBe("error");
    expect(error?.props.tabIndex).toBe(-1);
    expect(error?.props["data-tool-error"]).toBe(true);
    expect(InlineError({ message: "" })).toBeNull();

    const panel = ToolResultPanel({
      eyebrow: "Result",
      placeholder: "Nothing yet.",
      atomic: false,
      busy: true,
      children: "A very large result payload that must never become the live announcement.",
    }) as unknown as { props: Record<string, unknown> };
    expect(panel.props["aria-live"]).toBeUndefined();
    expect(panel.props["aria-atomic"]).toBeUndefined();
    expect(panel.props["aria-busy"]).toBe("true");
    expect(panel.props["data-state"]).toBe("running");

    const children = panel.props.children as unknown[];
    const cue = children[1] as { type: unknown; props: Record<string, unknown> };
    expect(cue.type).toBe(ResultStateCue);
    expect(cue.props).toMatchObject({ status: "running", atomic: false });
    expect(JSON.stringify(cue.props)).not.toContain("large result payload");

    const provenance = ProvenanceBadge({ provenance: "profile" }) as unknown as { props: Record<string, unknown> };
    expect(provenance.props.class).toBe("provenance");
  });

  it("gives every operation outcome distinct text semantics and a non-colour cue", () => {
    const statuses = ["running", "success", "warning", "partial", "error", "cancelled"] as const;
    const descriptors = statuses.map((status) => resultAccessibilityFor(status)!);

    expect(new Set(descriptors.map((descriptor) => descriptor.label)).size).toBe(statuses.length);
    expect(new Set(descriptors.map((descriptor) => descriptor.announcement)).size).toBe(statuses.length);
    expect(resultAccessibilityFor("error")?.priority).toBe("assertive");
    expect(resultAccessibilityFor("warning")).toMatchObject({ label: "Completato con avviso", mark: "warn", tone: "warning" });
    expect(resultAccessibilityFor("partial")).toMatchObject({ label: "Risultato parziale", tone: "warning" });
    expect(resultAccessibilityFor("cancelled")).toMatchObject({ label: "Annullata", mark: "missing" });
    expect(resultAccessibilityFor("idle")).toBeNull();

    const warningCue = ResultStateCue({ status: "warning" }) as unknown as { props: { children: unknown[] } };
    const visible = warningCue.props.children[0] as { props: Record<string, unknown> };
    const polite = warningCue.props.children[1] as { props: Record<string, unknown> };
    const assertive = warningCue.props.children[2] as { props: Record<string, unknown> };
    expect(visible.props).toMatchObject({ class: "gutter-note", "data-state": "warning", "data-result-state": "warning" });
    expect(JSON.stringify(visible.props.children)).toContain("Completato con avviso");
    expect(polite.props).toMatchObject({ role: "status", "aria-live": "polite", "aria-atomic": "true" });
    expect(polite.props.children).toBe("Operazione completata con un avviso. Controlla i dettagli.");
    expect(assertive.props.children).toBe("");
  });

  it("keeps warning, partial, and cancellation visible instead of collapsing them to idle", () => {
    expect(gutterStateFor("warning")).toBe("warning");
    expect(gutterStateFor("partial")).toBe("partial");
    expect(gutterStateFor("cancelled")).toBe("cancelled");
  });

  it("shows the empty-state hint only when no gutter result content exists", () => {
    const hasIdleHint = (props: Parameters<typeof ToolGutter>[0]) =>
      JSON.stringify(ToolGutter(props)).includes("Nessun risultato. Compila i campi");

    expect(hasIdleHint({ label: "JSON", state: "idle" })).toBe(true);
    expect(hasIdleHint({ label: "JSON", state: "success", children: '{"valido":true}' })).toBe(false);
    expect(hasIdleHint({ label: "JSON", state: "success", entries: [{ label: "Conteggio", value: "2" }] })).toBe(false);
    expect(hasIdleHint({ label: "JSON", state: "success", value: "42" })).toBe(false);
  });

  it("defines deterministic error and cancellation focus recovery", () => {
    const calls: Array<{ selector: string; preventScroll: boolean | undefined }> = [];
    const root = {
      querySelector(selector: string) {
        return {
          focus(options?: FocusOptions) {
            calls.push({ selector, preventScroll: options?.preventScroll });
          },
        };
      },
    };

    expect(focusToolOperationRecovery(root, "error")).toBe(true);
    expect(focusToolOperationRecovery(root, "cancelled")).toBe(true);
    expect(calls).toEqual([
      { selector: "[data-tool-error]", preventScroll: true },
      { selector: "[data-tool-run-control]", preventScroll: true },
    ]);

    const submit = ToolSubmitButton({ children: "Riprova" }) as unknown as { props: Record<string, unknown> };
    expect(submit.props.type).toBe("submit");
    expect(submit.props["data-tool-run-control"]).toBe(true);
    expect(submit.props.disabled).toBe(false);
  });

  it("keeps the primary answer first and secondary result context structured", () => {
    const primary = ResultPrimaryAnswer({ children: "42", unit: "%" });
    const interpretation = ResultInterpretation({ children: "Sopra la soglia.", state: "success" });
    const breakdown = ResultBreakdown({ rows: [{ label: "Base", value: "40" }] });
    const assumptions = ResultAssumptions({ items: [{ label: "Arrotondamento", value: "2 decimali" }] });
    const provenance = ResultProvenance({ children: "Calcolo locale" });
    const explanation = ResultExplanation({ primary, interpretation, breakdown, assumptions, provenance }) as unknown as {
      props: { children: unknown[] };
    };

    expect((primary as unknown as { type: unknown }).type).toBe("div");
    expect(explanation.props.children[0]).toBe(primary);
    expect(explanation.props.children[1]).toBe(interpretation);
    expect(explanation.props.children[2]).toBe(breakdown);
    expect(explanation.props.children[3]).toBe(assumptions);
    expect(explanation.props.children[4]).toBe(provenance);
  });
});
