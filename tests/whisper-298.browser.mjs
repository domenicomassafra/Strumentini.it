/** Local Chromium acceptance: run against `astro preview --port 4327`; --full also runs real Italian ASR. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const full = process.argv.includes("--full");
const url = process.env.WHISPER_298_PREVIEW ?? "http://127.0.0.1:4327/laboratorio/trascrizione-audio/";
const fixture = new URL("./fixtures/whisper-298/italian-minds14-1.wav", import.meta.url).pathname;

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const outgoing = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:")) outgoing.push({ method: request.method(), url: request.url() });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/u);
  assert.equal(outgoing.length, 0, "Model loading must be opt-in");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.getByRole("button", { name: /Avvia trascrizione/u }).click();
  await page.getByRole("button", { name: /Annulla e libera memoria/u }).click();
  assert.match(await page.locator('[data-whisper-298] [role="status"]').textContent(), /annullata/u);
  assert.equal(await page.locator('[data-whisper-298] textarea').count(), 0, "Cancelled worker must not create text");

  await page.route(/^https:\/\//u, (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: /Avvia trascrizione/u }).click();
  await page.waitForFunction(() => /Trascrizione non disponibile/.test(document.querySelector('[data-whisper-298] [role="status"]')?.textContent ?? ""), null, { timeout: 90_000 });
  assert.equal(await page.locator('[data-whisper-298] textarea').count(), 0, "Network denied must fail without fabricated result");
  console.log("PASS opt-in/no eager downloads, cancel terminates, network deny fails closed");
  await context.close();

  if (full) {
    const liveContext = await browser.newContext();
    const live = await liveContext.newPage();
    const actual = [];
    live.on("request", (request) => {
      if (request.url().startsWith("https://")) actual.push({ method: request.method(), host: new URL(request.url()).hostname });
    });
    await live.goto(url, { waitUntil: "domcontentloaded" });
    await live.locator('input[type="file"]').setInputFiles(fixture);
    await live.getByRole("button", { name: /Avvia trascrizione/u }).click();
    await live.getByRole("button", { name: "Pausa", exact: true }).click();
    await live.waitForFunction(() => /Elaborazione in pausa/.test(document.querySelector('[data-whisper-298] [role="status"]')?.textContent ?? ""), null, { timeout: 180_000 });
    assert.equal(await live.locator('[data-whisper-298] textarea').count(), 0, "Paused inference must not produce a transcript");
    await live.getByRole("button", { name: "Riprendi", exact: true }).click();
    await live.waitForFunction(() => /Trascrizione ottenuta|Trascrizione non disponibile|non ha riconosciuto/.test(document.querySelector('[data-whisper-298] [role="status"]')?.textContent ?? ""), null, { timeout: 180_000 });
    const status = await live.locator('[data-whisper-298] [role="status"]').textContent();
    assert.match(status, /Trascrizione ottenuta/u);
    const recognized = await live.locator('[data-whisper-298] textarea').inputValue();
    assert.ok(recognized.trim().length > 10, "Real audio must yield actual recognizer text");
    assert.deepEqual([...new Set(actual.map((x) => x.host))].sort(), ["cdn.jsdelivr.net", "huggingface.co", "us.aws.cdn.hf.co"]);
    assert.ok(actual.every((x) => x.method === "GET"), "No audio may be uploaded");
    console.log(`PASS real Italian ASR with pause/resume: ${JSON.stringify(recognized)}; origins=${[...new Set(actual.map((x) => x.host))].join(",")}; nonGET=0`);
    const recordedTimings = async () => live.locator('[aria-label="Risultato trascrizione"] p').allTextContents();
    const firstTimings = await recordedTimings();
    console.log(`FIRST_LOAD: ${JSON.stringify(firstTimings)}; externalRequests=${actual.length}`);
    if (process.argv.includes("--benchmark")) {
      const before = actual.length;
      await live.locator('input[type="file"]').setInputFiles([]);
      await live.locator('input[type="file"]').setInputFiles(fixture);
      const started = performance.now();
      await live.getByRole("button", { name: /Avvia trascrizione/u }).click();
      await live.waitForFunction(() => /Trascrizione ottenuta|Trascrizione non disponibile|non ha riconosciuto/.test(document.querySelector('[data-whisper-298] [role="status"]')?.textContent ?? ""), null, { timeout: 180_000 });
      assert.match(await live.locator('[data-whisper-298] [role="status"]').textContent(), /Trascrizione ottenuta/u);
      assert.ok(actual.every((x) => x.method === "GET"), "No upload after warm retry");
      console.log(`WARM_RETRY: ${JSON.stringify(await recordedTimings())}; wallMs=${Math.round(performance.now() - started)}; additionalExternalRequests=${actual.length - before}`);
    }
    await liveContext.close();
  }
} finally {
  await browser.close();
}
