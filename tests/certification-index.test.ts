import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assertCertificationIndex,
  buildCertificationIndex,
  renderCertificationIndex,
} from "../src/quality/certification";

const outputPath = new URL("../quality/receipts/expanded-catalog-certification.json", import.meta.url);

describe("expanded catalog certification index", () => {
  it("binds all 200 implementations to oracle and fixture authorities", async () => {
    const index = await buildCertificationIndex();
    expect(index.catalogToolCount).toBe(200);
    expect(index.tools).toHaveLength(200);
    expect(new Set(index.tools.map((tool) => tool.id)).size).toBe(200);
    expect(new Set(index.tools.map((tool) => tool.route)).size).toBe(200);
    expect(index.global.oracle).toMatchObject({ status: "PASS", entryCount: 200 });
    expect(index.global.fixtures.status).toBe("PASS");
    expect(index.global.fixtures.familyCount).toBeGreaterThanOrEqual(25);
    expect(index.summary.oracleBoundCount).toBe(200);
    expect(index.summary.fixtureBoundCount).toBe(200);
    for (const tool of index.tools) {
      expect(tool.route).toBe(`/tools/${tool.id}`);
      expect(tool.oracle.entryId).toMatch(/^cand-\d{3}$/u);
      expect(tool.fixtures.length).toBeGreaterThan(0);
      expect(tool.privacy.privacyClass).toBe("LOCAL");
      expect(tool.privacy.network).toBe("forbidden");
      expect(tool.implementation.manifest.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(tool.implementation.module.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(tool.implementation.page.sha256).toMatch(/^[a-f0-9]{64}$/u);
    }
  }, 30_000);

  it("preserves the certified frontier and exposes unresolved evidence", async () => {
    const index = await buildCertificationIndex();
    expect(index.summary.statusCounts).toEqual({
      GOLD: 198,
      PARTIAL: 1,
      IMPLEMENTED_UNVERIFIED: 1,
    });
    expect(index.summary.certificationGoldCount).toBe(198);
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
    expect(businessMath).toHaveLength(16);
    expect(businessMath.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const developerWeb = index.tools.filter((tool) => tool.engine === "developer-web");
    expect(developerWeb).toHaveLength(20);
    expect(developerWeb.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const dataTable = index.tools.filter((tool) => tool.engine === "table-operations" || tool.engine === "table-csv");
    expect(dataTable).toHaveLength(20);
    expect(dataTable.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const dateTime = index.tools.filter((tool) => tool.engine === "date-time");
    expect(dateTime.filter((tool) => tool.status === "GOLD")).toHaveLength(19);
    const textWriting = index.tools.filter((tool) => tool.engine === "text-writing");
    expect(textWriting.filter((tool) => tool.status === "GOLD")).toHaveLength(19);
    const pdf = index.tools.filter((tool) => tool.engine === "pdf");
    expect(pdf).toHaveLength(20);
    expect(pdf.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    const researchKnowledge = index.tools.filter((tool) => tool.engine === "research-knowledge");
    expect(researchKnowledge).toHaveLength(20);
    const researchGold = researchKnowledge.filter((tool) => tool.status === "GOLD");
    expect(researchGold).toHaveLength(19);
    expect(researchGold.every((tool) => tool.locality.status === "PASS" && tool.mobileA11y.status === "PASS" && tool.lazyLoad.status === "PASS")).toBe(true);
    expect(researchGold.every((tool) => tool.oracle.status === "VERIFIED" && tool.fixtures.every((fixture) => fixture.status === "VERIFIED"))).toBe(true);
    const marketingMediaIds = new Set(["exif-remover", "meta-preview", "open-graph-preview", "platform-size-presets", "qr-generator", "qr-reader", "social-character-limit", "url-comparison"]);
    const marketingMedia = index.tools.filter((tool) => marketingMediaIds.has(tool.id));
    expect(marketingMedia).toHaveLength(8);
    expect(marketingMedia.every((tool) => tool.status === "GOLD" && tool.goldEligible && tool.releaseGate === "PASS")).toBe(true);
    // ris-bibtex-converter keeps its real browser acceptance but stays unverified:
    // its oracle is medium confidence with an explicitly unresolved gap.
    const risConverter = index.tools.find((tool) => tool.id === "ris-bibtex-converter");
    expect(risConverter).toMatchObject({
      status: "IMPLEMENTED_UNVERIFIED",
      certificationReceipt: null,
      locality: { status: "PASS" },
      mobileA11y: { status: "PASS" },
      lazyLoad: { status: "PASS" },
    });
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
