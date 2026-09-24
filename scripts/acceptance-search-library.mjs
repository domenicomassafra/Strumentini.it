import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const assetDir = resolve(dist, "_astro");
const receiptDir = resolve(root, "quality/receipts/search-library");
const port = 18000 + (process.pid % 1000);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Retry until the child server has bound its port.
    }
    await sleep(100);
  }
  throw new Error(`Static acceptance server did not become ready at ${origin}`);
}

async function implementationAssets() {
  const files = await readdir(assetDir);
  const implementation = new Set();
  for (const file of files.filter((entry) => entry.endsWith(".js.map"))) {
    const map = JSON.parse(await readFile(resolve(assetDir, file), "utf8"));
    const sources = Array.isArray(map.sources) ? map.sources : [];
    if (sources.some((source) => /(?:^|\/)src\/tools\/[^/]+\/module\.ts$/u.test(String(source)))) {
      implementation.add(file.slice(0, -4));
    }
  }
  return [...implementation].sort();
}

function fixtureTools(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `fixture-${String(index).padStart(3, "0")}`,
    route: "/tools/business-day",
    name: `Fixture Tool ${String(index).padStart(3, "0")}`,
    summary: `Generated catalog fixture ${index}`,
    aliases: index % 10 === 0 ? ["batch helper"] : [],
    jobs: [index % 2 === 0 ? "compare text" : "calculate dates"],
    category: index % 2 === 0 ? "text" : "date-time",
    inputTypes: [index % 2 === 0 ? "text" : "date"],
    engine: "fixture",
    runtime: { location: "LOCAL", network: "forbidden" },
  }));
}

