import { describe, expect, it } from "vitest";
import { BatchResult } from "../src/components/tools/shared/BatchResult";
import { replaceBatchItem, summarizeBatchResult, type BatchResultItem } from "../src/runtime/batch-result";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";

function artifact(name: string, verified = true) {
  return createOutputArtifactDescriptor({
    kind: "file",
    name,
    mime: "application/octet-stream",
    bytes: new Uint8Array([1, 2, 3]),
    verification: verified
      ? { state: "verified", verifiedMime: "application/octet-stream", method: "fixture verifier" }
      : { state: "unverified" },
    fidelity: "unknown",
    fidelityNote: "Fixture output.",
  });
}

describe("batch result with isolated failures", () => {
  it("preserves successful downloads when another item fails", () => {
    const items: BatchResultItem[] = [
      { id: "ok-a", label: "a.bin", status: "success", artifact: artifact("a.bin") },
      { id: "bad", label: "bad.bin", status: "error", message: "Malformed input." },
      { id: "ok-b", label: "b.bin", status: "success", artifact: artifact("b.bin") },
      { id: "cancelled", label: "c.bin", status: "cancelled" },
    ];
    const summary = summarizeBatchResult(items);
    expect(summary).toMatchObject({
      total: 4,
      completed: 4,
      successful: 2,
      failed: 1,
      cancelled: 1,
      pending: 0,
      retryIds: ["bad", "cancelled"],
      canDownloadSuccesses: true,
      canDownloadZip: true,
    });
    expect(summary.downloadableArtifacts.map((entry) => entry.name)).toEqual(["a.bin", "b.bin"]);
  });

  it("retry replacement targets one failed item without discarding prior successes", () => {
    const successful = { id: "ok", label: "ok.bin", status: "success" as const, artifact: artifact("ok.bin") };
    const failed = { id: "retry", label: "retry.bin", status: "error" as const, message: "First pass failed." };
    const retried = { id: "retry", label: "retry.bin", status: "success" as const, artifact: artifact("retry.bin") };
    const next = replaceBatchItem([successful, failed], retried);
    expect(next[0]).toBe(successful);
    expect(next[1]).toBe(retried);
    expect(summarizeBatchResult(next).successful).toBe(2);
  });

  it("exposes download capabilities only for actually verified successful artifacts", () => {
    const summary = summarizeBatchResult([
      { id: "unverified", label: "u.bin", status: "success", artifact: artifact("u.bin", false) },
      { id: "unsupported", label: "x.bin", status: "unsupported", retryable: false },
    ]);
    expect(summary.canDownloadSuccesses).toBe(false);
    expect(summary.canDownloadZip).toBe(false);
    expect(summary.retryIds).toEqual([]);
  });

  it("renders summary before per-item state for screen-reader and keyboard comprehension", () => {
    const node = BatchResult({
      items: [{ id: "one", label: "one.bin", status: "success", artifact: artifact("one.bin") }],
    }) as unknown as { props: { children: unknown[] } };
    expect(node.props.children).toHaveLength(2);
  });
});
