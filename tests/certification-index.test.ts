import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assertCertificationIndex,
  buildCertificationIndex,
  renderCertificationIndex,
} from "../src/quality/certification";

const outputPath = new URL("../quality/receipts/expanded-catalog-certification.json", import.meta.url);

// These assertions examine the same immutable checkout, not a sequence of
// filesystem mutations. Reuse one actual authoritative build to avoid four
// full receipt/fixture rescans when the fleet is under heavy I/O load.
let indexPromise: ReturnType<typeof buildCertificationIndex> | undefined;
function currentCertificationIndex(): ReturnType<typeof buildCertificationIndex> {
  indexPromise ??= buildCertificationIndex();
  return indexPromise;
}

describe("expanded catalog certification index", () => {
  it("binds every current implementation to oracle and fixture authorities", async () => {
    const registry = JSON.parse(await readFile(new URL("../quality/oracles/registry.json", import.meta.url), "utf8")) as { entry_count: number };
    const index = await currentCertificationIndex();
    expect(index.expectedCatalogToolCount).toBe(registry.entry_count);
    expect(index.catalogToolCount).toBe(registry.entry_count);
    expect(index.tools).toHaveLength(registry.entry_count);
    expect(new Set(index.tools.map((tool) => tool.id)).size).toBe(registry.entry_count);
    expect(new Set(index.tools.map((tool) => tool.route)).size).toBe(registry.entry_count);
    expect(index.global.oracle).toMatchObject({ status: "PASS", entryCount: registry.entry_count });
    expect(index.global.fixtures.status).toBe("PASS");
    expect(index.global.fixtures.familyCount).toBeGreaterThanOrEqual(25);
    expect(index.summary.oracleBoundCount).toBe(registry.entry_count);
    expect(index.summary.fixtureBoundCount).toBe(registry.entry_count);
    for (const tool of index.tools) {
      expect(tool.route).toBe(`/tools/${tool.id}`);
      expect(tool.oracle.entryId).toMatch(/^cand-\d{3}$/u);
      expect(tool.fixtures.length).toBeGreaterThan(0);
      if (tool.privacy.location === "LOCAL") {
        expect(tool.privacy.privacyClass).toBe("LOCAL");
        expect(tool.privacy.network).toBe("forbidden");
      } else if (tool.privacy.location === "REFERENCE") {
        expect(tool.privacy.privacyClass).toBe("REFERENCE");
        expect(tool.privacy.network).toBe("reference-only");
      } else {
        throw new Error(`${tool.id}: unexpected runtime location ${tool.privacy.location}`);
      }
      expect(tool.implementation.manifest.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(tool.implementation.module.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(tool.implementation.page.sha256).toMatch(/^[a-f0-9]{64}$/u);
    }
  }, 120_000);

  it("preserves the certified frontier and exposes unresolved evidence", async () => {
    const index = await currentCertificationIndex();
    expect(index.summary.statusCounts).toEqual({
      GOLD: index.tools.filter((tool) => tool.status === "GOLD").length,
      PARTIAL: index.tools.filter((tool) => tool.status === "PARTIAL").length,
      IMPLEMENTED_UNVERIFIED: index.tools.filter((tool) => tool.status === "IMPLEMENTED_UNVERIFIED").length,
    });
    // A newly registered tool may not inherit Gold from an earlier catalog;
    // exact append-only oracle lineage may independently preserve the historic
    // receipts but never weakens the unverified tool's release gate.
    expect(index.summary.statusCounts).toEqual({ GOLD: 257, PARTIAL: 2, IMPLEMENTED_UNVERIFIED: 12 });
    expect(index.tools.find((tool) => tool.id === "eml-msg-viewer")).toMatchObject({
      status: "IMPLEMENTED_UNVERIFIED", goldEligible: false, releaseGate: "BLOCKED",
      oracle: { status: "BOUND", entryId: "cand-271" },
    });
    expect(index.catalogToolCount).toBe(271);
    expect(index.summary.certificationGoldCount).toBe(index.tools.filter((tool) => tool.status === "GOLD").length);
    expect(index.summary.releaseEligibleGoldCount).toBe(index.tools.filter((tool) => tool.goldEligible).length);
    expect(index.summary.releaseEligibleGoldCount).toBeLessThanOrEqual(index.summary.certificationGoldCount);
    // #320 and #036 changed previously Gold-certified PDF password/audio
    // implementations. Historical receipts remain auditable but release gates
    // must fail closed until those changed implementations are recertified.
    // #126 also changes the previously Gold image-format HEIC decoder contract.
    // #169 expands the existing ZIP creator to verified ZIP/GZIP handling:
    // preserve its historical receipt but fail the prior manifest identity.
    expect(index.summary.releaseEligibleGoldCount).toBe(253);
    const zipCreator = index.tools.find((tool) => tool.id === "zip-creator");
    expect(zipCreator).toMatchObject({ status: "GOLD", goldEligible: false, releaseGate: "BLOCKED" });
    expect(zipCreator?.blockers).toContain("RECEIPT_MANIFEST_IDENTITY_STALE");
    const passwordPdf = index.tools.find((tool) => tool.id === "pdf-password-check-remove");
    expect(passwordPdf).toMatchObject({
      status: "GOLD",
      goldEligible: false,
      releaseGate: "BLOCKED",
    });
    expect(passwordPdf?.blockers).toContain("RECEIPT_MANIFEST_IDENTITY_STALE");
    const imageConversion = index.tools.find((tool) => tool.id === "image-format-conversion");
    expect(imageConversion).toMatchObject({ status: "GOLD", goldEligible: false, releaseGate: "BLOCKED" });
    expect(imageConversion?.blockers).toContain("RECEIPT_MANIFEST_IDENTITY_STALE");
    const audioWav = index.tools.find((tool) => tool.id === "audio-generator");
    expect(audioWav).toMatchObject({
      status: "GOLD",
      goldEligible: false,
      releaseGate: "BLOCKED",
    });
    expect(audioWav?.blockers).toContain("RECEIPT_MANIFEST_IDENTITY_STALE");
    expect(index.summary.physicalDevicePassCount).toBe(0);
    expect(index.global.physicalDevice).toMatchObject({
      status: "EXTERNAL",
      observedPassCount: 0,
      missing: ["ios-safari", "android-chrome"],
    });
    const imageResize = index.tools.find((tool) => tool.id === "image-resize");
    expect(imageResize).toMatchObject({
      status: "PARTIAL",
      goldEligible: false,
      physicalDevice: {
        status: "EXTERNAL",
        iosSafari: "MISSING",
        androidChrome: "MISSING",
      },
    });
    const inspector = index.tools.find((tool) => tool.id === "video-inspector");
    expect(inspector).toMatchObject({
      status: "IMPLEMENTED_UNVERIFIED", goldEligible: false, releaseGate: "BLOCKED",
      oracle: { status: "BOUND", entryId: "cand-260" },
    });
    expect(inspector?.certificationReceipt).toBeNull();
    const numbering = index.tools.find((tool) => tool.id === "pdf-page-numbers");
    expect(numbering).toMatchObject({
      status: "IMPLEMENTED_UNVERIFIED", goldEligible: false, releaseGate: "BLOCKED",
      oracle: { status: "BOUND", entryId: "cand-261" },
    });
    expect(numbering?.certificationReceipt).toBeNull();
    for (const [id, entryId] of [["pdf-watermark", "cand-262"], ["ooxml-media-compression", "cand-263"]] as const) {
      const tool = index.tools.find((item) => item.id === id);
      expect(tool).toMatchObject({
        status: "IMPLEMENTED_UNVERIFIED", goldEligible: false, releaseGate: "BLOCKED",
        oracle: { status: "BOUND", entryId },
      });
      expect(tool?.certificationReceipt).toBeNull();
    }
    const businessMath = index.tools.filter((tool) => tool.engine === "business-math");
    expect(businessMath.filter((tool) => tool.id !== "tfr-calculator").every((tool) => tool.status === "GOLD")).toBe(true);
    expect(businessMath.find((tool) => tool.id === "tfr-calculator")).toMatchObject({
      status: "IMPLEMENTED_UNVERIFIED", goldEligible: false, releaseGate: "BLOCKED",
      oracle: { status: "BOUND", entryId: "cand-270" },
    });
    const newMathIds = new Set([
      "basic-unit-converter", "battery-vehicle-power-helper", "engineering-unit-converter", "everyday-cost-calculator",
      "fraction-integer-toolkit", "geometry-equation-motion-helper", "interest-savings-calculator", "mortgage-amortization-calculator",
      "reference-size-converter", "scientific-calculator", "statistics-grade-calculator", "storage-download-calculator",
      "gestione-separata-contributi", "inps-artigiani-commercianti",
    ]);
    expect(businessMath.filter((tool) => newMathIds.has(tool.id))).toHaveLength(14);
    expect(businessMath.filter((tool) => newMathIds.has(tool.id)).every((tool) => tool.status === "GOLD")).toBe(true);
    const developerWeb = index.tools.filter((tool) => tool.engine === "developer-web");
    const newDeveloperIds = new Set([
      "base-converter", "chmod-permission-helper", "cidr-calculator", "css-minifier", "html-minifier", "json-repair",
      "json-structural-diff", "json-type-schema-inference", "password-pin-passphrase-generator", "password-strength-estimator",
      "random-picker-team-coupon-generator", "vcf-viewer-csv-export", "x509-csr-inspector", "xml-formatter-validator",
    ]);
    expect(developerWeb.filter((tool) => newDeveloperIds.has(tool.id))).toHaveLength(14);
    expect(developerWeb.filter((tool) => newDeveloperIds.has(tool.id)).every((tool) => tool.status === "GOLD")).toBe(true);
    expect(developerWeb.every((tool) => tool.status === "GOLD")).toBe(true);
    const dataTable = index.tools.filter((tool) => tool.engine === "table-operations" || tool.engine === "table-csv");
    expect(dataTable.every((tool) => tool.status === "GOLD")).toBe(true);
    const newTableIds = new Set(["csv-splitter", "csv-to-sql", "table-compare", "fatturapa-reader", "fatturapa-batch-csv"]);
    expect(dataTable.filter((tool) => newTableIds.has(tool.id))).toHaveLength(5);
    expect(dataTable.filter((tool) => newTableIds.has(tool.id)).every((tool) => tool.status === "GOLD")).toBe(true);
    const dateTime = index.tools.filter((tool) => tool.engine === "date-time");
    expect(dateTime.every((tool) => tool.status === "GOLD")).toBe(true);
    expect(dateTime.find((tool) => tool.id === "italian-document-expiry")).toMatchObject({ status: "GOLD" });
    expect(dateTime.find((tool) => tool.id === "ponti-ferie-optimizer")).toMatchObject({ status: "GOLD" });
    const textWriting = index.tools.filter((tool) => tool.engine === "text-writing");
    expect(textWriting.every((tool) => tool.status === "GOLD")).toBe(true);
    const newTextIds = new Set([
      "fact-sensitive-text-diff", "italian-gulpease-readability", "mojibake-repair", "pdf-copy-text-reflow",
      "phone-link-hashtag-mention-extractor", "semantic-text-chunker", "stable-placeholder-anonymizer",
    ]);
    expect(textWriting.filter((tool) => newTextIds.has(tool.id))).toHaveLength(7);
    expect(textWriting.filter((tool) => newTextIds.has(tool.id)).every((tool) => tool.status === "GOLD")).toBe(true);
    const pdf = index.tools.filter((tool) => tool.engine === "pdf");
    expect(pdf.filter((tool) => !new Set(["pdf-page-numbers", "pdf-watermark", "pdf-crop-normalize", "pdf-fill-overlays", "pdf-n-up", "printable-pdf-from-text", "pdf-booklet-interleave", "pdf-tables-to-xlsx"]).has(tool.id)).every((tool) => tool.status === "GOLD")).toBe(true);
    expect(pdf.find((tool) => tool.id === "pdf-page-numbers")).toMatchObject({
      status: "IMPLEMENTED_UNVERIFIED", goldEligible: false, releaseGate: "BLOCKED",
    });
    const researchKnowledge = index.tools.filter((tool) => tool.engine === "research-knowledge");
    const researchGold = researchKnowledge.filter((tool) => tool.status === "GOLD");
    expect(researchGold).toHaveLength(researchKnowledge.length);
    expect(researchGold.every((tool) => tool.locality.status === "PASS" && tool.mobileA11y.status === "PASS" && tool.lazyLoad.status === "PASS")).toBe(true);
    expect(researchGold.every((tool) => tool.oracle.status === "VERIFIED" && tool.fixtures.every((fixture) => fixture.status === "VERIFIED"))).toBe(true);
    const marketingMediaIds = new Set(["exif-remover", "meta-preview", "open-graph-preview", "platform-size-presets", "qr-generator", "qr-reader", "social-character-limit", "url-comparison"]);
    const marketingMedia = index.tools.filter((tool) => marketingMediaIds.has(tool.id));
    expect(marketingMedia).toHaveLength(8);
    expect(marketingMedia.every((tool) => tool.status === "GOLD")).toBe(true);
    const risConverter = index.tools.find((tool) => tool.id === "ris-bibtex-converter");
    expect(risConverter).toMatchObject({
      status: "GOLD",
      locality: { status: "PASS" },
      mobileA11y: { status: "PASS" },
      lazyLoad: { status: "PASS" },
      oracle: { status: "VERIFIED" },
    });
    expect(risConverter?.certificationReceipt).toBe("quality/receipts/research-knowledge/ris-bibtex-converter.gold.json");
    expect(index.tools.filter((tool) => tool.status === "IMPLEMENTED_UNVERIFIED").map((tool) => tool.id)).toEqual(["eml-msg-viewer", "ooxml-media-compression", "pdf-booklet-interleave", "pdf-crop-normalize", "pdf-fill-overlays", "pdf-n-up", "pdf-page-numbers", "pdf-tables-to-xlsx", "pdf-watermark", "printable-pdf-from-text", "tfr-calculator", "video-inspector"]);
    expect(index.tools.filter((tool) => tool.status === "PARTIAL").map((tool) => tool.id)).toEqual(["image-resize", "microphone-recorder"]);
    for (const tool of index.tools.filter((entry) => entry.status === "GOLD")) {
      expect(tool.certificationReceipt).not.toBeNull();
      expect(tool.releaseGate).toBe(tool.goldEligible ? "PASS" : "BLOCKED");
    }
    expect(index.tools.some((tool) => tool.physicalDevice.status === "PASS")).toBe(false);
  }, 30_000);

  it("fails closed when certification claims omit required evidence", async () => {
    const index = await currentCertificationIndex();
    const forged = structuredClone(index);
    const first = forged.tools.find((tool) => tool.status === "GOLD") as unknown as { certificationReceipt: string | null } | undefined;
    if (first === undefined) throw new Error("certification fixture has no Gold tool");
    first.certificationReceipt = null;
    expect(() => assertCertificationIndex(forged)).toThrow(/Gold status has no certification receipt/u);

    const countForgery = structuredClone(index) as unknown as { expectedCatalogToolCount: number };
    countForgery.expectedCatalogToolCount -= 1;
    expect(() => assertCertificationIndex(countForgery as never)).toThrow(/expectedCatalogToolCount must match the oracle authority entry count/u);

    const physicalForgery = structuredClone(index);
    const imageResize = physicalForgery.tools.find((tool) => tool.id === "image-resize") as unknown as { physicalDevice: { status: string } } | undefined;
    if (imageResize === undefined) throw new Error("image-resize fixture is missing");
    imageResize.physicalDevice.status = "PASS";
    expect(() => assertCertificationIndex(physicalForgery)).toThrow(/physical PASS lacks required evidence/u);
  }, 30_000);

  it("keeps the committed generated index current", async () => {
    const index = await currentCertificationIndex();
    const committed = await readFile(outputPath, "utf8");
    expect(committed).toBe(renderCertificationIndex(index));
  }, 30_000);
});
