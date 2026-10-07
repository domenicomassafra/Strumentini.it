import { h } from "preact";
import render from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import type { FilePrivacyOperation } from "../src/engines/file-privacy";
import { createZip, runFilePrivacyOperation } from "../src/engines/file-privacy";
import { FilePrivacyResultV2, filePrivacyResultDeclaration, prepareFilePrivacyResult } from "../src/components/tools/file-privacy/FilePrivacyResultV2";

const OWNED: readonly FilePrivacyOperation[] = [
  "archive-checksum-manifest",
  "batch-checksum-manifest",
  "batch-rename-preview",
  "checksum-verifier",
  "clean-zip-creator",
  "client-handoff-index-generator",
  "duplicate-file-finder",
  "file-list-diff",
  "file-signature-detector",
  "filename-sanitizer",
  "folder-compare",
  "folder-inventory",
  "folder-size-type-summary",
  "metadata-risk-inspector",
  "safe-share-checklist",
  "secret-token-pattern-scanner",
  "zero-byte-orphan-finder",
  "zip-contents-inspector",
  "zip-creator",
] as const;

function file(name: string, value: string, type = "text/plain"): File {
  return new File([value], name, { type });
}

describe("file/privacy Result v2", () => {
  it("declares exactly the 19 shared owner operations with truthful semantic classes", () => {
    expect(OWNED).toHaveLength(19);
    const classes = Object.fromEntries(OWNED.map((operation) => [operation, filePrivacyResultDeclaration(operation).class]));
    expect(classes).toMatchObject({
      "archive-checksum-manifest": "text-code",
      "batch-checksum-manifest": "text-code",
      "client-handoff-index-generator": "text-code",
      "checksum-verifier": "validator",
      "file-signature-detector": "validator",
      "metadata-risk-inspector": "validator",
      "safe-share-checklist": "validator",
      "secret-token-pattern-scanner": "validator",
      "zip-contents-inspector": "validator",
      "clean-zip-creator": "file",
      "zip-creator": "file",
      "batch-rename-preview": "batch",
      "duplicate-file-finder": "batch",
      "file-list-diff": "batch",
      "filename-sanitizer": "batch",
      "folder-compare": "batch",
      "folder-inventory": "batch",
      "folder-size-type-summary": "batch",
      "zero-byte-orphan-finder": "batch",
    });
    expect(OWNED.every((operation) => filePrivacyResultDeclaration(operation).capabilities.includes("retry"))).toBe(true);
    expect(OWNED.every((operation) => filePrivacyResultDeclaration(operation).capabilities.includes("reset"))).toBe(true);
  });

  it("prepares bounded text output and a measured local workspace without changing the engine result", async () => {
    const files = [file("uno.txt", "uno"), file("due.txt", "due")];
    const result = await runFilePrivacyOperation("batch-checksum-manifest", { files });
    const prepared = await prepareFilePrivacyResult("batch-checksum-manifest", result, { files });
    expect(prepared.value).toBe(result);
    expect(prepared.declaration.class).toBe("text-code");
    expect(prepared.preview.total).toBeGreaterThan(0);
    expect(prepared.preview.shown).toBeLessThanOrEqual(80);
    expect(prepared.downloadArtifact?.download.ready).toBe(true);
    expect(prepared.workspace.runtime).toEqual({ location: "LOCAL", network: "forbidden" });
    expect(prepared.workspace.privacyCopy).toMatch(/non viene inviato in rete/u);
    expect(prepared.workspace.items[0]).toMatchObject({
      status: "success",
      beforeBytes: files.reduce((sum, item) => sum + item.size, 0),
      retryable: true,
    });
  });

  it("verifies generated ZIP bytes before enabling their download", async () => {
    const files = [file("docs/uno.txt", "uno")];
    const result = await createZip({ files });
    const prepared = await prepareFilePrivacyResult("zip-creator", result, { files });
    expect(prepared.declaration.class).toBe("file");
    expect(prepared.downloadArtifact).toMatchObject({
      mime: "application/zip",
      verification: { state: "verified", signature: "PK" },
      download: { ready: true, filename: "local-files.zip" },
    });
    expect(prepared.workspace.items[0]?.artifact?.byteLength).toBe(result.byteLength);
    const html = render(h(FilePrivacyResultV2, { operation: "zip-creator", prepared, onRetry: () => undefined, onReset: () => undefined }));
    expect(html).toContain('data-result-class="file"');
    expect(html).toContain('data-result-slot="file-workspace"');
    expect(html).toContain('data-result-action="download"');
    expect(html).toContain('data-result-action="retry"');
    expect(html).toContain('data-result-action="reset"');
  });

  it("keeps validator findings semantic while retaining full raw data only in the bounded artifact", async () => {
    const files = [file("notes.txt", "api_key=super-secret-value")];
    const result = await runFilePrivacyOperation("secret-token-pattern-scanner", { files });
    const prepared = await prepareFilePrivacyResult("secret-token-pattern-scanner", result, { files });
    expect(prepared.declaration.class).toBe("validator");
    expect(prepared.copyText).toContain("risultati_trovati");
    expect(prepared.preview.artifact.download.ready).toBe(true);
    expect(prepared.downloadArtifact).toBeNull();
    const html = render(h(FilePrivacyResultV2, { operation: "secret-token-pattern-scanner", prepared, onRetry: () => undefined, onReset: () => undefined }));
    expect(html).toContain('data-result-class="validator"');
    expect(html).toContain('data-result-slot="checks"');
    expect(html).toContain("data-result-secondary-raw");
  });

  it("renders text and aggregate batch outputs through their Result v2 slots", async () => {
    const files = [file("uno.txt", "uno")];
    const textValue = await runFilePrivacyOperation("batch-checksum-manifest", { files });
    const textPrepared = await prepareFilePrivacyResult("batch-checksum-manifest", textValue, { files });
    const textHtml = render(h(FilePrivacyResultV2, { operation: "batch-checksum-manifest", prepared: textPrepared, onRetry: () => undefined, onReset: () => undefined }));
    expect(textHtml).toContain('data-result-class="text-code"');
    expect(textHtml).toContain('data-result-slot="selectable-output"');
    expect(textHtml).toContain('data-result-slot="counts"');

    const batchValue = await runFilePrivacyOperation("folder-inventory", { files });
    const batchPrepared = await prepareFilePrivacyResult("folder-inventory", batchValue, { files });
    const batchHtml = render(h(FilePrivacyResultV2, { operation: "folder-inventory", prepared: batchPrepared, onRetry: () => undefined, onReset: () => undefined }));
    expect(batchHtml).toContain('data-result-class="batch"');
    expect(batchHtml).toContain('data-result-slot="batch-summary"');
    expect(batchHtml).toContain("data-result-secondary-raw");
  });

  it("preserves successful batch rows when another row fails", async () => {
    const mixed = {
      operation: "batch-rename-preview" as const,
      entries: [
        { name: "ok.txt", size: 3, original: "ok.txt", renamed: "01-ok.txt" },
        { name: "bad.txt", size: 4, status: "error", message: "READ_FAILURE" },
        { name: "still-ok.txt", size: 8, original: "still-ok.txt", renamed: "02-still-ok.txt" },
      ],
      changedCount: 2,
      collisionCount: 0,
    };
    const prepared = await prepareFilePrivacyResult("batch-rename-preview", mixed, { names: ["ok.txt", "bad.txt", "still-ok.txt"] });
    expect(prepared.workspace.items.map(({ status }) => status)).toEqual(["success", "error", "success"]);
    expect(prepared.workspace.items.filter(({ status }) => status === "success")).toHaveLength(2);
    expect(prepared.workspace.items[1]).toMatchObject({ retryable: true, message: "READ_FAILURE" });
    const html = render(h(FilePrivacyResultV2, { operation: "batch-rename-preview", prepared, onRetry: () => undefined, onReset: () => undefined }));
    expect(html).toContain("Completati");
    expect(html).toContain("Da riprovare");
    expect(html).toContain("READ_FAILURE");
    expect(html).toContain("01-ok.txt");
    expect(html).toContain("02-still-ok.txt");
  });
});
