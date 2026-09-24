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
      GOLD: 14,
      PARTIAL: 1,
      IMPLEMENTED_UNVERIFIED: 185,
    });
    expect(index.summary.certificationGoldCount).toBe(14);
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
    expect(index.tools.some((tool) => tool.physicalDevice.status === "PASS")).toBe(false);
  }, 30_000);

  it("fails closed when certification claims omit required evidence", async () => {
    const index = await buildCertificationIndex();
    const forged = structuredClone(index);
    const first = forged.tools[0] as unknown as { status: string; goldEligible: boolean; releaseGate: string } | undefined;
    if (first === undefined) throw new Error("certification fixture is empty");
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
