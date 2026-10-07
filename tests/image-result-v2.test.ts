import { readFileSync } from "node:fs";
import { h } from "preact";
import render from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { ImageResultV2, prepareImageResult } from "../src/components/tools/image-visual/ImageResultV2";
import { resultV2Inventory } from "../src/catalog/result-v2-inventory.generated";
import { IMAGE_RESULT_DECLARATIONS } from "../src/tools/image-result-declarations";
import { catalog } from "../src/generated/catalog";

const ticket97 = ".scratch/strumentiutili-expansion-20261005/issues/97-migrate-image-shared-renderers-to-result-v2.md";

describe("ticket 97 image Result v2 migration", () => {
  it("declares every current image/image-visual tool with semantic result classes", () => {
    const declarations = Object.entries(IMAGE_RESULT_DECLARATIONS);
    const imageToolIds = catalog
      .filter(({ engine }) => engine === "image" || engine === "image-visual")
      .map(({ id }) => id)
      .toSorted();
    const expectedDeclarationIds = [...new Set([...imageToolIds, "color-blindness-image-simulation"])].toSorted();
    expect(declarations.map(([id]) => id).toSorted()).toEqual(expectedDeclarationIds);
    expect(declarations.filter(([, value]) => value.class === "image").length).toBeGreaterThan(0);
    expect(declarations.filter(([, value]) => value.class === "calculator").length).toBeGreaterThan(0);
    expect(declarations.filter(([, value]) => value.class === "validator").length).toBeGreaterThan(0);

    const owned = resultV2Inventory.filter(({ migrationOwner }) => migrationOwner === ticket97);
    expect(owned.map(({ toolId }) => toolId).toSorted()).toEqual(imageToolIds);
    for (const entry of owned) {
      const declaration = IMAGE_RESULT_DECLARATIONS[entry.toolId as keyof typeof IMAGE_RESULT_DECLARATIONS];
      expect(entry.resultDeclaration).toEqual({ state: "declared", ...declaration });
    }
  });

  it("verifies generated image bytes before exposing a downloadable artifact", async () => {
    const bytes = readFileSync(new URL("../quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png", import.meta.url));
    const blob = new Blob([bytes], { type: "image/png" });
    const prepared = await prepareImageResult({ blob, filename: "verified.png", outputMime: "image/png", width: 2, height: 3 });
    expect(prepared.artifacts).toHaveLength(1);
    expect(prepared.artifacts[0]?.artifact).toMatchObject({
      name: "verified.png",
      mime: "image/png",
      verification: { state: "verified", verifiedMime: "image/png" },
      download: { ready: true },
    });

    const invalid = await prepareImageResult({
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
      filename: "invalid.png",
      outputMime: "image/png",
      width: 1,
      height: 1,
    });
    expect(invalid.artifacts[0]?.artifact.download.ready).toBe(false);
    expect(invalid.artifacts[0]?.artifact.verification.state).toBe("invalid");
  });

  it("renders image results through preview, media metrics, verified file workspace and truthful actions", async () => {
    const bytes = readFileSync(new URL("../quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png", import.meta.url));
    const blob = new Blob([bytes], { type: "image/png" });
    const result = await prepareImageResult({ blob, filename: "crop.png", outputMime: "image/png", width: 2, height: 3 });
    const html = render(h(ImageResultV2, {
      toolId: "image-crop",
      result,
      sourceFiles: [new File([bytes], "source.png", { type: "image/png" })],
      onReset: () => undefined,
      onRetry: () => undefined,
    }));
    expect(html).toContain('data-result-class="image"');
    expect(html).toContain('data-result-slot="visual-preview"');
    expect(html).toContain('data-result-slot="media-metrics"');
    expect(html).toContain('data-result-slot="file-workspace"');
    expect(html).toContain("Firma/contenitore coerenti");
    expect(html).toContain('data-result-action="download"');
    expect(html).toContain('data-result-action="retry"');
    expect(html).toContain('data-result-action="reset"');
  });

  it("renders calculator and validator image-family tools with Result v2 answer semantics", () => {
    const calculatorHtml = render(h(ImageResultV2, {
      toolId: "aspect-ratio-calculator",
      result: { raw: { ratio: "4:3 (1.3333)", width: 1600, height: 1200 }, artifacts: [] },
      onReset: () => undefined,
    }));
    expect(calculatorHtml).toContain('data-result-class="calculator"');
    expect(calculatorHtml).toContain('data-result-slot="primary"');
    expect(calculatorHtml).toContain('data-result-slot="breakdown"');
    expect(calculatorHtml).toContain('data-result-action="copy"');
    expect(calculatorHtml).toContain('data-result-action="reset"');

    const validatorHtml = render(h(ImageResultV2, {
      toolId: "contrast-checker",
      result: { raw: { ratio: 21, aaNormal: true, aaLarge: true, aaaNormal: true }, artifacts: [] },
      onReset: () => undefined,
      onRetry: () => undefined,
    }));
    expect(validatorHtml).toContain('data-result-class="validator"');
    expect(validatorHtml).toContain('data-result-slot="checks"');
    expect(validatorHtml).toContain('data-result-action="retry"');
  });

  it("removes the family legacy-primary image-resize panel without changing certification truth", () => {
    const resizeSource = readFileSync(new URL("../src/components/tools/image-resize/ImageResizeTool.tsx", import.meta.url), "utf8");
    const sharedSource = readFileSync(new URL("../src/components/tools/image-visual/ImageVisualTool.tsx", import.meta.url), "utf8");
    expect(resizeSource).not.toContain('class="result-panel gutter"');
    expect(resizeSource).toContain("ImageResultV2");
    expect(sharedSource).toContain("ImageResultV2");

    const audit = JSON.parse(readFileSync(new URL("../quality/functional-audit/records/image-resize.json", import.meta.url), "utf8")) as {
      decision: string;
      childTickets: string[];
    };
    expect(audit.decision).toBe("REFUSED");
    expect(audit.childTickets).toEqual(expect.arrayContaining([
      expect.stringContaining("/277-"),
      expect.stringContaining("/278-"),
      expect.stringContaining("/279-"),
    ]));
    const certification = JSON.parse(readFileSync(new URL("../quality/receipts/image-resize/certification.json", import.meta.url), "utf8")) as {
      status: string;
      goldEligible: boolean;
      physicalAcceptance: { iosSafari: string; androidChrome: string };
    };
    expect(certification).toMatchObject({
      status: "PARTIAL",
      goldEligible: false,
      physicalAcceptance: { iosSafari: "MISSING", androidChrome: "MISSING" },
    });
  });
});