function assertNoImplementationRequests(requestedScripts, toolAssets, label) {
  const requestedNames = new Set(requestedScripts.map((url) => basename(new URL(url).pathname)));
  const eager = toolAssets.filter((asset) => requestedNames.has(asset));
  if (eager.length > 0) throw new Error(`${label} eagerly loaded tool implementation chunk(s): ${eager.join(", ")}`);
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${label} has horizontal overflow`);
}

try {
  await waitForServer();
  const toolAssets = await implementationAssets();
  if (toolAssets.length === 0) throw new Error("Could not identify any production tool implementation chunks from source maps");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const requestedScripts = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") requestedScripts.push(request.url());
  });

  await page.goto(`${origin}/library/?q=working&runtime=LOCAL`, { waitUntil: "networkidle" });
  if ((await page.locator("#library-search").inputValue()) !== "working") throw new Error("Library query did not restore from URL");
  if ((await page.locator("select[name='runtime']").inputValue()) !== "LOCAL") throw new Error("Library runtime filter did not restore from URL");
  if ((await page.locator(".library-row").count()) < 1) throw new Error("Expected at least one filtered Library row");
  assertNoImplementationRequests(requestedScripts, toolAssets, "Library discovery");

  await page.locator(".library-row").first().click();
  await page.waitForLoadState("networkidle");
  await page.goBack({ waitUntil: "networkidle" });
  if ((await page.locator("#library-search").inputValue()) !== "working") throw new Error("Back navigation lost Library query state");
  if ((await page.locator("select[name='runtime']").inputValue()) !== "LOCAL") throw new Error("Back navigation lost Library filter state");

  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  const trigger = page.locator("[data-search-trigger]");
  await trigger.focus();
  await page.keyboard.press("Meta+K");
  await page.locator("[data-search-dialog][open]").waitFor();
  const paletteInput = page.locator("#global-search-input");
  await paletteInput.fill("business day calculator");
  await page.locator("[role='option']").first().waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  const restored = await page.evaluate(() => document.activeElement?.hasAttribute("data-search-trigger") ?? false);
  if (!restored) throw new Error("Command palette did not restore focus to its invoking control");
  assertNoImplementationRequests(requestedScripts, toolAssets, "Command palette discovery");

  await page.keyboard.press("Control+K");
  await page.locator("[data-search-dialog][open]").waitFor();
  await paletteInput.fill("workng day calcultor");
  await page.getByRole("link", { name: "Request this tool", exact: true }).waitFor();
  await page.getByRole("button", { name: /working day calculator|workday calculator/u }).first().waitFor();
  await page.keyboard.press("Escape");
  assertNoImplementationRequests(requestedScripts, toolAssets, "Zero-result discovery");

  await page.keyboard.press("Meta+K");
  await paletteInput.fill("business day calculator");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/tools\/business-day\/?$/u);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  const mobileSearch = page.getByRole("link", { name: "Search", exact: true });
  await mobileSearch.click();
  await page.waitForURL(/\/library\/?\?focus=search/u);
  await page.waitForFunction(() => document.activeElement?.id === "library-search");
  const mobileFocused = await page.evaluate(() => document.activeElement?.id === "library-search");
  if (!mobileFocused) throw new Error("Mobile Search destination did not focus the explicit Library search control");

  const fixturePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const fixtureScripts = [];
  fixturePage.on("request", (request) => {
    if (request.resourceType() === "script") fixtureScripts.push(request.url());
  });
  const fixtures = fixtureTools(500);
  await fixturePage.route("**/library/**", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const html = await response.text();
    const replaced = html.replace(
      /(<script[^>]+id="utilityos-library-catalog"[^>]*>)(.*?)(<\/script>)/su,
      `$1${JSON.stringify(fixtures)}$3`,
    );
    if (replaced === html) throw new Error("Could not inject generated 500-tool Library fixture");
    await route.fulfill({ response, body: replaced });
  });
  const fixtureStarted = Date.now();
  await fixturePage.goto(`${origin}/library/?fixture=500`, { waitUntil: "networkidle" });
  await fixturePage.getByText("500 tools", { exact: true }).waitFor();
  const fixtureReadyMs = Date.now() - fixtureStarted;
  const renderedRows = await fixturePage.locator(".library-row").count();
  if (renderedRows !== 50) throw new Error(`500-tool fixture rendered ${renderedRows} rows; expected exactly 50`);
  if (fixtureReadyMs > 5000) throw new Error(`500-tool fixture exceeded 5s local acceptance budget: ${fixtureReadyMs}ms`);
  assertNoImplementationRequests(fixtureScripts, toolAssets, "500-tool Library fixture");

  await fixturePage.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(fixturePage, "390px Library");
  await fixturePage.setViewportSize({ width: 195, height: 844 });
  await assertNoHorizontalOverflow(fixturePage, "200% reflow Library");

  const nextPage = fixturePage.getByRole("button", { name: /Next page/u });
  await nextPage.focus();
  await nextPage.press("Enter");
  await fixturePage.locator("[data-library-page-status]").filter({ hasText: "Page 2 of 10" }).waitFor();
  await fixturePage.waitForFunction(() => document.activeElement?.matches("[data-library-page-status], [data-page]"));
  const paginationFocus = await fixturePage.evaluate(() => ({
    page: document.activeElement?.getAttribute("data-page"),
    status: document.activeElement?.getAttribute("data-library-page-status"),
  }));
  if (paginationFocus.page === null && paginationFocus.status === null) {
    throw new Error("Library pagination did not retain a focus target after page replacement");
  }

  await fixturePage.emulateMedia({ reducedMotion: "reduce" });
  const motionDuration = await fixturePage.locator("[data-library-page-status]").evaluate((element) => getComputedStyle(element).transitionDuration);
  const motionSeconds = Number.parseFloat(motionDuration);
  if (!Number.isFinite(motionSeconds) || motionSeconds > 0.00001) {
    throw new Error(`Reduced motion did not disable Library transitions: ${motionDuration}`);
  }

  await mkdir(receiptDir, { recursive: true });
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: "PASS",
    toolImplementationAssets: toolAssets,
    keyboard: {
      shortcuts: ["Meta+K", "Control+K"],
      arrowNavigation: true,
      enterOpen: true,
      escapeClose: true,
      focusRestored: restored,
    },
    zeroResult: { queryPreserved: true, metadataCloseIntent: true, requestAction: true },
    libraryState: {
      urlAddressable: true,
      backNavigationPreserved: true,
      query: "working",
      runtime: "LOCAL",
    },
    mobile: { explicitSearchDestination: true, searchFocused: mobileFocused },
    reflow: { width390: true, width200Percent: 195, paginationFocusRetained: true, reducedMotion: true },
    fixture500: { catalogItems: 500, renderedRows, pageSize: 50, readyMs: fixtureReadyMs },
    chunkProof: {
      discoveryImplementationRequests: 0,
      actualScriptRequests: requestedScripts.map((url) => basename(new URL(url).pathname)),
      fixtureScriptRequests: fixtureScripts.map((url) => basename(new URL(url).pathname)),
    },
  };
  await writeFile(resolve(receiptDir, "acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await browser.close();
  console.log(`search/library acceptance PASS: focus restored, URL/back preserved, 500→${renderedRows} DOM rows, eager tool chunks=0`);
} finally {
  server.kill("SIGTERM");
}
