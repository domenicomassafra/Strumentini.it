import { strict as assert } from "node:assert";
import { execFileSync, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const base = (process.env.VIDEO306_ORIGIN ?? "http://127.0.0.1:18606").replace(/\/$/u, "");
const sourceName = process.env.VIDEO306_SOURCE === "webm"
  ? "tests/video-vp8-opus-234.webm" : "tests/video-frame-305-red-green.mp4";
const viewportWidth = Number(process.env.VIDEO306_VIEWPORT ?? "390");
assert([320, 390].includes(viewportWidth));
const server = process.env.VIDEO306_ORIGIN ? null : spawn(resolve(root, "node_modules/.bin/astro"),
  ["dev", "--host", "127.0.0.1", "--port", "18606", "--ignore-lock"], { cwd: root, stdio: "ignore" });
let browser;
let checks = 0;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${base}/tools/video-inspector/`)).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(done => setTimeout(done, 120));
  }
  assert(ready, "Video public route not available");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: viewportWidth, height: 844 }, acceptDownloads: true });
  const offsite = [], pageErrors = [];
  page.on("pageerror", cause => pageErrors.push(cause.message));
  page.on("request", request => {
    if (!request.url().startsWith(base) && !/^(blob:|data:)/u.test(request.url())
      || request.method() !== "GET") offsite.push(`${request.method()} ${request.url()}`);
  });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__gif306Workers = { created: 0, terminated: 0 };
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); window.__gif306Workers.created++; }
      terminate() { window.__gif306Workers.terminated++; return super.terminate(); }
    };
  });
  assert.equal((await page.goto(`${base}/tools/video-inspector/`, { waitUntil: "networkidle" })).status(), 200);
  const parent = page.locator("[data-video-frame-camera-305]");
  await parent.locator('input[type="file"]').setInputFiles(resolve(root, sourceName));
  const panel = page.locator("[data-video-gif-306]");
  await panel.waitFor();
  assert.match(await panel.innerText(), /0,2–3 secondi/iu);
  checks += 2;
  await panel.getByLabel("GIF FPS").selectOption("10");
  await panel.getByLabel("GIF larghezza").selectOption("96");
  await panel.getByLabel("GIF scala").selectOption("1");
  await panel.getByRole("spinbutton", { name: "Inizio clip (secondi)" }).fill("0.25");
  await panel.getByRole("spinbutton", { name: /Fine clip/u }).fill("1.75");
  const startMs = Date.now();
  await panel.getByRole("button", { name: "Converti video in GIF" }).click();
  await Promise.race([
    panel.locator("[data-video-gif-result]").waitFor({ timeout: 50_000 }),
    panel.locator("[data-video-gif-status]").getByText(/VIDEO_GIF_306_/u).waitFor({ timeout: 50_000 })
      .then(async () => { throw Error(await panel.locator("[data-video-gif-status]").innerText()); }),
  ]);
  const encodeMs = Date.now() - startMs;
  assert(encodeMs <= 30_000, `GIF 15-frame browser encode too slow (${encodeMs}ms)`);
  checks++;
  assert.match(await panel.locator("[data-video-gif-result]").innerText(), /15 frame/u);
  assert(await panel.locator("[data-video-gif-result] img").evaluate(img => img.complete && img.naturalWidth > 0));
  checks += 2;
  if (sourceName.endsWith(".mp4") && viewportWidth === 390) {
    await panel.screenshot({ path: resolve(root, ".scratch/strumentini-expansion-20261005/evidence/306-video-gif-preview-390.png") });
  }
  const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("link", { name: "Scarica GIF animata" }).click()]);
  assert.equal(download.suggestedFilename(), "video-convertito.gif");
  const file = await download.path();
  assert(file);
  const gifBytes = await readFile(file);
  assert.equal(gifBytes.subarray(0, 6).toString(), "GIF89a");
  checks += 2;
  const independent = execFileSync("python3", ["-c", String.raw`
import sys,hashlib,subprocess
from PIL import Image, ImageSequence,ImageChops,ImageStat
im=Image.open(sys.argv[1])
assert im.format=="GIF"
assert im.n_frames==15, im.n_frames
assert im.size==(64,48), im.size
delays=[]
colors=[]
hashes=[]
decoded=[]
for frame in ImageSequence.Iterator(im):
    frame.load()
    delays.append(frame.info.get("duration",0))
    rgb=frame.convert("RGB")
    colors.append(rgb.getpixel((32,24)))
    hashes.append(hashlib.sha256(rgb.tobytes()).hexdigest())
    decoded.append(rgb)
assert all(d==100 for d in delays), delays
assert sum(delays)==1500
assert len(set(hashes))>=2, "No visual motion between 15 independently decoded frames"
color_errors=[]
for idx,seconds in ((0,.30),(10,1.30)):
    raw=subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-ss",str(seconds),"-i",sys.argv[2],"-frames:v","1","-f","rawvideo","-pix_fmt","rgb24","pipe:1"],check=True,capture_output=True).stdout
    reference=Image.frombytes("RGB",im.size,raw)
    mean=ImageStat.Stat(ImageChops.difference(reference,decoded[idx])).mean
    color_errors.append(round(sum(mean)/3,2))
assert all(value<=55 for value in color_errors),("Palette color distortion unexpectedly large",color_errors)
print("VIDEO_GIF_306_PILLOW_REOPEN_PASS", "frames", len(delays), "delay_ms",sum(delays),"distinct_frames",len(set(hashes)),"mean_rgb_errors",color_errors)
`, file, resolve(root, sourceName)], { encoding: "utf8" }).trim();
  assert.match(independent, /VIDEO_GIF_306_PILLOW_REOPEN_PASS/u);
  checks += 5;
  // Different FPS/scale with a fractional final frame delay exercises GIF
  // centisecond rounding: 1.15s, six samples at 5fps, output width 48px.
  await panel.getByLabel("GIF FPS").selectOption("5");
  await panel.getByLabel("GIF larghezza").selectOption("96");
  await panel.getByLabel("GIF scala").selectOption("0.5");
  await panel.getByRole("spinbutton", { name: "Inizio clip (secondi)" }).fill("0.1");
  await panel.getByRole("spinbutton", { name: /Fine clip/u }).fill("1.25");
  await panel.getByRole("button", { name: "Converti video in GIF" }).click();
  await panel.locator("[data-video-gif-result]").waitFor({ timeout: 45_000 });
  const [smallDownload] = await Promise.all([
    page.waitForEvent("download"), panel.getByRole("link", { name: "Scarica GIF animata" }).click(),
  ]);
  const smallPath = await smallDownload.path();
  assert(smallPath);
  const smallProof = execFileSync("python3", ["-c", String.raw`
import sys
from PIL import Image,ImageSequence
im=Image.open(sys.argv[1])
delays=[frame.info.get("duration",0) for frame in ImageSequence.Iterator(im)]
assert im.size==(48,36),im.size
assert im.n_frames==6,im.n_frames
assert sum(delays)==1150,delays
assert min(delays)>=180 and max(delays)<=200,delays
print("VIDEO_GIF_306_VARIABLE_FPS_SCALE_PASS",im.size,im.n_frames,delays)
`, smallPath], { encoding: "utf8" }).trim();
  assert.match(smallProof, /VIDEO_GIF_306_VARIABLE_FPS_SCALE_PASS/u);
  checks += 5;
  // Cancellation is tested on the MP4 fixture, with a live active worker.
  // Small WebM conversions can finish between click and cancellation on
  // fast hosts; don't manufacture a cancellation after successful completion.
  if (sourceName.endsWith(".mp4")) {
    await panel.getByRole("button", { name: "Converti video in GIF" }).click();
    await panel.getByRole("button", { name: "Annulla conversione GIF" }).click();
    await panel.locator("[data-video-gif-status]").getByText(/VIDEO_GIF_306_CANCELLED/u).waitFor();
    assert.equal(await panel.locator("[data-video-gif-result]").count(), 0);
    await page.waitForTimeout(200);
    assert.equal(await panel.locator("[data-video-gif-result]").count(), 0);
    checks += 2;
  }
  // Invalid bounds are rejected before worker result and no stale download.
  await panel.getByRole("spinbutton", { name: /Fine clip/u }).fill("9");
  await panel.getByRole("button", { name: "Converti video in GIF" }).click();
  await panel.locator("[data-video-gif-status]").getByText(/VIDEO_GIF_306_TRIM_RANGE/u).waitFor({ timeout: 15_000 });
  assert.equal(await panel.locator("[data-video-gif-result]").count(), 0);
  checks += 2;
  const workers = await page.evaluate(() => window.__gif306Workers);
  assert(workers.created >= 2);
  assert.equal(workers.created, workers.terminated, JSON.stringify(workers));
  assert.deepEqual(offsite, []);
  assert.deepEqual(pageErrors, []);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  checks += 5;
  console.log(`VIDEO_GIF_306_BROWSER_PASS source=${sourceName} viewport=${viewportWidth} checks=${checks} encode_ms=${encodeMs} bytes=${gifBytes.byteLength} ${independent} workers=${JSON.stringify(workers)}`);
} finally { await browser?.close(); server?.kill("SIGTERM"); }
