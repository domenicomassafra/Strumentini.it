/** Independent decode of a fresh PNG generated while the browser was offline. */
import assert from "node:assert/strict";

export async function assertOfflinePng274(page, points, engine) {
  const decoded = await page.evaluate(async (reference) => {
    const preview = document.querySelector('[data-portrait-274] img');
    const bytes = new Uint8Array(await (await fetch(preview.src)).arrayBuffer());
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const alphaAt = ([x, y]) => rgba[(y * canvas.width + x) * 4 + 3];
    return { signature: Array.from(bytes.subarray(0, 8)), width: canvas.width, height: canvas.height,
      foreground: reference.person.map(alphaAt), background: reference.background.map(alphaAt) };
  }, points);
  assert.deepEqual(decoded.signature, [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual([decoded.width, decoded.height], [768, 512]);
  assert.ok(decoded.foreground.every((a) => a >= 180), engine + " offline PNG lost person alpha");
  assert.ok(decoded.background.every((a) => a <= 32), engine + " offline PNG lost background alpha");
  console.log("PASS " + engine + " fresh offline PNG independently decoded RGBA " + JSON.stringify(decoded));
}
