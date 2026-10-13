import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const base = process.env.PROTOTYPE351_URL ?? "http://127.0.0.1:4351/prototipi/351/";
const fixture = await readFile(resolve("quality/fixtures/pdf-gold/simple-2page.pdf"));
const variants = ["minimal", "editorial", "workspace"];
const widths = [320, 390, 768, 1024, 1440];

async function bytesFromDownload(page, panel) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    panel.locator("[data-download]").click(),
  ]);
  const location = await download.path();
  assert.ok(location, "Downloaded local bytes must exist");
  return readFile(location);
}

for (const [browserName, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
    const page = await context.newPage();
    const remote = [];
    const posts = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== new URL(base).origin && !["data:", "blob:"].includes(url.protocol)) remote.push(url.href);
      if (!["GET", "HEAD"].includes(request.method())) posts.push(request.url());
    });
    const response = await page.goto(base, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${browserName} prototype route needs to exist`);
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/u);
    assert.equal(await page.locator("[data-direction]").count(), 3);
    // Original AC-351.2/.3: compare genuinely distinct IA/interactions via the
    // actual visible owner rubric, not merely three different color palettes.
    const rubric = page.locator(".study-rubric table");
    assert.equal(await rubric.locator("thead th").count(), 4);
    assert.deepEqual((await rubric.locator("thead th").allInnerTexts()).map(text => text.trim()),
      ["Criterio", "Minimal", "Editoriale", "Workspace"]);
    assert.equal(await rubric.locator("tbody tr").count(), 5);
    const criteria = await rubric.locator("tbody tr").evaluateAll((rows) => rows.map((row) => ({
      label: row.querySelector("th")?.textContent?.trim(),
      options: [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim() ?? ""),
    })));
    assert.deepEqual(criteria.map((criterion) => criterion.label),
      ["Ingresso", "Orientamento", "Risultato", "Tastiera", "Mobile"]);
    for (const criterion of criteria) {
      assert.equal(criterion.options.length, 3, `${browserName}/${criterion.label}: three IA alternatives`);
      assert.equal(new Set(criterion.options).size, 3,
        `${browserName}/${criterion.label}: non-cosmetic distinctions, not repeated descriptions`);
      assert(criterion.options.every((value) => value.length >= 5));
    }
    assert.match(await page.locator(".study-rubric").innerText(), /La direzione visiva resta da scegliere/iu,
      "The comparison is available but owner design selection remains unmade");
    await page.locator('[data-switch="minimal"]').focus();
    await page.keyboard.press("Tab");
    if (browserName === "webkit" && await page.evaluate(() => document.activeElement?.getAttribute("data-switch")) !== "editorial") {
      // Safari on macOS defaults to text controls for Tab; Option+Tab navigates
      // all controls when full keyboard access is not enabled.
      await page.locator('[data-switch="minimal"]').focus();
      await page.keyboard.press("Alt+Tab");
    }
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-switch")), "editorial", `${browserName}: sequential keyboard navigation`);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator('[data-direction="editorial"]').isVisible(), true, `${browserName}: keyboard selects editorial journey`);

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const variant of variants) {
        await page.locator(`[data-switch="${variant}"]`).click();
        const root = page.locator(`[data-direction="${variant}"]`);
        assert.equal(await root.isVisible(), true, `${browserName}/${width}/${variant}: visible`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `${browserName}/${width}/${variant}: overflow ${overflow}`);
        assert.equal(await root.locator('[data-select-job="pdf"]').isVisible(), true);
      }
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), "auto", `${browserName}: reduced-motion removes smooth scrolling`);
    for (const variant of variants) {
      await page.locator(`[data-switch="${variant}"]`).click();
      const root = page.locator(`[data-direction="${variant}"]`);

      // PDF: two actual, parseable 2-page fixtures must produce a real 4-page PDF.
      await root.locator('[data-select-job="pdf"]').click();
      const pdf = root.locator('[data-job="pdf"]');
      await pdf.locator('input[type="file"]').setInputFiles([
        { name: "alpha.pdf", mimeType: "application/pdf", buffer: fixture },
        { name: "beta.pdf", mimeType: "application/pdf", buffer: fixture },
      ]);
      await pdf.locator("[data-run]").click();
      await pdf.locator("[data-download]").waitFor({ state: "visible", timeout: 25_000 });
      const merged = await bytesFromDownload(page, pdf);
      assert.equal(merged.subarray(0, 5).toString(), "%PDF-");
      const loader = getDocument({ data: Uint8Array.from(merged), disableAutoFetch: true, disableStream: true, useSystemFonts: false });
      const doc = await loader.promise;
      assert.equal(doc.numPages, 4, `${browserName}/${variant}: merged PDF independently parsed`);
      await loader.destroy();
      assert.match(await pdf.locator("[data-status]").innerText(), /4 pagine/u);
      // Cancel before the next animation-frame job starts; preserve the already
      // verified prior artifact without triggering a second download.
      await pdf.evaluate((element) => {
        element.querySelector("[data-run]").click();
        element.querySelector("[data-cancel]").click();
      });
      await pdf.locator('[role="alert"]').waitFor({ state: "visible" });
      assert.match(await pdf.locator('[role="alert"]').innerText(), /annullata/u);
      assert.equal(await pdf.locator('[data-download]').isVisible(), true, `${browserName}/${variant}: cancel preserves prior result`);

      // CSV: preserve quoted cells, leading zeroes and produce actual downloadable UTF-8 bytes.
      await root.locator('[data-select-job="csv"]').click();
      const csv = root.locator('[data-job="csv"]');
      await csv.locator('input[type="file"]').setInputFiles({
        name: "righe.csv", mimeType: "text/csv", buffer: Buffer.from('\ufeffid,note\r\n001,"uno,due"\r\n002,tre\r\n', "utf8"),
      });
      await csv.locator("[data-run]").click();
      await csv.locator("[data-download]").waitFor({ state: "visible" });
      const cleaned = (await bytesFromDownload(page, csv)).toString("utf8");
      assert.match(cleaned, /001,"uno,due"\n002,tre\n/u);
      assert.equal(cleaned.includes("\r"), false);

      // UTM: reuse the shipped URL builder's encoding; preview must equal exported bytes.
      await root.locator('[data-select-job="utm"]').click();
      const utm = root.locator('[data-job="utm"]');
      await utm.locator('[name="baseUrl"]').fill("https://example.org/articolo?ref=ok#sezione");
      await utm.locator('[name="source"]').fill("newsletter");
      await utm.locator('[name="medium"]').fill("email");
      await utm.locator('[name="campaign"]').fill("autunno 2026");
      await utm.locator("[data-run]").click();
      await utm.locator("[data-download]").waitFor({ state: "visible" });
      const built = (await bytesFromDownload(page, utm)).toString("utf8");
      assert.equal(built, await utm.locator("[data-preview]").innerText());
      assert.match(built, /ref=ok&utm_source=newsletter&utm_medium=email&utm_campaign=autunno\+2026#sezione/u);
      await utm.locator('[name="baseUrl"]').fill("javascript:alert(1)");
      await utm.locator("[data-run]").click();
      await utm.locator('[role="alert"]').waitFor({ state: "visible" });
      assert.equal(await utm.locator("[data-download]").isVisible(), true, "error preserves last good download");
      await utm.locator("[data-reset]").click();
      assert.equal(await utm.locator("[data-download]").isVisible(), false);
    }
    assert.deepEqual(remote, [], `${browserName}: no offsite request`);
    assert.deepEqual(posts, [], `${browserName}: no POST or mutation requests`);
    await context.close();
    process.stdout.write(`${browserName} PASS: three directions × PDF/CSV/UTM actual downloads; 5 widths, no offsite/POST\n`);
  } finally {
    await browser.close();
  }
}
