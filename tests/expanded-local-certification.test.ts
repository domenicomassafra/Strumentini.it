import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildCertificationIndex } from "../src/quality/certification";

const directIds = [
  "aspect-ratio-calculator", "batch-checksum-manifest", "bulk-domain-extractor", "canonical-url-helper", "checksum-verifier",
  "clean-zip-creator", "client-handoff-index-generator", "color-converter", "color-picker", "contact-sheet-generator",
  "contrast-checker", "conversion-rate-scenario", "cpa-cpc-cpm-calculator", "doi-link-builder", "doi-normalizer",
  "domain-subdomain-grouper", "dominant-color-extractor", "duplicate-file-finder", "email-domain-extractor", "favicon-app-icon-size-generator",
  "file-list-diff", "file-signature-detector", "filename-sanitizer", "folder-inventory", "folder-size-type-summary",
  "image-compare-slider", "image-compression", "image-crop", "image-dimensions-batch-inspector", "image-format-conversion",
  "image-metadata-viewer", "image-rename-batch-preview", "isbn-validator-converter", "palette-extractor", "perceptual-duplicate-finder",
  "quote-counter", "redirect-chain-inspector", "research-url-cleaner", "roas-calculator", "robots-directive-helper",
  "safe-share-checklist", "screenshot-border-background-helper", "secret-token-pattern-scanner", "timeline-sorter", "url-bulk-normalizer",
  "utm-parser", "zero-byte-orphan-finder", "zip-contents-inspector", "zip-creator",
] as const;

describe("expanded local Gold frontier", () => {
  it("promotes exactly the 49 direct candidates and keeps the remaining frontier unverified", async () => {
    const index = await buildCertificationIndex();
    const promoted = index.tools.filter((tool) => tool.certificationReceipt?.startsWith("quality/receipts/expanded-local/") === true);
    expect(promoted.map(({ id }) => id).toSorted()).toEqual([...directIds].toSorted());
    expect(promoted).toHaveLength(49);
    expect(promoted.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    expect(promoted.every((tool) => tool.locality.status === "PASS" && tool.mobileA11y.status === "PASS" && tool.lazyLoad.status === "PASS")).toBe(true);
    const unverified = index.tools.filter((tool) => tool.status === "IMPLEMENTED_UNVERIFIED");
    // The batch owns only its fixed 49 tools; later expansion tranches may add
    // unrelated unverified tools without changing this batch's certification.
    expect(unverified.length).toBeGreaterThan(0);
    expect(unverified.some((tool) => directIds.includes(tool.id as typeof directIds[number]))).toBe(false);
    expect(unverified.every((tool) => tool.certificationReceipt === null && tool.blockers.includes("CERTIFICATION_RECEIPT_MISSING"))).toBe(true);
  }, 30_000);

  it("binds one truthful browser PASS result to each direct candidate", async () => {
    const receipt = JSON.parse(await readFile(new URL("../quality/receipts/expanded-local/browser-acceptance.json", import.meta.url), "utf8")) as {
      status: string;
      tools: string[];
      results: Array<{ toolId: string; status: string; assertion: string; outputSha256: string; lazyScriptCount: number; externalTaskRequests: number; nonGetTaskRequests: number; taskContentLeaks: number; runtimeErrors: number; horizontalOverflow: boolean; unlabeledControls: number }>;
    };
    expect(receipt.status).toBe("PASS");
    expect(receipt.tools.toSorted()).toEqual([...directIds].toSorted());
    expect(receipt.results).toHaveLength(49);
    for (const result of receipt.results) {
      expect(result.status).toBe("PASS");
      expect(result.assertion.length).toBeGreaterThan(0);
      expect(result.outputSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(result.lazyScriptCount).toBeGreaterThan(0);
      expect(result.externalTaskRequests).toBe(0);
      expect(result.nonGetTaskRequests).toBe(0);
      expect(result.taskContentLeaks).toBe(0);
      expect(result.runtimeErrors).toBe(0);
      expect(result.horizontalOverflow).toBe(false);
      expect(result.unlabeledControls).toBe(0);
    }
  });
});
