import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { inspectImageHeader } from "../src/engines/image/format";
import { IMAGE_LIMITS, estimateDecodedBytes } from "../src/engines/image/policy";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "dist/physical-fixtures");
const sourceWidth = Math.min(IMAGE_LIMITS.maxDimension, Math.floor(Math.sqrt(IMAGE_LIMITS.maxSourcePixels)));
const sourceHeight = Math.floor(IMAGE_LIMITS.maxSourcePixels / sourceWidth);
const outputWidth = 1200;
const outputHeight = 1200;
const sourcePixels = sourceWidth * sourceHeight;
const estimatedDecodedBytes = estimateDecodedBytes(sourcePixels, outputWidth * outputHeight);
if (sourcePixels / IMAGE_LIMITS.maxSourcePixels < 0.95 || estimatedDecodedBytes / IMAGE_LIMITS.maxEstimatedDecodedBytes < 0.85) {
  throw new Error("generated boundary fixture no longer exercises enough of the current image policy; update the fixture dimensions/output case");
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const dataUrl = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2D canvas unavailable");
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#172554");
    gradient.addColorStop(0.5, "#0891b2");
    gradient.addColorStop(1, "#f59e0b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(255,255,255,.22)";
    for (let x = 0; x < width; x += 256) context.fillRect(x, 0, 32, height);
    for (let y = 0; y < height; y += 256) context.fillRect(0, y, width, 32);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, { width: sourceWidth, height: sourceHeight });
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("generated fixture data URL is invalid");
  const bytes = Buffer.from(dataUrl.slice(comma + 1), "base64");
  const inspected = inspectImageHeader(new Uint8Array(bytes));
  if (inspected.mime !== "image/jpeg" || inspected.width !== sourceWidth || inspected.height !== sourceHeight) {
    throw new Error(`generated fixture header mismatch: ${JSON.stringify(inspected)}`);
  }
  const filename = `image-resize-boundary-${sourceWidth}x${sourceHeight}.jpg`;
  await writeFile(resolve(outputDir, filename), bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const manifest = {
    schemaVersion: 1,
    filename,
    sha256,
    source: { width: sourceWidth, height: sourceHeight, pixels: sourcePixels },
    recommendedOutput: { width: outputWidth, height: outputHeight },
    estimatedDecodedBytes,
    thresholdCoverage: {
      sourcePixelLimitFraction: sourcePixels / IMAGE_LIMITS.maxSourcePixels,
      decodedWorkingSetLimitFraction: estimatedDecodedBytes / IMAGE_LIMITS.maxEstimatedDecodedBytes,
    },
    policyLimits: IMAGE_LIMITS,
  };
  await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(outputDir, "index.html"), `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Image Resize physical QA fixture</title><main style="max-width:48rem;margin:2rem auto;padding:1rem;font:16px system-ui;line-height:1.5"><h1>Image Resize physical QA</h1><p>Download the boundary JPEG to Files/Photos on this physical device, then open Image Resize and choose that saved file through the real system picker.</p><p><a download href="./${filename}">Download ${sourceWidth}×${sourceHeight} boundary JPEG</a></p><ol><li>Save the JPEG to Files or Photos.</li><li>Open <a href="../tools/image-resize/">Image Resize</a>.</li><li>Choose the saved JPEG through the system picker.</li><li>Set Width ${outputWidth}, Height ${outputHeight}, Fit inside, JPEG.</li><li>Resize, verify the result completes without reload/crash, then open the downloaded output.</li><li>Confirm the page remains usable and note the displayed ${sourceWidth}×${sourceHeight} source and memory preflight.</li></ol><p>This page does not submit a receipt. The desktop recorder remains fail-closed and requires explicit observed PASS flags.</p></main>`, "utf8");
  console.log(`physical fixture generated: ${filename}`);
  console.log(`sha256=${sha256}`);
  console.log(`source=${sourceWidth}x${sourceHeight} (${sourcePixels} px); recommended output=${outputWidth}x${outputHeight}; estimated decoded bytes=${estimatedDecodedBytes}`);
} finally {
  await browser.close();
}
