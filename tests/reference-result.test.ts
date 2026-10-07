import { describe, expect, it } from "vitest";
import { ReferenceResultProvenance } from "../src/components/tools/shared/ReferenceResultProvenance";
import { createReferenceResultProvenance } from "../src/runtime/reference-result";

describe("reference/network result provenance", () => {
  it("keeps local formal validity distinct from remote authoritative validation", () => {
    const local = createReferenceResultProvenance({
      state: "local-valid",
      authority: "Agenzia di riferimento",
      checkedAt: "2026-10-05T18:00:00Z",
      validation: "local-formal",
      network: "not-used",
      message: "Formato e checksum locale coerenti.",
    });
    expect(local.state).toBe("local-valid");
    expect(local.validation).toBe("local-formal");
    expect(() => createReferenceResultProvenance({
      ...local,
      state: "remote-valid",
      network: "denied",
    })).toThrow(/authoritative remote validation/u);
  });

  it("requires authority and retrieval time for remote claims", () => {
    const remote = createReferenceResultProvenance({
      state: "remote-valid",
      authority: "Fonte ufficiale",
      checkedAt: "2026-10-05T18:00:00Z",
      retrievedAt: "2026-10-05T18:00:00Z",
      validation: "remote-authoritative",
      network: "used",
      source: "endpoint ufficiale",
      message: "Il record è stato confermato dalla fonte.",
    });
    expect(remote.retrievedAt).toBe("2026-10-05T18:00:00.000Z");
    const node = ReferenceResultProvenance({ value: remote }) as unknown as { props: { children: unknown[] } };
    expect(node.props.children).toHaveLength(3);
  });

  it.each(["stale", "unavailable"] as const)("represents %s without inventing remote validity", (state) => {
    const value = createReferenceResultProvenance({
      state,
      authority: "Fonte ufficiale",
      checkedAt: "2026-09-01T00:00:00Z",
      validation: "none",
      network: state === "unavailable" ? "denied" : "not-used",
      message: state === "stale" ? "Snapshot oltre la finestra di freschezza." : "Fonte non raggiungibile.",
    });
    expect(value.validation).toBe("none");
  });
});
