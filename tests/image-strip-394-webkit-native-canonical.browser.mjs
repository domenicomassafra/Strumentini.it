/** #394: actual native WebKit canvas output may contain private ancillary
 * eXIf/sRGB chunks even for innocuous input. Only canonical source-pixel PNG
 * is delivered, so native encoder artifacts must not block safe operation.
 */
import assert from "node:assert/strict";
import sharp from "sharp";
import { build } from "esbuild";
import { chromium, webkit } from "@playwright/test";

const sourceRgba = Buffer.from([10, 20, 30, 255, 201, 13, 57, 255, 79, 152, 45, 255, 77, 19, 218, 255]);
const sourcePng = await sharp(sourceRgba, { raw: { width: 2, height: 2, channels: 4 } })
  .png({ palette: false }).toBuffer();
const built = await build({
  entryPoints: [new URL("../src/engines/image/strip-metadata.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "browser", format: "iife", globalName: "StripMetadata394",
});
let expected;
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("about:blank");
    await page.addScriptTag({ content: built.outputFiles[0].text });
    const result = await page.evaluate(async (source) => {
      const file = new File([new Uint8Array(source)], "original.png", { type: "image/png" });
      const decoded = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = decoded.width;
      canvas.height = decoded.height;
      canvas.getContext("2d").drawImage(decoded, 0, 0);
      decoded.close();
      const nativeBytes = await new Promise((resolve) => canvas.toBlob(async (blob) =>
        resolve([...new Uint8Array(await blob.arrayBuffer())]), "image/png"));
      const output = await window.StripMetadata394.stripImageMetadataLocal({ file });
      return {
        nativeBytes,
        bytes: [...new Uint8Array(await output.blob.arrayBuffer())],
        metadataFree: output.metadataFree,
        segments: output.outputInventory.segments,
      };
    }, [...sourcePng]);
    const output = Buffer.from(result.bytes);
    const pixels = await sharp(output).ensureAlpha().raw().toBuffer();
    assert.deepEqual(pixels, sourceRgba);
    assert.equal(result.metadataFree, true);
    assert.deepEqual(result.segments, []);
    if (expected) assert.deepEqual(output, expected, "canonical output must agree across browsers");
    expected = output;
    const native = Buffer.from(result.nativeBytes);
    assert(native.byteLength > 50);
    assert.notDeepEqual(native, output, "native browser encoder need not be canonical");
    console.log(`#394 ${engine.name()} native toBlob ${native.length}B → canonical ${output.length}B; pixels exact`);
  } finally {
    await browser.close();
  }
}
