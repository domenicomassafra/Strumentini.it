import { chromium } from "@playwright/test";
import preact from "@preact/preset-vite";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer as createViteServer } from "vite";

const port = Number(process.env.STRUMENTINI_URL_ACCEPTANCE_PORT ?? 18264);
const externalOrigin = process.env.STRUMENTINI_URL_ACCEPTANCE_ORIGIN;
const projectRoot = resolve(import.meta.dirname, "..");
let origin = externalOrigin ?? `http://127.0.0.1:${port}`;
let viteServer = null;
let harnessRoot = null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("static acceptance server did not become ready");
}

let browser;
try {
  if (externalOrigin === undefined) {
    harnessRoot = await mkdtemp(join(projectRoot, ".scratch", "url-marketing-browser-"));
    await writeFile(join(harnessRoot, "index.html"), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app"></main><script type="module" src="/entry.tsx"></script></body></html>');
    const componentsRoot = resolve(projectRoot, "src/components/tools");
    await writeFile(join(harnessRoot, "entry.tsx"), `
import { render } from "preact";
import { RedirectChainInspectorTool } from "/@fs${componentsRoot}/RedirectChainInspectorTool.tsx";
import { MetaPreviewTool } from "/@fs${componentsRoot}/MetaPreviewTool.tsx";
import { OpenGraphPreviewTool } from "/@fs${componentsRoot}/OpenGraphPreviewTool.tsx";
import { SocialCharacterLimitTool } from "/@fs${componentsRoot}/SocialCharacterLimitTool.tsx";
import { UtmBuilderTool } from "/@fs${componentsRoot}/UtmBuilderTool.tsx";
import { UrlBulkNormalizerTool } from "/@fs${componentsRoot}/UrlBulkNormalizerTool.tsx";
render(<>
  <section data-tool="meta-preview"><h2>Meta preview</h2><MetaPreviewTool /></section>
  <section data-tool="open-graph-preview"><h2>Open Graph preview</h2><OpenGraphPreviewTool /></section>
  <section data-tool="social-character-limit"><h2>Social limit</h2><SocialCharacterLimitTool /></section>
  <section data-tool="utm-builder"><h2>UTM builder</h2><UtmBuilderTool /></section>
  <section data-tool="url-bulk-normalizer"><h2>URL bulk normalizer</h2><UrlBulkNormalizerTool /></section>
  <section data-tool="redirect-chain-inspector"><h2>Redirect chain</h2><RedirectChainInspectorTool /></section>
</>, document.getElementById("app")!);
`);
    viteServer = await createViteServer({
      configFile: false,
      root: harnessRoot,
      plugins: [preact()],
      server: {
        host: "127.0.0.1",
        port,
        strictPort: true,
        fs: { allow: [projectRoot, harnessRoot] },
      },
    });
    await viteServer.listen();
    origin = `http://127.0.0.1:${port}`;
  }
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const liveRequests = [];
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/mock-redirect/")) liveRequests.push(url.pathname);
  });
  await page.route("**/mock-redirect/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/mock-redirect/a") {
      await route.fulfill({ status: 301, headers: { Location: "/mock-redirect/b" }, body: "" });
      return;
    }
    if (url.pathname === "/mock-redirect/b") {
      await route.fulfill({ status: 302, headers: { Location: "/mock-redirect/a" }, body: "" });
      return;
    }
    await route.fulfill({ status: 200, body: "ok" });
  });

  const routePath = externalOrigin === undefined ? "/" : "/tools/redirect-chain-inspector/";
  const response = await page.goto(`${origin}${routePath}`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`redirect acceptance surface returned HTTP ${response?.status()}`);

  if (externalOrigin === undefined) {
    const meta = page.locator('[data-tool="meta-preview"]');
    await meta.getByLabel("Titolo", { exact: true }).fill("😀 Titolo molto lungo ".repeat(8));
    await meta.getByLabel("Descrizione", { exact: true }).fill("Descrizione Unicode 世界 ".repeat(10));
    await meta.getByLabel("Preset anteprima", { exact: true }).selectOption("search-mobile");
    await meta.getByRole("button", { name: "Mostra anteprima" }).click();
    await meta.locator(".result-panel").last().getByText(/Fonte preset/iu).waitFor();
    const metaText = await meta.innerText();
    if (!/390×844px/iu.test(metaText) || !/controllata il 2026-09-23/iu.test(metaText) || !/indicativa/iu.test(metaText)) {
      throw new Error("meta preview omitted mobile preset authority/date/approximation context");
    }

    const openGraph = page.locator('[data-tool="open-graph-preview"]');
    await openGraph.getByLabel("Intestazione HTML o metadati", { exact: true }).fill([
      '<meta property="og:title" content="😀 Titolo sociale molto lungo">',
      '<meta property="og:description" content="Descrizione 世界">',
      '<meta property="og:image" content="https://images.invalid/hero.png">',
      '<meta property="og:url" content="https://example.com/post">',
      '<meta property="og:type" content="article">',
    ].join("\n"));
    await openGraph.getByRole("button", { name: "Estrai tag social" }).click();
    await openGraph.locator(".result-panel").last().getByText(/Fonte preset/iu).waitFor();
    const openGraphText = await openGraph.innerText();
    if (!/390×844px/iu.test(openGraphText) || !/controllata il 2026-09-23/iu.test(openGraphText) || !/indicativa/iu.test(openGraphText)) {
      throw new Error("Open Graph preview omitted preset authority/date/approximation context");
    }

    const social = page.locator('[data-tool="social-character-limit"]');
    await social.getByLabel("Piattaforma", { exact: true }).selectOption("x");
    await social.getByLabel("Testo del post", { exact: true }).fill("Unicode 世界 😀 https://example.com/x");
    await social.getByRole("button", { name: "Controlla lunghezza" }).click();
    await social.locator(".result-panel").last().getByText(/Contesto anteprima/iu).waitFor();

    const utm = page.locator('[data-tool="utm-builder"]');
    await utm.getByLabel("Modalità bulk UTM builder", { exact: true }).check();
    await utm.getByLabel("URL di destinazione", { exact: true }).fill("https://example.com/a?keep=1\nnot a url\nhttps://example.com/b?keep=2");
    await utm.getByLabel("Sorgente", { exact: true }).fill("newsletter");
    await utm.getByLabel("Mezzo", { exact: true }).fill("email");
    await utm.getByLabel("Campagna", { exact: true }).fill("ottobre");
    await utm.getByRole("button", { name: "Crea URL" }).click();
    await utm.getByText(/2 URL generati su 3/iu).waitFor();
    if (!/Riga 2: ERRORE/iu.test(await utm.innerText())) throw new Error("UTM bulk did not isolate the invalid row");

    const normalizer = page.locator('[data-tool="url-bulk-normalizer"]');
    await normalizer.getByLabel("URL, uno per riga", { exact: true }).fill("https://example.com/a/?b=2&a=1&utm_source=x#frag\n\nnot a url");
    await normalizer.getByLabel("Rimuovi il frammento", { exact: true }).check();
    await normalizer.getByLabel("Rimuovi slash finale", { exact: true }).check();
    await normalizer.getByLabel("Rimuovi parametri di tracciamento", { exact: true }).check();
    await normalizer.getByRole("button", { name: "Normalizza elenco" }).click();
    const normalizerPanel = normalizer.locator(".result-panel").last();
    await normalizerPanel.getByText("Risultato strutturato completo").click();
    const normalizerText = await normalizerPanel.innerText();
    if (!/"sourceRow": 3/iu.test(normalizerText) || !/"error": "INVALID_URL"/iu.test(normalizerText) || !/local-transform-only/iu.test(normalizerText)) {
      throw new Error("bulk normalizer omitted source row, failure reason, or local-only scope");
    }
  }

  const redirectSurface = externalOrigin === undefined
    ? page.locator('[data-tool="redirect-chain-inspector"]')
    : page.locator("body");
  const modeSelect = redirectSurface.getByLabel("Modalità diagnostica", { exact: true });
  await modeSelect.selectOption("live");
  await page.waitForTimeout(200);
  if (await redirectSurface.getByLabel("URL iniziale", { exact: true }).count() !== 1) {
    throw new Error(`live mode did not render its URL control; select=${await modeSelect.inputValue()} errors=${JSON.stringify(runtimeErrors)}`);
  }
  await redirectSurface.getByLabel("URL iniziale", { exact: true }).fill(`${origin}/mock-redirect/a`);
  await redirectSurface.getByLabel("Massimo redirect", { exact: true }).fill("5");
  await redirectSurface.getByLabel("Timeout per richiesta", { exact: true }).fill("1000");
  await sleep(100);
  if (liveRequests.length !== 0) {
    throw new Error(`live request happened before explicit submit: ${JSON.stringify(liveRequests)}`);
  }

  await redirectSurface.getByRole("button", { name: "Verifica redirect dal vivo" }).click();
  const panel = redirectSurface.locator(".result-panel").last();
  await panel.getByText("retrievedAt", { exact: true }).waitFor();
  const expectedOpaqueChain = JSON.stringify(["/mock-redirect/a"]);
  const expectedVisibleChain = JSON.stringify(["/mock-redirect/a", "/mock-redirect/b"]);
  if (![expectedOpaqueChain, expectedVisibleChain].includes(JSON.stringify(liveRequests))) {
    throw new Error(`unexpected intercepted live chain: ${JSON.stringify(liveRequests)}`);
  }
  const output = await panel.innerText();
  if (!/retrievedAt/iu.test(output) || !/(blocked|loop)/iu.test(output)) {
    throw new Error(`live result omitted retrieval/partial-chain evidence: ${JSON.stringify(output.slice(0, 600))}`);
  }
  await panel.locator("summary", { hasText: "Risultato strutturato completo" }).click();
  const expanded = await panel.innerText();
  if (!/privacyBoundary/iu.test(expanded) || !/unrelated task data/iu.test(expanded)) {
    throw new Error("live result omitted the privacy boundary");
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("redirect live route overflows horizontally at 390px");

  process.stdout.write(JSON.stringify({
    status: "PASS",
    surface: externalOrigin === undefined ? "isolated real-component harness" : "/tools/redirect-chain-inspector/",
    requestsBeforeSubmit: 0,
    interceptedChain: liveRequests,
    partialOutcomeVisible: true,
    retrievalTimestampVisible: true,
    privacyBoundaryVisible: true,
    previewPresetAcceptance: externalOrigin === undefined,
    utmBulkAcceptance: externalOrigin === undefined,
    normalizationBulkAcceptance: externalOrigin === undefined,
    horizontalOverflow390: false,
  }, null, 2) + "\n");
} finally {
  if (browser !== undefined) await browser.close();
  if (viteServer !== null) await viteServer.close();
  if (harnessRoot !== null) await rm(harnessRoot, { recursive: true, force: true });
}
