import { describe, expect, it } from "vitest";
import { ResultActions } from "../src/components/tools/shared/ResultActions";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";
import { resolveResultActions } from "../src/runtime/result-actions";

const verifiedText = createOutputArtifactDescriptor({
  kind: "text",
  name: "result.txt",
  mime: "text/plain",
  bytes: new TextEncoder().encode("hello"),
  verification: { state: "verified", verifiedMime: "text/plain", method: "UTF-8 producer contract" },
  fidelity: "lossless",
  fidelityNote: "Exact generated text.",
});

describe("Result v2 action contract", () => {
  it("derives only declared and currently available actions", () => {
    const actions = resolveResultActions({
      declaration: { class: "text-code", capabilities: ["copy", "download", "retry", "reset", "share"] },
      primary: "copy",
      hasCopyPayload: true,
      artifact: verifiedText,
      retryReady: false,
      resetReady: true,
      shareReady: false,
    });

    expect(actions).toEqual([
      { id: "copy", label: "Copia risultato", primary: true },
      { id: "download", label: "Scarica risultato", primary: false },
      { id: "reset", label: "Reimposta", primary: false },
    ]);
  });

  it("does not expose a download before artifact verification", () => {
    const unverified = createOutputArtifactDescriptor({
      kind: "text",
      name: "result.txt",
      mime: "text/plain",
      bytes: new TextEncoder().encode("hello"),
      verification: { state: "unverified" },
      fidelity: "lossless",
      fidelityNote: "Exact generated text.",
    });
    expect(resolveResultActions({
      declaration: { class: "text-code", capabilities: ["download"] },
      primary: null,
      artifact: unverified,
    })).toEqual([]);
  });

  it("requires primary semantics explicitly and never infers primary from position", () => {
    const actions = resolveResultActions({
      declaration: { class: "text-code", capabilities: ["copy", "download"] },
      primary: "download",
      hasCopyPayload: true,
      artifact: verifiedText,
    });
    expect(actions.map((action) => [action.id, action.primary])).toEqual([
      ["copy", false],
      ["download", true],
    ]);

    expect(() => resolveResultActions({
      declaration: { class: "text-code", capabilities: ["copy"] },
      primary: "download",
      hasCopyPayload: true,
    })).toThrow(/not declared/u);
  });

  it("preserves current CSV table handoff and refuses to manufacture binary handoff", () => {
    expect(resolveResultActions({
      declaration: { class: "table", capabilities: ["handoff"] },
      primary: null,
      handoff: { type: "table", format: "csv", compatibleTargets: 2 },
    })).toHaveLength(1);
    expect(resolveResultActions({
      declaration: { class: "file", capabilities: ["handoff"] },
      primary: null,
    })).toEqual([]);
  });

  it("renders keyboard order independently from which action is primary", () => {
    const actions = resolveResultActions({
      declaration: { class: "text-code", capabilities: ["copy", "download"] },
      primary: "download",
      hasCopyPayload: true,
      artifact: verifiedText,
    });
    const rendered = ResultActions({
      actions,
      onAction: { copy: () => undefined, download: () => undefined },
    }) as unknown as { props: { children: Array<{ props: { "aria-label": string; class?: string } }> } };

    expect(rendered.props.children.map((child) => child.props["aria-label"])).toEqual([
      "Copia risultato",
      "Scarica risultato — azione principale",
    ]);
    expect(rendered.props.children[0]?.props.class).toBeUndefined();
    expect(rendered.props.children[1]?.props.class).toBe("primary");
  });
});
