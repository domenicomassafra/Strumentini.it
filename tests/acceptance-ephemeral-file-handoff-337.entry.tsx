import { render } from "preact";
import { ImageCompressionTool } from "../src/components/tools/image-visual/ImageCompressionTool";
import { ImageResultV2, prepareImageResult } from "../src/components/tools/image-visual/ImageResultV2";

const root = document.querySelector("#root");
if (root === null) throw new Error("Missing #337 acceptance root");

if (location.pathname === "/tools/image-compression/") {
  render(<ImageCompressionTool />, root);
} else {
  const canvas = document.createElement("canvas");
  canvas.width = 144;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Missing PNG canvas context");
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      context.fillStyle = `rgb(${(x * 11 + y) % 256},${(x + y * 5) % 256},${(x * 3 + y * 7) % 256})`;
      context.fillRect(x, y, 1, 1);
    }
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value === null ? reject(new Error("PNG export failed")) : resolve(value), "image/png"));
  const prepared = await prepareImageResult({ blob, filename: "handoff-source-337.png", outputMime: "image/png", width: canvas.width, height: canvas.height });
  if (prepared.artifacts[0]?.artifact.download.ready !== true) throw new Error("PNG source verification failed");
  render(<ImageResultV2 toolId="image-crop" result={prepared} onReset={() => undefined} />, root);
}
