/** Independent Node acceptance: same model revision, same image, fp32 versus q8.
 *  The fp32 weights are fetched only by CI and never bundled into the website.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const revision = "fa2fa546052fba4c08921230a26cc69a333fca12";
const fp32Url = `https://huggingface.co/Xenova/modnet/resolve/${revision}/onnx/model.onnx`;
const fp32Digest = "07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9";
const q8Digest = "92e49898c3e05a6d7a944fc67a8cb87c4aad754ffb6ebd949528c7d1105fee3a";
const localModel = resolve("public/models/portrait-modnet");
const reference = JSON.parse(await readFile(resolve("tests/fixtures/portrait-modnet-274/manual-regions.json"), "utf8"))["774909"];
const sample = resolve("tests/fixtures/portrait-modnet-274/portrait-pexels-774909.jpg");

function sha(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function inside(x, y, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function measures(image) {
  assert.equal(image.width, reference.width);
  assert.equal(image.height, reference.height);
  assert.equal(image.channels, 4);
  assert.equal(image.data.length, image.width * image.height * 4);
  let fg = 0; let bg = 0; let trueFg = 0; let trueBg = 0; let alphaError = 0;
  for (let y = 0; y < image.height; y += 4) for (let x = 0; x < image.width; x += 4) {
    const person = inside(x, y, reference.foregroundCore);
    const background = reference.backgroundCore.some((polygon) => inside(x, y, polygon));
    assert.ok(!(person && background), "Independent annotation regions overlap");
    const a = image.data[(y * image.width + x) * 4 + 3];
    if (person) { fg++; trueFg += a >= 180 ? 1 : 0; alphaError += 255 - a; }
    if (background) { bg++; trueBg += a <= 32 ? 1 : 0; alphaError += a; }
  }
  assert.ok(fg >= 10_000 && bg >= 10_000);
  return {
    foregroundRecall: trueFg / fg,
    backgroundRecall: trueBg / bg,
    balancedAccuracy: (trueFg / fg + trueBg / bg) / 2,
    meanAbsoluteAlphaError: alphaError / (fg + bg),
  };
}

const scratch = await mkdtemp(join(tmpdir(), "str274-model-"));
try {
  const model = join(scratch, "portrait-modnet");
  await mkdir(join(model, "onnx"), { recursive: true });
  for (const filename of ["config.json", "preprocessor_config.json"]) {
    await copyFile(join(localModel, filename), join(model, filename));
  }
  const q8Bytes = await readFile(join(localModel, "onnx/model_quantized.onnx"));
  assert.equal(sha(q8Bytes), q8Digest);
  await writeFile(join(model, "onnx/model_quantized.onnx"), q8Bytes);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let response;
  try { response = await fetch(fp32Url, { signal: controller.signal }); }
  finally { clearTimeout(timer); }
  assert.ok(response.ok, `fp32 pinned model unavailable: HTTP ${response.status}`);
  const fp32Bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(fp32Bytes.length, 25_888_640);
  assert.equal(sha(fp32Bytes), fp32Digest, "fp32 source bytes differ from immutable Hugging Face revision");
  await writeFile(join(model, "onnx/model.onnx"), fp32Bytes);

  const { env, pipeline } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = `${scratch}/`;
  const outputs = {};
  for (const dtype of ["q8", "fp32"]) {
    const pipe = await pipeline("background-removal", "portrait-modnet", {
      dtype, device: "cpu", local_files_only: true,
    });
    try { outputs[dtype] = await pipe(sample); }
    finally { await pipe.dispose(); }
  }
  const q8 = outputs.q8;
  const fp32 = outputs.fp32;
  const q8Score = measures(q8);
  const fp32Score = measures(fp32);
  assert.equal(q8.width, fp32.width);
  assert.equal(q8.height, fp32.height);
  let absoluteDifference = 0; let maskDisagreements = 0; let pixels = 0;
  for (let i = 3; i < q8.data.length; i += 16) {
    const a = q8.data[i]; const b = fp32.data[i];
    absoluteDifference += Math.abs(a - b);
    maskDisagreements += (a >= 128) !== (b >= 128) ? 1 : 0;
    pixels++;
  }
  const comparison = {
    revision, fp32Digest, q8Digest, pixels,
    meanAbsoluteAlphaDelta: absoluteDifference / pixels,
    binaryMaskDisagreement: maskDisagreements / pixels,
    q8: q8Score, fp32: fp32Score,
  };
  console.log(`MODNET_Q8_FP32_COMPARISON ${JSON.stringify(comparison)}`);
  assert.ok(q8Score.balancedAccuracy >= 0.90 && fp32Score.balancedAccuracy >= 0.90,
    "Neither model may pass by matching an all-foreground or all-background baseline");
  assert.ok(q8Score.balancedAccuracy >= fp32Score.balancedAccuracy - 0.03,
    "Quantized model loses more than 3 points of balanced accuracy");
  assert.ok(comparison.meanAbsoluteAlphaDelta <= 25,
    "Quantization shifts more than 25/255 alpha on average");
  assert.ok(comparison.binaryMaskDisagreement <= 0.08,
    "Quantization changes more than 8% of binary foreground decisions");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
