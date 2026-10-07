import { readFile } from "node:fs/promises";
import { h } from "preact";
import render from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import {
  MACHADO_CVD_MATRICES,
  simulateColorVisionRgba,
  type ColorVisionSimulationMode,
} from "../src/engines/image/visual-tools";
import { ImageResultV2, prepareImageResult } from "../src/components/tools/image-visual/ImageResultV2";
import { colorBlindnessImageSimulationManifest } from "../src/tools/color-blindness-image-simulation/manifest";

interface FixtureDocument {
  readonly schemaVersion: number;
  readonly model: string;
  readonly severity: number;
  readonly matrices: Readonly<Record<ColorVisionSimulationMode, readonly (readonly number[])[]>>;
  readonly vectors: ReadonlyArray<{
    readonly name: string;
    readonly mode: ColorVisionSimulationMode;
    readonly input: readonly number[];
    readonly expected: readonly number[];
  }>;
}

const fixture = JSON.parse(
  await readFile(new URL("../quality/fixtures/color-vision-simulation/vectors.json", import.meta.url), "utf8"),
) as FixtureDocument;

describe("ticket 201 color-vision-deficiency image simulation", () => {
  it("binds the local image route to cand-244 and the dedicated fixture family", () => {
    expect(colorBlindnessImageSimulationManifest).toMatchObject({
      id: "color-blindness-image-simulation",
      engine: "image",
      runtime: { location: "LOCAL", network: "forbidden" },
      result: { class: "image", capabilities: ["download", "retry", "reset"] },
      gold: { maintenanceClass: "R", oracleEntryId: "cand-244", fixtureFamilies: ["color-vision-simulation"] },
    });
  });

  it("matches the independently transcribed full-severity Machado matrices", () => {
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.severity).toBe(1);
    for (const mode of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      expect([...MACHADO_CVD_MATRICES[mode]]).toEqual(fixture.matrices[mode].flat());
    }
  });

  it("replays exact synthetic pixel vectors in linearized sRGB and preserves alpha", () => {
    for (const vector of fixture.vectors) {
      const input = new Uint8ClampedArray(vector.input);
      const output = simulateColorVisionRgba(input, vector.mode);
      expect([...output], vector.name).toEqual([...vector.expected]);
      expect(output[3], `${vector.name}: alpha`).toBe(input[3]);
    }
  });

  it("refuses malformed RGBA buffers rather than silently truncating pixels", () => {
    expect(() => simulateColorVisionRgba(new Uint8ClampedArray([255, 0, 0]), "protanopia")).toThrow(/RGBA pixel data length/u);
  });

  it("renders a verified original/result comparison with exact mode and non-diagnosis language", async () => {
    const bytes = await readFile(new URL("../quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png", import.meta.url));
    const outputBlob = new Blob([bytes], { type: "image/png" });
    const result = await prepareImageResult({
      blob: outputBlob,
      filename: "fixture-protanopia-simulation.png",
      outputMime: "image/png",
      width: 2,
      height: 3,
      mode: "protanopia",
      modeLabel: "Protanopia",
      model: "Machado, Oliveira & Fernandes (2009), complete dichromacy matrix at severity 1.0",
      modelDoi: "10.1109/TVCG.2009.113",
      transformSpace: "linear RGB from sRGB",
    });
    const html = render(h(ImageResultV2, {
      toolId: "color-blindness-image-simulation",
      result,
      sourceFiles: [new File([bytes], "source.png", { type: "image/png" })],
      onReset: () => undefined,
      onRetry: () => undefined,
    }));
    expect(html).toContain('data-result-class="image"');
    expect(html).toContain('data-result-slot="comparison"');
    expect(html).toContain("Originale");
    expect(html).toContain("Simulazione: Protanopia");
    expect(html).toContain("non una diagnosi medica");
    expect(html).toContain("non una rappresentazione universale");
    expect(html).toContain("DOI 10.1109/TVCG.2009.113");
    expect(html).toContain('data-result-action="download"');
  });
});
