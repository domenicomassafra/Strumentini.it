import { describe, expect, it } from "vitest";
import { BoundedTableResultPreview, BoundedTextResultPreview } from "../src/components/tools/shared/BoundedResultPreview";
import { createBoundedTablePreview, createBoundedTextPreview } from "../src/runtime/bounded-preview";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";

function textArtifact(text: string) {
  return createOutputArtifactDescriptor({
    kind: "text",
    name: "large.txt",
    mime: "text/plain",
    bytes: new TextEncoder().encode(text),
    verification: { state: "verified", verifiedMime: "text/plain", method: "UTF-8 decode/encode contract" },
    fidelity: "lossless",
    fidelityNote: "The complete generated text is retained byte-for-byte.",
  });
}

describe("bounded large-result preview", () => {
  it("truncates only the preview while preserving byte-identical full output", () => {
    const artifact = textArtifact(["uno", "due", "tre", "quattro"].join("\n"));
    const originalBytes = [...artifact.bytes];
    const preview = createBoundedTextPreview(artifact, 2);
    expect(preview).toMatchObject({ text: "uno\ndue", shown: 2, total: 4, truncated: true, unit: "lines" });
    expect([...preview.artifact.bytes]).toEqual(originalBytes);
    expect(preview.artifact.byteLength).toBe(artifact.byteLength);
  });

  it("reports shown and total rows for table previews without discarding the complete artifact", () => {
    const artifact = createOutputArtifactDescriptor({
      kind: "structured",
      name: "table.csv",
      mime: "text/csv",
      bytes: new TextEncoder().encode("a,b\n1,2\n3,4\n5,6"),
      verification: { state: "verified", verifiedMime: "text/csv", method: "CSV serializer contract" },
      fidelity: "structural",
      fidelityNote: "Rows and columns come from the generated table model.",
    });
    const preview = createBoundedTablePreview(artifact, ["a", "b"], [["1", "2"], ["3", "4"], ["5", "6"]], 2);
    expect(preview).toMatchObject({ shown: 2, total: 3, truncated: true, unit: "rows" });
    expect(preview.rows).toEqual([["1", "2"], ["3", "4"]]);
    expect(preview.artifact.bytes).toBe(artifact.bytes);
  });

  it("renders a concise status separately from the selectable payload", () => {
    const textPreview = createBoundedTextPreview(textArtifact("a\nb\nc"), 1, "code");
    const textNode = BoundedTextResultPreview({ preview: textPreview }) as unknown as { props: { children: unknown[] } };
    expect(textNode.props.children).toHaveLength(2);

    const tableArtifact = createOutputArtifactDescriptor({
      kind: "structured",
      name: "data.csv",
      mime: "text/csv",
      bytes: new TextEncoder().encode("a\n1"),
      verification: { state: "verified", verifiedMime: "text/csv", method: "CSV serializer contract" },
      fidelity: "structural",
      fidelityNote: "Generated table.",
    });
    const tableNode = BoundedTableResultPreview({
      preview: createBoundedTablePreview(tableArtifact, ["a"], [["1"]], 10),
    }) as unknown as { props: { children: unknown[] } };
    expect(tableNode.props.children).toHaveLength(2);
  });

  it("rejects unbounded preview requests", () => {
    expect(() => createBoundedTextPreview(textArtifact("a"), 0)).toThrow(/positive integer/u);
  });
});
