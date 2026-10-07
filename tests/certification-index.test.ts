import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assertCertificationIndex,
  buildCertificationIndex,
  renderCertificationIndex,
} from "../src/quality/certification";

const outputPath = new URL("../quality/receipts/expanded-catalog-certification.json", import.meta.url);

describe("expanded catalog certification index", () => {
  it("binds every current implementation to oracle and fixture authorities", async () => {
    const registry = JSON.parse(await readFile(new URL("../quality/oracles/registry.json", import.meta.url), "utf8")) as { entry_count: number };
    const index = await buildCertificationIndex();
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
  }, 30_000);

  it("preserves the certified frontier and exposes unresolved evidence", async () => {
    const index = await buildCertificationIndex();
    expect(index.summary.statusCounts).toEqual({
      GOLD: index.tools.filter((tool) => tool.status === "GOLD").length,
      PARTIAL: index.tools.filter((tool) => tool.status === "PARTIAL").length,
      IMPLEMENTED_UNVERIFIED: index.tools.filter((tool) => tool.status === "IMPLEMENTED_UNVERIFIED").length,
    });
    expect(index.summary.certificationGoldCount).toBe(index.catalogToolCount - 4);
    expect(index.summary.releaseEligibleGoldCount).toBe(index.summary.certificationGoldCount);
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
    const csvCleaner = index.tools.find((tool) => tool.id === "csv-cleaner");
    expect(csvCleaner?.releaseGate).toBe("PASS");
    expect(csvCleaner?.goldEligible).toBe(true);
    const businessMath = index.tools.filter((tool) => tool.engine === "business-math");
    expect(businessMath.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const newMathIds = new Set([
      "basic-unit-converter", "battery-vehicle-power-helper", "engineering-unit-converter", "everyday-cost-calculator",
      "fraction-integer-toolkit", "geometry-equation-motion-helper", "interest-savings-calculator", "mortgage-amortization-calculator",
      "reference-size-converter", "scientific-calculator", "statistics-grade-calculator", "storage-download-calculator",
      "gestione-separata-contributi", "inps-artigiani-commercianti",
    ]);
    expect(businessMath.filter((tool) => newMathIds.has(tool.id))).toHaveLength(14);
    expect(businessMath.filter((tool) => newMathIds.has(tool.id)).every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const developerWeb = index.tools.filter((tool) => tool.engine === "developer-web");
    const newDeveloperIds = new Set([
      "base-converter", "chmod-permission-helper", "cidr-calculator", "css-minifier", "html-minifier", "json-repair",
      "json-structural-diff", "json-type-schema-inference", "password-pin-passphrase-generator", "password-strength-estimator",
      "random-picker-team-coupon-generator", "vcf-viewer-csv-export", "x509-csr-inspector", "xml-formatter-validator",
    ]);
    expect(developerWeb.filter((tool) => newDeveloperIds.has(tool.id))).toHaveLength(14);
    const blockedDeveloperIds = new Set(["password-strength-estimator", "xml-formatter-validator"]);
    expect(developerWeb.filter((tool) => newDeveloperIds.has(tool.id)).every((tool) => blockedDeveloperIds.has(tool.id)
      ? tool.status === "IMPLEMENTED_UNVERIFIED" && !tool.goldEligible && tool.releaseGate === "BLOCKED"
      : tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    expect(developerWeb.filter((tool) => !blockedDeveloperIds.has(tool.id)).every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const dataTable = index.tools.filter((tool) => tool.engine === "table-operations" || tool.engine === "table-csv");
    expect(dataTable.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const newTableIds = new Set(["csv-splitter", "csv-to-sql", "table-compare", "fatturapa-reader", "fatturapa-batch-csv"]);
    expect(dataTable.filter((tool) => newTableIds.has(tool.id))).toHaveLength(5);
    expect(dataTable.filter((tool) => newTableIds.has(tool.id)).every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const dateTime = index.tools.filter((tool) => tool.engine === "date-time");
    expect(dateTime.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    expect(dateTime.find((tool) => tool.id === "italian-document-expiry")).toMatchObject({ status: "GOLD", goldEligible: true, releaseGate: "PASS" });
    expect(dateTime.find((tool) => tool.id === "ponti-ferie-optimizer")).toMatchObject({ status: "GOLD", goldEligible: true, releaseGate: "PASS" });
    const textWriting = index.tools.filter((tool) => tool.engine === "text-writing");
    expect(textWriting.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const newTextIds = new Set([
      "fact-sensitive-text-diff", "italian-gulpease-readability", "mojibake-repair", "pdf-copy-text-reflow",
      "phone-link-hashtag-mention-extractor", "semantic-text-chunker", "stable-placeholder-anonymizer",
    ]);
    expect(textWriting.filter((tool) => newTextIds.has(tool.id))).toHaveLength(7);
    expect(textWriting.filter((tool) => newTextIds.has(tool.id)).every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const pdf = index.tools.filter((tool) => tool.engine === "pdf");
    expect(pdf.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const researchKnowledge = index.tools.filter((tool) => tool.engine === "research-knowledge");
    const researchGold = researchKnowledge.filter((tool) => tool.status === "GOLD");
    expect(researchGold).toHaveLength(researchKnowledge.length);
    expect(researchGold.every((tool) => tool.locality.status === "PASS" && tool.mobileA11y.status === "PASS" && tool.lazyLoad.status === "PASS")).toBe(true);
    expect(researchGold.every((tool) => tool.oracle.status === "VERIFIED" && tool.fixtures.every((fixture) => fixture.status === "VERIFIED"))).toBe(true);
    const marketingMediaIds = new Set(["exif-remover", "meta-preview", "open-graph-preview", "platform-size-presets", "qr-generator", "qr-reader", "social-character-limit", "url-comparison"]);
    const marketingMedia = index.tools.filter((tool) => marketingMediaIds.has(tool.id));
    expect(marketingMedia).toHaveLength(8);
    expect(marketingMedia.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const risConverter = index.tools.find((tool) => tool.id === "ris-bibtex-converter");
    expect(risConverter).toMatchObject({
      status: "GOLD",
      goldEligible: true,
      releaseGate: "PASS",
      locality: { status: "PASS" },
      mobileA11y: { status: "PASS" },
      lazyLoad: { status: "PASS" },
      oracle: { status: "VERIFIED" },
    });
    expect(risConverter?.certificationReceipt).toBe("quality/receipts/research-knowledge/ris-bibtex-converter.gold.json");
    expect(index.tools.filter((tool) => tool.status === "IMPLEMENTED_UNVERIFIED").map((tool) => tool.id)).toEqual([
      "password-strength-estimator",
      "xml-formatter-validator",
    ]);
    expect(index.tools.filter((tool) => tool.status === "PARTIAL").map((tool) => tool.id)).toEqual(["image-resize", "microphone-recorder"]);
    expect(index.tools.some((tool) => tool.physicalDevice.status === "PASS")).toBe(false);
  }, 30_000);

  it("fails closed when certification claims omit required evidence", async () => {
    const index = await buildCertificationIndex();
    const forged = structuredClone(index);
    const first = forged.tools.find((tool) => tool.certificationReceipt === null) as unknown as { status: string; goldEligible: boolean; releaseGate: string } | undefined;
    if (first === undefined) throw new Error("certification fixture has no unverified tool");
    first.status = "GOLD";
    first.goldEligible = true;
    first.releaseGate = "PASS";
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
    const index = await buildCertificationIndex();
    const committed = await readFile(outputPath, "utf8");
    expect(committed).toBe(renderCertificationIndex(index));
  }, 30_000);
});
