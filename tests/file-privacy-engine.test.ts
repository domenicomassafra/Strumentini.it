import { describe, expect, it } from "vitest";
import {
  FilePrivacyError,
  batchChecksumManifest,
  batchRenamePreview,
  clientHandoffIndex,
  createCleanZip,
  createZip,
  detectFileSignature,
  duplicateFileFinder,
  fileListDiff,
  filenameSanitizer,
  folderInventory,
  folderSizeTypeSummary,
  inspectZip,
  runFilePrivacyOperation,
  safeShareChecklist,
  scanSecretPatterns,
  zeroByteOrphanFinder,
} from "../src/engines/file-privacy";

function file(name: string, value: string | Uint8Array, type = "text/plain", relativePath?: string): File {
  const part: BlobPart = typeof value === "string" ? value : (() => {
    const copy = new Uint8Array(value.byteLength);
    copy.set(value);
    return copy.buffer;
  })();
  const result = new File([part], name, { type });
  if (relativePath !== undefined) Object.defineProperty(result, "webkitRelativePath", { value: relativePath });
  return result;
}

describe("file/privacy engine", () => {
  it("creates and verifies a portable SHA-256 manifest", async () => {
    const input = { files: [file("one.txt", "one"), file("two.txt", "two")] };
    const manifest = await batchChecksumManifest(input);
    expect(manifest.algorithm).toBe("SHA-256");
    expect(String(manifest.manifest)).toContain("  one.txt\n");
    const verified = await runFilePrivacyOperation("checksum-verifier", { files: input.files, expected: manifest.manifest });
    expect(verified.allMatch).toBe(true);
    expect(verified.matchCount).toBe(2);
  });

  it("keeps filename and rename previews deterministic and collision-safe", () => {
    const sanitized = filenameSanitizer({ names: ["report?.txt", "CON.txt", "report?.txt"] });
    expect((sanitized.entries as Array<{ sanitized: string }>).map((entry) => entry.sanitized)).toEqual(["report-.txt", "_CON.txt", "report-.txt"]);
    expect(sanitized.collisionCount).toBe(1);
    expect(() => filenameSanitizer({ names: ["../report?.txt"] })).toThrow(FilePrivacyError);
    const renamed = batchRenamePreview({ names: ["a.txt", "b.txt"], pattern: "{index}-{name}{ext}" });
    expect((renamed.entries as Array<{ renamed: string }>).map((entry) => entry.renamed)).toEqual(["1-a.txt", "2-b.txt"]);
    expect(batchRenamePreview({ names: ["same.txt", "same.txt"] }).collisionCount).toBe(1);
  });

  it("detects common signatures without trusting extensions", async () => {
    const png = file("not-an-image.txt", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "application/octet-stream");
    const result = await detectFileSignature(png);
    expect(result.detectedMime).toBe("image/png");
    expect(result.extensionMatches).toBe(false);
  });

  it("summarizes inventory and exact duplicate files", async () => {
    const duplicate = file("duplicate.txt", "same");
    const original = file("original.txt", "same");
    const different = file("different.txt", "diff");
    const empty = file("empty.txt", "");
    const inventory = folderInventory({ files: [duplicate, original, different, empty] });
    expect(inventory.count).toBe(4);
    expect(inventory.emptyCount).toBe(1);
    const summary = folderSizeTypeSummary({ files: [duplicate, original, different, empty] });
    expect((summary.groups as unknown[]).length).toBeGreaterThan(0);
    const duplicates = await duplicateFileFinder({ files: [duplicate, original, different] });
    expect((duplicates.duplicateGroups as unknown[]).length).toBe(1);
    expect((duplicates.duplicateGroups as Array<{ paths: string[] }>)[0]?.paths).toEqual(["duplicate.txt", "original.txt"]);
  });

  it("reports path-based file list differences and optional hash changes", async () => {
    const before = [file("same.txt", "before"), file("removed.txt", "remove")];
    const after = [file("same.txt", "after!"), file("added.txt", "add")];
    const bySize = await fileListDiff({ before, after });
    expect((bySize.differences as Array<{ status: string }>).map((item) => item.status).toSorted()).toEqual(["added", "removed", "unchanged"]);
    const byHash = await fileListDiff({ before, after, compareHashes: true });
    expect((byHash.differences as Array<{ path: string; status: string }>).find((item) => item.path === "same.txt")?.status).toBe("changed");
  });

  it("finds empty files and orphan references", () => {
    const result = zeroByteOrphanFinder({ files: [file("empty.txt", ""), file("present.txt", "x")], references: "present.txt\nmissing.txt" });
    expect(result.emptyFiles).toEqual(["empty.txt"]);
    expect(result.orphanReferences).toEqual(["missing.txt"]);
    expect(result.unreferencedFiles).toEqual(["empty.txt"]);
  });

  it("redacts secret findings and keeps checklist claims bounded", async () => {
    const findings = await scanSecretPatterns({ files: [], text: "api_key=super-secret-value\nplain text" });
    expect(findings.findingCount).toBe(1);
    expect(String((findings.findings as Array<{ preview: string }>)[0]?.preview)).toContain("…");
    const checklist = await safeShareChecklist({ files: [file("notes.txt", "api_key=super-secret-value"), file("empty.txt", "")] });
    expect(checklist.allPassed).toBe(false);
    expect(String(checklist.note)).toContain("not a guarantee");
  });

  it("round-trips a local ZIP and rejects traversal paths", async () => {
    const created = await createZip({ files: [file("docs/readme.txt", "hello"), file("data.csv", "a,b", "text/csv")] });
    expect(created.compression).toBe("store");
    const blob = created.blob as Blob;
    expect(blob).toBeInstanceOf(Blob);
    const archiveFile = new File([await blob.arrayBuffer()], "bundle.zip", { type: "application/zip" });
    const inspected = await inspectZip({ files: [archiveFile] });
    expect(inspected.entryCount).toBe(2);
    expect(inspected.hasPathTraversal).toBe(false);
    await expect(createCleanZip({ files: [file("safe.txt", "x", "text/plain", "../escape.txt")] })).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });
  });

  it("rejects ZIP central-directory size claims beyond the local uncompressed limit", async () => {
    const created = await createZip({ files: [file("small.txt", "x")] });
    const bytes = new Uint8Array(await (created.blob as Blob).arrayBuffer());
    const view = new DataView(bytes.buffer);
    let central = -1;
    for (let offset = 0; offset <= bytes.length - 46; offset += 1) {
      if (view.getUint32(offset, true) === 0x02014b50) {
        central = offset;
        break;
      }
    }
    expect(central).toBeGreaterThanOrEqual(0);
    view.setUint32(central + 24, 0xffffffff, true);
    const bomb = new File([bytes], "bomb.zip", { type: "application/zip" });
    await expect(inspectZip({ files: [bomb] })).rejects.toMatchObject({ code: "ARCHIVE_TOO_LARGE" });
  });

  it("generates a bounded client handoff index with hashes", async () => {
    const result = await clientHandoffIndex({ files: [file("brief.txt", "brief")], title: "Acme handoff" });
    expect(result.title).toBe("Acme handoff");
    expect(String(result.markdown)).toContain("# Acme handoff");
    expect(String(result.json)).toContain("local-utility-handoff-index-v1");
  });

  it("normalizes invalid and cancelled operations", async () => {
    await expect(runFilePrivacyOperation("filename-sanitizer", { names: ["../bad"] })).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });
    const controller = new AbortController();
    controller.abort();
    await expect(runFilePrivacyOperation("batch-checksum-manifest", { files: [file("x", "x")] }, controller.signal)).rejects.toBeInstanceOf(FilePrivacyError);
  });
});
