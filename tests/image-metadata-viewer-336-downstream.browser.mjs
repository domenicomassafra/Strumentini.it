// Ticket 336 downstream: real browser tool input, not physical-phone evidence.
// Run: node tests/image-metadata-viewer-336-downstream.browser.mjs [Astro dev origin]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, webkit, devices } from "@playwright/test";

const origin = process.argv[2] ?? "http://127.0.0.1:19336";
const server = process.argv[2] ? null : spawn("node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", "19336", "--strictPort"], { stdio: "ignore" });
const cases = [
  { name: "synthetic-1x1-rgb.png", path: "quality/fixtures/image-metadata/synthetic-1x1-rgb.png", expected: "1×1 px", valid: true },
  { name: "transparent-2x2-rgba.png", path: "quality/fixtures/image-metadata/transparent-2x2-rgba.png", expected: "2×2 px", valid: true },
  { name: "not-an-image.png", bytes: Buffer.from("not a PNG or supported image"), valid: false },
];

async function ready() {
  for (let i = 0; i < 150; i++) {
    if (server?.exitCode != null) throw Error(`Server exit: ${server.exitCode}`);
    try { if ((await fetch(origin)).ok) return; } catch { /* starting */ }
    await delay(200);
  }
  throw Error(`Server unavailable: ${origin}`);
}

async function photoToToolJourney() {
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90_000);
    const photo = { name: cases[0].name, mimeType: "image/png", buffer: await readFile(cases[0].path) };
    await page.goto(origin + "/", { waitUntil: "networkidle" });
    const chooserPromise = page.waitForEvent("filechooser");
    await page.locator("[data-home-photos-picker]").click();
    await (await chooserPromise).setFiles(photo);
    await page.locator("[data-home-file-status]").getByText(/PNG riconosciuto localmente/u).waitFor();
    await page.locator('[data-home-file-action-format="png"]:visible a[href="/tools/image-metadata-viewer/"]').click();
    await page.waitForURL(/\/tools\/image-metadata-viewer\/?/u);
    const input = page.locator('form input[type="file"]').first();
    await input.waitFor();
    const before = await page.evaluate(() => ({
      unhydrated: document.querySelector('astro-island[ssr]') !== null,
      islandCount: document.querySelectorAll('astro-island').length,
    }));
    await input.setInputFiles(photo);
    await page.locator('form button[type="submit"]').first().click();
    const result = page.locator(".result-panel").first();
    await page.waitForFunction(() => document.querySelector('.result-panel [data-result-class]') || document.querySelector('.result-panel')?.textContent?.includes('Stato: Errore'), null, { timeout: 20_000 });
    const after = await page.evaluate(() => ({
      inputName: document.querySelector('form input[type="file"]')?.files?.[0]?.name,
      unhydrated: document.querySelector('astro-island[ssr]') !== null,
      islandCount: document.querySelectorAll('astro-island').length,
    }));
    const details = (await result.innerText()).slice(0, 250);
    assert(await result.locator('[data-result-class]').count() > 0,
      `Chrome iPhone-like fast Home→tool failed: before=${JSON.stringify(before)} after=${JSON.stringify(after)} DOM=${details}`);
    assert.match(details, /1×1 px/u);
    console.log(`PASS #336 Chrome iPhone-like Home→tool fast navigation, reselect & run: ${JSON.stringify(before)}`);
    await context.close();
  } finally { await browser.close(); }
}

async function exercise(engine, name, device) {
  const browser = await engine.launch(name === "Chrome" ? { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" } : {});
  try {
    const context = await browser.newContext({ ...device, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90_000);
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (!["GET", "HEAD"].includes(request.method())) requests.push(request.method()); });
    await page.goto(origin + "/tools/image-metadata-viewer/", { waitUntil: "networkidle" });
    const input = page.locator('form input[type="file"]').first();
    const result = page.locator(".result-panel").first();
    const status = result.locator("[data-result-class]");
    for (const trial of cases) {
      const content = trial.bytes ?? await readFile(trial.path);
      await input.setInputFiles({ name: trial.name, mimeType: "image/png", buffer: content });
      assert.equal(await input.evaluate((element) => element.files?.length), 1);
      await page.locator('form button[type="submit"]').first().click();
      if (trial.valid) {
        await status.waitFor({ timeout: 18_000 }).catch(async () => {
          let direct;
          if (origin.endsWith("19336")) {
            direct = await page.evaluate(async () => {
              const file = document.querySelector('form input[type="file"]')?.files?.[0];
              if (!file) return "no input";
              try {
                const runtime = await import('/src/runtime/tool-runtime.ts');
                const answer = await runtime.toolRuntime.run('image-metadata-viewer', file);
                return answer.ok ? { ok: true, value: answer.value } : { ok: false, code: answer.code, message: answer.message };
              } catch (error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
            });
          }
          throw Error(`${name} ${trial.name}: missing successful output, DOM=${(await result.innerText()).slice(0, 400)}, direct=${JSON.stringify(direct)}`);
        });
        assert.match(await status.innerText(), new RegExp(trial.expected.replace("×", "×"), "u"), `${name} ${trial.name}: wrong dimensions`);
        console.log(`PASS #336 ${name}: ${trial.name} → ${trial.expected}`);
      } else {
        await result.getByText(/Stato: Errore/u).waitFor({ timeout: 18_000 });
        assert.equal(await status.count(), 0, `${name}: corrupt file must be refused`);
      }
    }
    await page.getByRole("button", { name: "Reimposta" }).click();
    assert.equal(await input.inputValue(), "", `${name}: reset clears native file, not only Preact state`);
    await page.locator('form button[type="submit"]').first().click();
    await result.getByText(/Stato: Errore/u).waitFor({ timeout: 18_000 });
    assert.equal(await status.count(), 0, `${name}: reset must not reuse previous file`);
    assert.deepEqual(errors, [], `${name} uncaught errors`);
    assert.deepEqual(requests, [], `${name} local files not uploaded`);
    console.log(`PASS #336 ${name} metadata downstream: real PNG 1×1, 2×2, invalid refusal; no upload`);
    await context.close();
  } finally { await browser.close(); }
}

try {
  await ready();
  await photoToToolJourney();
  await exercise(chromium, "Chrome", devices["Pixel 7"]);
  await exercise(webkit, "WebKit", devices["iPhone 13"]);
  console.log("NOT_RUN physical iOS Safari/Android Chrome");
} finally { server?.kill("SIGTERM"); }
