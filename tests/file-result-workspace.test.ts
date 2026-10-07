import { describe, expect, it } from "vitest";
import { FileResultWorkspace } from "../src/components/tools/shared/FileResultWorkspace";
import { createFileResultItem, createFileResultWorkspace, fileWorkspacePrivacyCopy } from "../src/runtime/file-result";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";

function artifact(name = "done.pdf") {
  return createOutputArtifactDescriptor({
    kind: "pdf",
    name,
    mime: "application/pdf",
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    verification: { state: "verified", verifiedMime: "application/pdf", method: "PDF parser reopen" },
    fidelity: "structural",
    fidelityNote: "Generated PDF structure verified.",
  });
}

describe("shared file-result workspace", () => {
  it("uses one contract for single and multi-file result rows", () => {
    const firstArtifact = artifact();
    const first = createFileResultItem({
      id: "one",
      source: { name: "a-very-long-source-file-name-that-remains-visible.pdf", byteLength: 10, detectedMime: "application/pdf" },
      status: "success",
      artifact: firstArtifact,
      beforeBytes: 10,
      afterBytes: firstArtifact.byteLength,
    });
    const second = createFileResultItem({
      id: "two",
      source: { name: "second.pdf", byteLength: 20 },
      status: "error",
      message: "File non valido.",
    });
    const workspace = createFileResultWorkspace([first, second], { location: "LOCAL", network: "forbidden" });
    expect(workspace.items).toHaveLength(2);
    expect(workspace.items[0]?.retryable).toBe(false);
    expect(workspace.items[1]?.retryable).toBe(true);
    const node = FileResultWorkspace({ workspace }) as unknown as { props: { children: unknown[] } };
    expect(node.props.children).toHaveLength(2);
  });

  it("keeps progress, cancel and retry state coherent", () => {
    expect(createFileResultItem({
      id: "running",
      source: { name: "video.mp4", byteLength: 100 },
      status: "running",
      progress: 0.5,
    })).toMatchObject({ progress: 0.5, cancellable: true, retryable: false });
    expect(() => createFileResultItem({
      id: "bad-progress",
      source: { name: "video.mp4", byteLength: 100 },
      status: "running",
      progress: 2,
    })).toThrow(/progress/u);
  });

  it("derives privacy copy from the actual runtime/network policy", () => {
    expect(fileWorkspacePrivacyCopy({ location: "LOCAL", network: "forbidden" })).toMatch(/non viene inviato in rete/u);
    expect(fileWorkspacePrivacyCopy({ location: "REFERENCE", network: "reference-only" })).toMatch(/dati di riferimento/u);
    expect(fileWorkspacePrivacyCopy({ location: "REMOTE", network: "required" })).toMatch(/può inviare il contenuto/u);
    expect(() => fileWorkspacePrivacyCopy({ location: "LOCAL", network: "required" })).toThrow(/Unsupported/u);
  });
});
