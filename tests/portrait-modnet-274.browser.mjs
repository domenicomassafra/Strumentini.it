/** Run against `npm run preview -- --port 4327`. Add --full for actual inference; no Gold or device claim. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright";

const full = process.argv.includes("--full");
const origin = process.env.PORTRAIT_274_PREVIEW ?? "http://127.0.0.1:4327";
const samples = ["5965592", "774909", "220453"];
// Independently inspected, conservative interior person/background points on the
// source photographs. This is a limited binary oracle, not a pixel-perfect matte.
const annotation = JSON.parse(readFileSync(resolve("tests/fixtures/portrait-modnet-274/annotation-points.json"), "utf8"));
const manuallyTraced = JSON.parse(readFileSync(resolve("tests/fixtures/portrait-modnet-274/manual-regions.json"), "utf8"));

const engines = process.argv.includes("--chromium-only") ? { chromium }
  : process.argv.includes("--firefox-only") ? { firefox }
  : process.argv.includes("--webkit-only") ? { webkit } : { chromium, firefox, webkit };
for (const [name, engine] of Object.entries(engines)) {
  const browser = await engine.launch({ headless: true });
  let peakRssKib = 0;
  let initialRssKib = 0;
  let rssTimer = null;
  if (full && name === "chromium" && process.argv.includes("--rss")) {
    const session = await browser.newBrowserCDPSession();
    const measure = async () => {
      const { processInfo } = await session.send("SystemInfo.getProcessInfo");
      const pids = processInfo.map((item) => item.id).filter((pid) => Number.isSafeInteger(pid) && pid > 0);
      if (pids.length === 0) throw new Error("No Chromium processes reported for RSS audit");
      const rss = execFileSync("ps", ["-o", "rss=", "-p", pids.join(",")], { encoding: "utf8", timeout: 3000 });
      const total = rss.split(/\s+/u).map(Number).filter((value) => Number.isFinite(value) && value > 0).reduce((sum, value) => sum + value, 0);
      if (total <= 0) throw new Error("Chromium processes not measurable for RSS audit");
      if (!initialRssKib) initialRssKib = total;
      peakRssKib = Math.max(total, peakRssKib);
    };
    await measure();
    rssTimer = setInterval(() => { void measure().catch((error) => { console.error(`RSS sample error: ${error.message}`); }); }, 600);
  }
  try {
    const context = await browser.newContext();
    if (process.argv.includes("--csp")) {
      await context.route(`${origin}/laboratorio/scontorno-ritratti/`, async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, headers: {
          ...response.headers(),
          "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'",
        } });
      });
    }
    const page = await context.newPage();
    const cspViolations = [];
    page.on("console", (message) => {
      if (/content security policy|content-security-policy/iu.test(message.text())) cspViolations.push(message.text());
    });
    const network = [];
    const assetRequests = [];
    page.on("request", (req) => { if (/^https?:\/\//u.test(req.url()) && !req.url().startsWith(origin)) network.push([req.method(), req.url()]); });
    page.on("request", (req) => {
      if (/\/(?:models\/portrait-modnet|vendor\/portrait-modnet)\//u.test(req.url())) assetRequests.push([req.method(), req.url()]);
    });
    await page.goto(`${origin}/laboratorio/scontorno-ritratti/`, { waitUntil: "networkidle" });
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/u);
    assert.equal(network.length, 0, `${name} unexpected eager remote request`);
    assert.deepEqual(cspViolations, [], `${name} CSP issues during initial load`);
    assert.equal(assetRequests.length, 0, `${name} unexpected eager model/WASM download`);
    await page.locator('input[type="file"]').setInputFiles(resolve(`tests/fixtures/portrait-modnet-274/portrait-pexels-${samples[0]}.jpg`));
    await page.getByRole("button", { name: /Avvia/u }).click();
    await page.getByRole("button", { name: /Annulla/u }).click();
    assert.match(await page.locator('[data-portrait-274] [role="status"]').textContent(), /annullata/u);
    assert.equal(await page.locator('[data-portrait-274] img').count(), 0);
    assert.equal(network.length, 0, `${name} unexpected remote request after cancellation`);
    console.log(`PASS ${name} consent, no eager offsite, hard abort`);
    if (full) {
      for (const photo of samples) {
        await page.locator('input[type="file"]').setInputFiles(resolve(`tests/fixtures/portrait-modnet-274/portrait-pexels-${photo}.jpg`));
        await page.getByRole("button", { name: /Avvia/u }).click();
        await page.waitForFunction(() => /PNG RGBA decodificato|Rimozione sfondo non disponibile|Tempo limite/.test(document.querySelector('[data-portrait-274] [role="status"]')?.textContent ?? ""), null, { timeout: 135_000 });
        const status = await page.locator('[data-portrait-274] [role="status"]').textContent();
        assert.match(status, /PNG RGBA decodificato/u);
        const pixels = await page.evaluate(async (points) => {
          const img = document.querySelector('[data-portrait-274] img');
          const resp = await fetch(img.src);
          const bytes = new Uint8Array(await resp.arrayBuffer());
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(bitmap, 0, 0); bitmap.close();
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let clear = 0, partial = 0, solid = 0;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] === 0) clear++; else if (data[i] === 255) solid++; else partial++;
          }
          const sampleAlpha = (coordinate) => data[4 * (coordinate[1] * canvas.width + coordinate[0]) + 3];
          return { signature: Array.from(bytes.subarray(0, 8)), width: canvas.width, height: canvas.height, clear, partial, solid,
            foregroundAlpha: points.person.map(sampleAlpha), backgroundAlpha: points.background.map(sampleAlpha) };
        }, annotation[photo]);
        assert.deepEqual(pixels.signature, [137, 80, 78, 71, 13, 10, 26, 10]);
        assert.ok(pixels.clear + pixels.partial > 100 && pixels.solid + pixels.partial > 100);
        assert.ok(pixels.partial > 10, "Actual alpha matte should have partial edges");
        const personCorrect = pixels.foregroundAlpha.filter((alpha) => alpha >= 180).length;
        const backgroundCorrect = pixels.backgroundAlpha.filter((alpha) => alpha <= 32).length;
        const total = pixels.foregroundAlpha.length + pixels.backgroundAlpha.length;
        const accuracy = (personCorrect + backgroundCorrect) / total;
        const noAbilityBaseline = Math.max(pixels.foregroundAlpha.length, pixels.backgroundAlpha.length) / total;
        assert.ok(accuracy >= 0.875 && accuracy > noAbilityBaseline + 0.2,
          `Independent person/background point oracle failed: ${photo} accuracy=${accuracy}, no-capacity baseline=${noAbilityBaseline}, samples=${JSON.stringify(pixels)}`);
        if (manuallyTraced[photo]) {
          // This dense oracle is traced on the source photograph. A confidence
          // gap excludes ambiguous individual hair strands from the two cores;
          // explicit scanlines separately exercise hairline transitions.
          const scored = await page.evaluate(async (reference) => {
            const response = await fetch(document.querySelector('[data-portrait-274] img').src);
            const bitmap = await createImageBitmap(await response.blob());
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(bitmap, 0, 0); bitmap.close();
            const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const alpha = (x, y) => image[(y * canvas.width + x) * 4 + 3];
            const within = (x, y, polygon) => {
              let found = false;
              for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
                if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) found = !found;
              }
              return found;
            };
            let foregroundCount = 0; let backgroundCount = 0;
            let foregroundHit = 0; let backgroundHit = 0; let absoluteError = 0;
            for (let y = 0; y < canvas.height; y += 4) for (let x = 0; x < canvas.width; x += 4) {
              const fg = within(x, y, reference.foregroundCore);
              const bg = reference.backgroundCore.some((polygon) => within(x, y, polygon));
              if (fg && bg) throw new Error('Human oracle labels overlap');
              if (fg) { foregroundCount++; foregroundHit += alpha(x, y) >= 180 ? 1 : 0; absoluteError += 255 - alpha(x, y); }
              if (bg) { backgroundCount++; backgroundHit += alpha(x, y) <= 32 ? 1 : 0; absoluteError += alpha(x, y); }
            }
            const hairline = reference.hairline.map(({ y, left, right }) => {
              const line = Array.from({ length: canvas.width }, (_, x) => alpha(x, y));
              return { y, left: line.findIndex((a) => a >= 128),
                right: line.findLastIndex((a) => a >= 128),
                partial: line.filter((a) => a > 0 && a < 255).length,
                leftRange: left, rightRange: right };
            });
            return { width: canvas.width, height: canvas.height,
              foregroundCount, backgroundCount,
              foregroundRecall: foregroundHit / foregroundCount,
              backgroundRecall: backgroundHit / backgroundCount,
              balancedAccuracy: (foregroundHit / foregroundCount + backgroundHit / backgroundCount) / 2,
              meanAbsoluteAlphaError: absoluteError / (foregroundCount + backgroundCount), hairline };
          }, manuallyTraced[photo]);
          console.log(`METRICS ${name} ${photo} independent manual alpha oracle: ${JSON.stringify(scored)}`);
          assert.equal(scored.width, manuallyTraced[photo].width);
          assert.equal(scored.height, manuallyTraced[photo].height);
          assert.ok(scored.foregroundCount >= 10_000 && scored.backgroundCount >= 10_000, `Not a dense oracle: ${JSON.stringify(scored)}`);
          assert.ok(scored.foregroundRecall >= 0.85 && scored.backgroundRecall >= 0.90 && scored.balancedAccuracy >= 0.90,
            `Dense manual foreground/background oracle failed: ${JSON.stringify(scored)}`);
          assert.ok(scored.meanAbsoluteAlphaError <= 45, `Dense alpha error too high: ${JSON.stringify(scored)}`);
          for (const scan of scored.hairline) {
            assert.ok(scan.left >= scan.leftRange[0] && scan.left <= scan.leftRange[1], `Left hairline differs from manual trace: ${JSON.stringify(scan)}`);
            assert.ok(scan.right >= scan.rightRange[0] && scan.right <= scan.rightRange[1], `Right hairline differs from manual trace: ${JSON.stringify(scan)}`);
            assert.ok(scan.partial >= 2, `Hairline must contain a graded alpha transition: ${JSON.stringify(scan)}`);
          }
          console.log(`PASS ${name} ${photo} dense manual alpha oracle vs constant-foreground/background baseline 50% ${JSON.stringify(scored)}`);
        }
        assert.ok(network.length === 0, "No offsite network after opt-in");
        assert.deepEqual(cspViolations, [], `${name} CSP violation during real inference: ${cspViolations.join("; ")}`);
        assert.ok(assetRequests.length > 0 && assetRequests.every(([method]) => method === "GET"), "Only same-origin GET model and runtime assets");
        console.log(`PASS ${name} ${photo} real pixel matte/point oracle accuracy=${accuracy} baseline=${noAbilityBaseline} ${JSON.stringify(pixels)}`);
      }
      // Independent RGBA donor input: original Pexels portrait with a manually
      // authored fully clear corner and a 100/255 alpha face patch.
      await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/portrait-modnet-274/portrait-derived-alpha.png"));
      await page.getByRole("button", { name: /Avvia/u }).click();
      await page.waitForFunction(() => /PNG RGBA decodificato|Rimozione sfondo non disponibile|Tempo limite/.test(document.querySelector('[data-portrait-274] [role="status"]')?.textContent ?? ""), null, { timeout: 135_000 });
      assert.match(await page.locator('[data-portrait-274] [role="status"]').textContent(), /PNG RGBA decodificato/u);
      const preserved = await page.evaluate(async () => {
        const response = await fetch(document.querySelector('[data-portrait-274] img').src);
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0); bitmap.close();
        const alpha = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
        return { clearCorner: alpha(20, 20), semiTransparentFace: alpha(340, 100), originalDimensions: [canvas.width, canvas.height] };
      });
      assert.deepEqual(preserved.originalDimensions, [768, 512]);
      assert.equal(preserved.clearCorner, 0);
      assert.ok(preserved.semiTransparentFace > 0 && preserved.semiTransparentFace <= 100,
        `Preexisting PNG alpha must not be discarded by the model: ${JSON.stringify(preserved)}`);
      assert.deepEqual(network, [], "RGBA path must not upload or call offsite services");
      console.log(`PASS ${name} originally transparent portrait PNG alpha preservation ${JSON.stringify(preserved)}`);
      await page.route(`${origin}/models/**`, (route) => route.abort("internetdisconnected"));
      await page.locator('input[type="file"]').setInputFiles(resolve(`tests/fixtures/portrait-modnet-274/portrait-pexels-${samples[0]}.jpg`));
      await page.getByRole("button", { name: /Avvia/u }).click();
      await page.waitForFunction(() => /PNG RGBA decodificato|Rimozione sfondo non disponibile|Tempo limite/.test(document.querySelector('[data-portrait-274] [role="status"]')?.textContent ?? ""), null, { timeout: 135_000 });
      const warmCacheStatus = await page.locator('[data-portrait-274] [role="status"]').textContent();
      assert.match(warmCacheStatus, /PNG RGBA decodificato/u, `${name} must reuse same-origin warm model cache without refetch`);
      console.log(`PASS ${name} warm-cache inference with model network blocked`);
      // A real browser-offline state also blocks Worker code and WASM requests.
      // This is stronger than intercepting only /models/** and catches missing
      // runtime caching. The tab is already loaded and has completed inference.
      const onlineResultUrl = await page.locator('[data-portrait-274] img').getAttribute('src');
      await context.setOffline(true);
      try {
        await page.locator('input[type="file"]').setInputFiles(resolve(`tests/fixtures/portrait-modnet-274/portrait-pexels-${samples[0]}.jpg`));
        await page.getByRole("button", { name: /Avvia/u }).click();
        await page.waitForFunction(() => /PNG RGBA decodificato|Rimozione sfondo non disponibile|Tempo limite/.test(document.querySelector('[data-portrait-274] [role="status"]')?.textContent ?? ""), null, { timeout: 30_000 });
        const offlineStatus = await page.locator('[data-portrait-274] [role="status"]').textContent();
        assert.match(offlineStatus, /PNG RGBA decodificato/u, `${name} warmed runtime must infer while the browser context is offline`);
        assert.notEqual(await page.locator('[data-portrait-274] img').getAttribute('src'), onlineResultUrl,
          `${name} offline inference must produce a fresh PNG after the online result`);
        console.log(`PASS ${name} warmed-page inference in browser offline mode`);
      } finally {
        await context.setOffline(false);
      }
    }
    await context.close();
    const denied = await browser.newContext();
    try {
      const offline = await denied.newPage();
      await offline.route(`${origin}/models/**`, (route) => route.abort("internetdisconnected"));
      await offline.goto(`${origin}/laboratorio/scontorno-ritratti/`, { waitUntil: "networkidle" });
      await offline.locator('input[type="file"]').setInputFiles(resolve(`tests/fixtures/portrait-modnet-274/portrait-pexels-${samples[0]}.jpg`));
      await offline.waitForFunction(() => !document.querySelector('[data-portrait-274] button')?.disabled, null, { timeout: 15_000 });
      await offline.getByRole("button", { name: /Avvia/u }).click();
      await offline.waitForFunction(() => /Rimozione sfondo non disponibile|Tempo limite/.test(document.querySelector('[data-portrait-274] [role="status"]')?.textContent ?? ""), null, { timeout: 30000 });
      assert.equal(await offline.locator('[data-portrait-274] img').count(), 0, `${name} must fail closed when model unavailable`);
      console.log(`PASS ${name} unavailable model refuses unverified output`);
    } finally { await denied.close(); }
  } finally {
    if (rssTimer !== null) {
      clearInterval(rssTimer);
      console.log(`RSS ${name}: initial=${initialRssKib} KiB, peak=${peakRssKib} KiB (sum CDP-reported browser processes; not an iOS/Android total-memory guarantee)`);
      assert.ok(peakRssKib < 2 * 1024 * 1024, `RSS above bounded desktop budget: ${peakRssKib} KiB`);
    }
    await browser.close();
  }
}
