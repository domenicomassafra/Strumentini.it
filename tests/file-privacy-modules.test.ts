import { describe, expect, it } from "vitest";
import type { ToolModule } from "../src/runtime/types";
import { compileCatalog } from "../scripts/lib/catalog-compiler";
import batchChecksumManifest from "../src/tools/batch-checksum-manifest/module";
import checksumVerifier from "../src/tools/checksum-verifier/module";
import fileSignatureDetector from "../src/tools/file-signature-detector/module";
import folderInventory from "../src/tools/folder-inventory/module";
import folderSizeTypeSummary from "../src/tools/folder-size-type-summary/module";
import duplicateFileFinder from "../src/tools/duplicate-file-finder/module";
import filenameSanitizer from "../src/tools/filename-sanitizer/module";
import batchRenamePreview from "../src/tools/batch-rename-preview/module";
import zipContentsInspector from "../src/tools/zip-contents-inspector/module";
import zipCreator from "../src/tools/zip-creator/module";
import cleanZipCreator from "../src/tools/clean-zip-creator/module";
import archiveChecksumManifest from "../src/tools/archive-checksum-manifest/module";
import metadataRiskInspector from "../src/tools/metadata-risk-inspector/module";
import secretTokenPatternScanner from "../src/tools/secret-token-pattern-scanner/module";
import safeShareChecklist from "../src/tools/safe-share-checklist/module";
import clientHandoffIndexGenerator from "../src/tools/client-handoff-index-generator/module";
import fileListDiff from "../src/tools/file-list-diff/module";
import folderCompare from "../src/tools/folder-compare/module";
import zeroByteOrphanFinder from "../src/tools/zero-byte-orphan-finder/module";
import batchManifest from "../src/tools/batch-checksum-manifest/manifest";
import checksumManifest from "../src/tools/checksum-verifier/manifest";
import signatureManifest from "../src/tools/file-signature-detector/manifest";
import inventoryManifest from "../src/tools/folder-inventory/manifest";
import summaryManifest from "../src/tools/folder-size-type-summary/manifest";
import duplicateManifest from "../src/tools/duplicate-file-finder/manifest";
import filenameManifest from "../src/tools/filename-sanitizer/manifest";
import renameManifest from "../src/tools/batch-rename-preview/manifest";
import zipInspectorManifest from "../src/tools/zip-contents-inspector/manifest";
import zipManifest from "../src/tools/zip-creator/manifest";
import cleanZipManifest from "../src/tools/clean-zip-creator/manifest";
import archiveManifest from "../src/tools/archive-checksum-manifest/manifest";
import metadataManifest from "../src/tools/metadata-risk-inspector/manifest";
import scannerManifest from "../src/tools/secret-token-pattern-scanner/manifest";
import checklistManifest from "../src/tools/safe-share-checklist/manifest";
import handoffManifest from "../src/tools/client-handoff-index-generator/manifest";
import diffManifest from "../src/tools/file-list-diff/manifest";
import compareManifest from "../src/tools/folder-compare/manifest";
import orphanManifest from "../src/tools/zero-byte-orphan-finder/manifest";

const file = (name: string, value: string, type = "text/plain"): File => new File([value], name, { type });
const context = { defaults: {} };

describe("file/privacy tool modules", () => {
  it("keeps all 19 expansion manifests structurally catalogable", () => {
    const manifests = [
      batchManifest,
      checksumManifest,
      signatureManifest,
      inventoryManifest,
      summaryManifest,
      duplicateManifest,
      filenameManifest,
      renameManifest,
      zipInspectorManifest,
      zipManifest,
      cleanZipManifest,
      archiveManifest,
      metadataManifest,
      scannerManifest,
      checklistManifest,
      handoffManifest,
      diffManifest,
      compareManifest,
      orphanManifest,
    ];
    const artifacts = compileCatalog(manifests);
    expect(artifacts.summaries).toHaveLength(19);
    expect(new Set(artifacts.summaries.map((summary) => summary.id)).size).toBe(19);
    expect(artifacts.summaries.every((summary) => summary.runtime.location === "LOCAL" && summary.runtime.network === "forbidden")).toBe(true);
    expect(artifacts.summaries.every((summary) => summary.route === `/tools/${summary.id}`)).toBe(true);
  });

  it("routes every module through a real bounded operation", async () => {
    const one = file("one.txt", "one");
    const zipValue = await zipCreator.run({ files: [one] }, context) as { blob: Blob };
    const zipFile = new File([await zipValue.blob.arrayBuffer()], "bundle.zip", { type: "application/zip" });
    const cases: Array<[string, ToolModule, unknown]> = [
      ["batch", batchChecksumManifest, { files: [one] }],
      ["verify", checksumVerifier, { files: [one], expected: "0000000000000000000000000000000000000000000000000000000000000000  one.txt" }],
      ["signature", fileSignatureDetector, { files: [one] }],
      ["inventory", folderInventory, { files: [one] }],
      ["summary", folderSizeTypeSummary, { files: [one] }],
      ["duplicates", duplicateFileFinder, { files: [one] }],
      ["sanitize", filenameSanitizer, { names: ["one.txt"] }],
      ["rename", batchRenamePreview, { names: ["one.txt"] }],
      ["zip-inspect", zipContentsInspector, { files: [zipFile] }],
      ["zip", zipCreator, { files: [one] }],
      ["clean-zip", cleanZipCreator, { files: [one] }],
      ["archive", archiveChecksumManifest, { files: [zipFile] }],
      ["metadata", metadataRiskInspector, { files: [one] }],
      ["scanner", secretTokenPatternScanner, { text: "plain" }],
      ["checklist", safeShareChecklist, { files: [one] }],
      ["handoff", clientHandoffIndexGenerator, { files: [one] }],
      ["diff", fileListDiff, { before: [one], after: [one] }],
      ["compare", folderCompare, { before: [one], after: [one] }],
      ["orphan", zeroByteOrphanFinder, { files: [one] }],
    ];
    for (const [name, module, input] of cases) {
      const result = await module.run(input, context);
      expect(result, name).toBeTruthy();
    }
  });

  it("keeps local tool inputs bounded and reports invalid empty selections", async () => {
    await expect(batchChecksumManifest.run({ files: [] }, context)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(zeroByteOrphanFinder.run({ files: [file("empty", "")] }, context)).resolves.toMatchObject({ emptyFiles: ["empty"] });
  });
});
