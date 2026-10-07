import { h, render } from "preact";
import { simulateColorVisionLocal, type ColorVisionSimulationMode } from "../../src/engines/image/visual-tools";
import { ImageResultV2, prepareImageResult } from "../../src/components/tools/image-visual/ImageResultV2";
import "../../src/components/tools/tool-surface.css";

function sourceImage(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("2D canvas unavailable");
  const pixels = context.createImageData(2, 2);
  pixels.data.set(new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    255, 255, 255, 128,
  ]));
  context.putImageData(pixels, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error("PNG encode failed"));
      else resolve(new File([blob], "browser-source.png", { type: "image/png" }));
    }, "image/png");
  });
}

const mode = document.querySelector<HTMLSelectElement>("#mode");
const run = document.querySelector<HTMLButtonElement>("#run");
const resultRoot = document.querySelector<HTMLElement>("#result");
if (mode === null || run === null || resultRoot === null) throw new Error("Acceptance harness controls are missing");

run.addEventListener("click", async () => {
  run.disabled = true;
  try {
    const file = await sourceImage();
    const value = await simulateColorVisionLocal({ file, mode: mode.value as ColorVisionSimulationMode });
    const prepared = await prepareImageResult(value);
    render(h(ImageResultV2, {
      toolId: "color-blindness-image-simulation",
      result: prepared,
      sourceFiles: [file],
      onReset: () => undefined,
      onRetry: () => undefined,
    }), resultRoot);
  } finally {
    run.disabled = false;
  }
});
