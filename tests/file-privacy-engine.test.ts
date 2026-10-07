import { describe, expect, it } from "vitest";
import {
  FilePrivacyError,
  analyzeFileSize,
  batchChecksumManifest,
  batchRenamePreview,
  clientHandoffIndex,
  createCleanZip,
  createAiCodeFenceBundle,
  createZip,
  detectFileSignature,
  duplicateFileFinder,
  fileListDiff,
  filenameSanitizer,
  folderCompare,
  folderInventory,
  folderSizeTypeSummary,
  inspectMetadataRisk,
  inspectZip,
  parseAiCodeFenceFiles,
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

  it("fails closed when distinct source paths sanitize to the same relative identity", async () => {
    const first = file("report?.txt", "one", "text/plain", "docs/report?.txt");
    const second = file("report*.txt", "two", "text/plain", "docs/report*.txt");
    await expect(folderCompare({ before: [first, second], after: [file("ok.txt", "ok")] }))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
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
    expect((findings.findings as Array<Record<string, unknown>>)[0]).toMatchObject({ line: 1, kind: "secret-assignment", evidenceCategory: "potential-secret-pattern", classification: "potential", columnStart: 1 });
    expect(String((findings.findings as Array<{ preview: string }>)[0]?.preview)).toContain("…");
    expect(JSON.stringify(findings)).not.toContain("super-secret-value");
    const checklist = await safeShareChecklist({ files: [file("notes.txt", "api_key=super-secret-value"), file("empty.txt", "")] });
    expect(checklist.allPassed).toBe(false);
    expect(String(checklist.note)).toContain("not a guarantee");
    expect(checklist).toMatchObject({ userContext: { recipientConfirmed: false, sensitiveContentReviewed: false }, totalChecks: 6 });
    const confirmed = await safeShareChecklist({ files: [file("clean.txt", "ordinary content")], recipientConfirmed: true, sensitiveContentReviewed: true });
    expect(confirmed).toMatchObject({ allPassed: true, passedCount: 6, totalChecks: 6, userContext: { recipientConfirmed: true, sensitiveContentReviewed: true } });
  });

  it("reports local metadata-risk evidence categories and spans without exporting source content", async () => {
    const result = await inspectMetadataRisk({ files: [file("notes.log", "hello\npassword=something\n/home/alice/report")] });
    const first = (result.files as Array<Record<string, unknown>>)[0]!;
    expect(first.riskCount).toBeGreaterThanOrEqual(3);
    expect(first.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "secret-like-text", line: 2 }),
      expect.objectContaining({ category: "path-like-text", line: 3 }),
      expect.objectContaining({ category: "temporary-backup-name" }),
    ]));
    expect(JSON.stringify(first.findings)).not.toContain("something");
    expect(JSON.stringify(first.findings)).not.toContain("alice");
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

  it("explains image and ZIP size drivers without mutating bytes or guessing savings", async () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    png.set([0x49, 0x48, 0x44, 0x52], 12);
    png.set([0, 0, 0, 2], 16);
    png.set([0, 0, 0, 3], 20);
    const imageFile = file("tiny.png", png, "image/png");
    const imageBefore = new Uint8Array(await imageFile.arrayBuffer());
    const imageResult = await analyzeFileSize({ files: [imageFile] });
    expect(imageResult).toMatchObject({
      kind: "image",
      bytes: png.byteLength,
      sourceMutation: "none",
      estimatedSavingsBytes: null,
      image: { width: 2, height: 3, pixels: 6, encoding: "image/png" },
      nextActions: ["image-metadata-viewer", "image-resize", "image-compression"],
    });
    expect(imageResult.sourceSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(new Uint8Array(await imageFile.arrayBuffer())).toEqual(imageBefore);

    const created = await createZip({ files: [file("small.txt", "a"), file("large.txt", "abcdefghij")] });
    const zipFile = new File([await (created.blob as Blob).arrayBuffer()], "bundle.zip", { type: "application/zip" });
    const zipBefore = new Uint8Array(await zipFile.arrayBuffer());
    const zipResult = await analyzeFileSize({ files: [zipFile] });
    expect(zipResult).toMatchObject({
      kind: "zip",
      sourceMutation: "none",
      estimatedSavingsBytes: null,
      zip: { entryCount: 2, totalUncompressedBytes: 11 },
      nextActions: ["zip-contents-inspector", "archive-checksum-manifest"],
    });
    const largest = (zipResult.zip as { largestEntries: Array<{ path: string }> }).largestEntries;
    expect(largest[0]?.path).toBe("large.txt");
    expect(new Uint8Array(await zipFile.arrayBuffer())).toEqual(zipBefore);

    const opaque = await analyzeFileSize({ files: [file("opaque.bin", new Uint8Array([1, 2, 3, 4]), "application/octet-stream")] });
    expect(opaque).toMatchObject({ kind: "unknown", estimatedSavingsBytes: null, nextActions: ["file-signature-detector"] });
  });

  it("turns fenced code into the exact previewed safe ZIP entries", async () => {
    const source = [
      "filename: src/app.ts",
      "```ts",
      "export const answer = 42;",
      "```",
      "```json filename=package.json",
      '{"name":"demo"}',
      "```",
      "```python",
      'print("ciao")',
      "```",
    ].join("\n");
    const parsed = parseAiCodeFenceFiles(source);
    expect(parsed.map((entry) => entry.path)).toEqual(["src/app.ts", "package.json", "snippet-003.py"]);
    expect(parsed.map((entry) => entry.content)).toEqual([
      "export const answer = 42;\n",
      '{"name":"demo"}\n',
      'print("ciao")\n',
    ]);
    const bundled = await createAiCodeFenceBundle({ text: source });
    expect(bundled).toMatchObject({ operation: "ai-code-fence-bundle", fileCount: 3, filename: "ai-code-files.zip", compression: "store" });
    const archive = new File([await (bundled.blob as Blob).arrayBuffer()], "bundle.zip", { type: "application/zip" });
    const inspected = await inspectZip({ files: [archive] });
    expect((inspected.entries as Array<{ path: string }>).map((entry) => entry.path)).toEqual(parsed.map((entry) => entry.path));
    expect((bundled.preview as Array<{ path: string }>).map((entry) => entry.path)).toEqual(parsed.map((entry) => entry.path));
  });

  it("refuses unsafe code-fence paths and resolves duplicate names deterministically", () => {
    const duplicates = parseAiCodeFenceFiles("```js filename=app.js\n1\n```\n```js filename=app.js\n2\n```");
    expect(duplicates.map((entry) => entry.path)).toEqual(["app.js", "app-2.js"]);
    expect(() => parseAiCodeFenceFiles("```ts filename=../escape.ts\nx\n```")).toThrow(/UNSAFE_ARCHIVE_PATH/u);
    expect(() => parseAiCodeFenceFiles("```ts filename=/absolute.ts\nx\n```")).toThrow(/UNSAFE_ARCHIVE_PATH/u);
    expect(() => parseAiCodeFenceFiles("```ts\nunclosed")).toThrow(/not closed/u);
  });

  it("generates a bounded client handoff index with hashes", async () => {
    const result = await clientHandoffIndex({ files: [file("handoff.txt", "LEAK_ME_CONTENT_42", "text/plain", "docs/handoff.txt")], title: "Acme handoff" });
    expect(result.title).toBe("Acme handoff");
    expect(String(result.markdown)).toContain("# Acme handoff");
    expect(String(result.json)).toContain("local-utility-handoff-index-v1");
    const machine = JSON.parse(String(result.json)) as { schema: string; files: Array<{ path: string; size: number; sha256: string }> };
    expect(machine).toMatchObject({ schema: "local-utility-handoff-index-v1" });
    expect(machine.files[0]).toMatchObject({ path: "docs/handoff.txt", size: 18 });
    expect(machine.files[0]?.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(String(result.json)).not.toContain("LEAK_ME_CONTENT_42");
    expect(String(result.markdown)).not.toContain("LEAK_ME_CONTENT_42");
  });

  it("normalizes invalid and cancelled operations", async () => {
    await expect(runFilePrivacyOperation("filename-sanitizer", { names: ["../bad"] })).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });
    const controller = new AbortController();
    controller.abort();
    await expect(runFilePrivacyOperation("batch-checksum-manifest", { files: [file("x", "x")] }, controller.signal)).rejects.toBeInstanceOf(FilePrivacyError);
  });
});
