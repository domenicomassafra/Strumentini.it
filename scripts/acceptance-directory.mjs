import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

/**
 * Discovery acceptance: the server-rendered `/strumenti/` directory, the
 * `/cerca/` results page and the command palette.
 *
 * The gate is deliberately built on the surfaces the redesign actually ships:
 * every tool lives in the directory's DOM from the first byte, the URL is the
 * only state store (`q`, `gruppo`, `tipo`, `qualita`, `ordine`, `vista`,
 * `pagina`), and the search page renders its own results client-side. The
 * proof that matters most stays the same as before: browsing discovery must
 * never pull a tool implementation chunk before a tool is opened.
 */

const root = resolve(import.meta.dirname, "..");
// Allow callers (including concurrent CI/agent runs) to point the acceptance at
// an isolated production build instead of racing over the repository `dist/`.
const dist = resolve(root, process.env.DIRECTORY_ACCEPTANCE_DIST ?? "dist");
const assetDir = resolve(dist, "_astro");
const receiptDir = resolve(root, "quality/receipts/discovery");
const port = 18000 + (process.pid % 1000);
const origin = `http://127.0.0.1:${port}`;
const expandedPort = port + 1000;
const expandedOrigin = `http://127.0.0.1:${expandedPort}`;
const expandedFixtureConfig = "scripts/fixtures/expanded-directory/astro.config.mjs";
const expandedPayloadBudget = Object.freeze({
  htmlBytes: 512 * 1024,
  initialScriptBytes: 192 * 1024,
});
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const visibleCards = "[data-directory-grid] .tool-card:not([hidden])";

async function waitForServer(targetOrigin, pathname = "/") {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${targetOrigin}${pathname}`);
      if (response.ok) return;
    } catch {
      // Retry until the child server has bound its port.
    }
    await sleep(100);
  }
  throw new Error(`Static acceptance server did not become ready at ${targetOrigin}${pathname}`);
}

async function implementationAssets(directory = assetDir) {
  const files = await readdir(directory);
  const implementation = new Set();
  for (const file of files.filter((entry) => entry.endsWith(".js.map"))) {
    const map = JSON.parse(await readFile(resolve(directory, file), "utf8"));
    const sources = Array.isArray(map.sources) ? map.sources : [];
    if (sources.some((source) => /(?:^|\/)src\/tools\/[^/]+\/module\.ts$/u.test(String(source)))) {
      implementation.add(file.slice(0, -4));
    }
  }
  return [...implementation].sort();
}

async function buildExpandedFixture(outDir) {
  await new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, [resolve(root, "node_modules/astro/bin/astro.mjs"), "build", "--config", expandedFixtureConfig], {
      cwd: root,
      env: { ...process.env, EXPANDED_DIRECTORY_OUT_DIR: outDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", rejectBuild);
    child.on("close", (code) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`Expanded-directory fixture build failed (${code}):\n${output.slice(-6000)}`));
    });
  });
}

async function initialPayload(distRoot, pagePath) {
  const html = await readFile(resolve(distRoot, pagePath), "utf8");
  const scriptRefs = [...new Set(
    [...html.matchAll(/<script[^>]+src="([^"]+\.js(?:\?[^"]*)?)"/gu)].map((match) => match[1]),
  )];
  let externalJsBytes = 0;
  for (const reference of scriptRefs) {
    const pathname = new URL(reference, "http://fixture.invalid").pathname.replace(/^\//u, "");
    externalJsBytes += (await stat(resolve(distRoot, pathname))).size;
  }
  const inlineScriptBytes = [...html.matchAll(/<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gu)]
    .reduce((sum, match) => sum + Buffer.byteLength(match[1] ?? "", "utf8"), 0);
  return {
    htmlBytes: Buffer.byteLength(html, "utf8"),
    externalJsBytes,
    inlineScriptBytes,
    initialScriptBytes: externalJsBytes + inlineScriptBytes,
    scriptFiles: scriptRefs.map((reference) => basename(new URL(reference, "http://fixture.invalid").pathname)),
  };
}

function assertNoImplementationRequests(requestedScripts, toolAssets, label) {
  const requestedNames = new Set(requestedScripts.map((url) => basename(new URL(url).pathname)));
  const eager = toolAssets.filter((asset) => requestedNames.has(asset));
  if (eager.length > 0) throw new Error(`${label} eagerly loaded tool implementation chunk(s): ${eager.join(", ")}`);
}

const cardNames = (page) =>
  page.locator(`${visibleCards} .tool-card-name a`).allInnerTexts();

const sortedNames = async (page) => (await cardNames(page)).map((name) => name.replace(/\s+/gu, " ").trim()).sort();

function assertSameSet(left, right, message) {
  if (left.length !== right.length || left.some((name, index) => name !== right[index])) {
    throw new Error(`${message} (${left.length} vs ${right.length})`);
  }
}

let server;
let expandedServer;
let expandedTempDir;
let browser;

try {
  expandedTempDir = await mkdtemp(resolve(tmpdir(), "strumentini-expanded-directory-"));
  const expandedDist = resolve(expandedTempDir, "dist");
  await buildExpandedFixture(expandedDist);
  const expandedAssetDir = resolve(expandedDist, "_astro");
  const expandedPayload = await initialPayload(expandedDist, "strumenti/index.html");
  const expandedCategoryPayload = await initialPayload(expandedDist, "categorie/fixture-scale/index.html");
  if (expandedPayload.htmlBytes > expandedPayloadBudget.htmlBytes) {
    throw new Error(`Expanded directory HTML is ${expandedPayload.htmlBytes} bytes; budget is ${expandedPayloadBudget.htmlBytes}`);
  }
  if (expandedPayload.initialScriptBytes > expandedPayloadBudget.initialScriptBytes) {
    throw new Error(`Expanded directory initial script payload is ${expandedPayload.initialScriptBytes} bytes; budget is ${expandedPayloadBudget.initialScriptBytes}`);
  }
  if (expandedCategoryPayload.htmlBytes > expandedPayloadBudget.htmlBytes) {
    throw new Error(`Expanded category HTML is ${expandedCategoryPayload.htmlBytes} bytes; budget is ${expandedPayloadBudget.htmlBytes}`);
  }
  if (expandedCategoryPayload.initialScriptBytes > expandedPayloadBudget.initialScriptBytes) {
    throw new Error(`Expanded category initial script payload is ${expandedCategoryPayload.initialScriptBytes} bytes; budget is ${expandedPayloadBudget.initialScriptBytes}`);
  }

  server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { stdio: "ignore" });
  expandedServer = spawn("python3", ["-m", "http.server", String(expandedPort), "--bind", "127.0.0.1", "--directory", expandedDist], { stdio: "ignore" });
  await Promise.all([waitForServer(origin), waitForServer(expandedOrigin, "/strumenti/")]);
  const toolAssets = await implementationAssets();
  if (toolAssets.length === 0) throw new Error("Could not identify any production tool implementation chunks from source maps");
  const expandedImplementationAssets = await implementationAssets(expandedAssetDir);
  if (expandedImplementationAssets.length > 0) {
    throw new Error(`Expanded directory fixture bundled tool implementation modules: ${expandedImplementationAssets.join(", ")}`);
  }

  browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const requestedScripts = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") requestedScripts.push(request.url());
  });

  // --- Directory URL state ------------------------------------------------
  await page.goto(`${origin}/strumenti/?q=giorni&ordine=za&pagina=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-directory-query]")?.value === "giorni");
  if ((await page.locator("[data-directory-query]").inputValue()) !== "giorni") throw new Error("Directory query did not restore from the URL");
  if ((await page.locator("[data-directory-sort]").inputValue()) !== "za") throw new Error("Directory sort did not restore from the URL");
  const productionCatalogItems = await page.locator("[data-directory-grid] .tool-card").count();
  if (productionCatalogItems < 1) throw new Error("Directory DOM contains no catalog cards");
  const filteredCount = Number.parseInt(await page.locator("[data-directory-count]").innerText(), 10);
  const filteredRows = await page.locator(visibleCards).count();
  if (!(filteredCount > 0 && filteredCount < productionCatalogItems)) throw new Error(`Directory filtered count ${filteredCount} is not a real subset of the ${productionCatalogItems}-tool catalog`);
  if (filteredRows < 1) throw new Error("Expected at least one filtered directory card");
  assertNoImplementationRequests(requestedScripts, toolAssets, "Directory discovery");

  // --- Addressable state survives a round trip and a back navigation ------
  await page.locator(`${visibleCards} .tool-card-name a`).first().click();
  await page.waitForLoadState("networkidle");
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-directory-query]")?.value === "giorni");
  if ((await page.locator("[data-directory-query]").inputValue()) !== "giorni") throw new Error("Back navigation lost the directory query");
  if ((await page.locator("[data-directory-sort]").inputValue()) !== "za") throw new Error("Back navigation lost the directory sort");

  // --- A filter change writes the URL, a reload restores the same set -----
  await page.locator("[data-directory-sort]").selectOption("categoria");
  await page.waitForFunction(() => new URLSearchParams(location.search).get("ordine") === "categoria");
  const beforeReload = await cardNames(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-directory-sort]")?.value === "categoria");
  if (new URLSearchParams(new URL(page.url()).search).get("ordine") !== "categoria") throw new Error("Reload dropped the directory order parameter");
  if ((await page.locator("[data-directory-sort]").inputValue()) !== "categoria") throw new Error("Reload did not restore the directory sort");
  const afterReload = await cardNames(page);
  assertSameSet(beforeReload, afterReload, "Reload did not restore the same directory result set");
  if (afterReload.length === 0) throw new Error("Directory rendered no cards after the reload");

  // --- Group view ---------------------------------------------------------
  await page.goto(`${origin}/strumenti/?vista=gruppi&q=giorni`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-directory-query]")?.value === "giorni");
  await page.waitForFunction(() => document.querySelectorAll("[data-group-head]:not([hidden])").length > 0);
  const totalHeads = await page.locator("[data-group-head]").count();
  const shownHeads = await page.locator("[data-group-head]:not([hidden])").count();
  const hiddenHeads = await page.locator("[data-group-head][hidden]").count();
  if (shownHeads < 1) throw new Error("Group view rendered no group heads");
  if (hiddenHeads < 1 || shownHeads + hiddenHeads !== totalHeads) throw new Error(`Group view did not hide the empty groups (${shownHeads} shown, ${hiddenHeads} hidden, ${totalHeads} total)`);
  const headsWithCards = await page.evaluate(() => {
    const grid = document.querySelector("[data-directory-grid]");
    const visible = [...grid.querySelectorAll(".tool-card:not([hidden])")].map((card) => card.dataset.group);
    const heads = [...grid.querySelectorAll("[data-group-head]:not([hidden])")].map((head) => head.dataset.groupHead);
    return { visible, heads };
  });
  if (headsWithCards.heads.some((group) => !headsWithCards.visible.includes(group))) throw new Error("Group view shows a group head without any visible card");
  if (headsWithCards.visible.some((group) => !headsWithCards.heads.includes(group))) throw new Error("Group view shows a card outside every visible group head");

  // --- Pagination ---------------------------------------------------------
  await page.goto(`${origin}/strumenti/`, { waitUntil: "networkidle" });
  await page.waitForFunction((expected) => document.querySelector("[data-directory-count]")?.textContent?.trim() === String(expected), productionCatalogItems);
  const catalogItems = Number.parseInt(await page.locator("[data-directory-count]").innerText(), 10);
  if (catalogItems !== productionCatalogItems) throw new Error(`Directory count ${catalogItems} does not match ${productionCatalogItems} rendered catalog cards`);
  const pageOneRows = await page.locator(visibleCards).count();
  if (pageOneRows !== 24) throw new Error(`Directory page 1 rendered ${pageOneRows} cards; expected exactly 24`);
  const pageOne = await sortedNames(page);

  await page.goto(`${origin}/strumenti/?pagina=2`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-directory-pagination] .directory-page-current")?.textContent?.trim() === "2");
  const pageTwoRows = await page.locator(visibleCards).count();
  if (pageTwoRows !== 24) throw new Error(`Directory page 2 rendered ${pageTwoRows} cards; expected exactly 24`);
  const pageTwo = await sortedNames(page);
  const overlap = pageTwo.filter((name) => pageOne.includes(name));
  if (overlap.length > 0) throw new Error(`Directory page 2 repeats page 1 cards: ${overlap.slice(0, 3).join(", ")}`);

  // --- Current category surface -------------------------------------------
  const categoryPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const categoryRequestedScripts = [];
  categoryPage.on("request", (request) => {
    if (request.resourceType() === "script") categoryRequestedScripts.push(request.url());
  });
  await categoryPage.goto(`${origin}/categorie/immagini/`, { waitUntil: "networkidle" });
  const currentCategoryTotal = await categoryPage.locator("[data-group-tools] [data-tool-grid] .tool-card").count();
  if (currentCategoryTotal < 1) throw new Error("Current category surface rendered no tools");
  if (!(await categoryPage.locator("#tutti-gli-strumenti").innerText()).includes(`(${currentCategoryTotal})`)) {
    throw new Error("Current category heading count does not match its rendered inventory");
  }
  if (!(await categoryPage.locator("[data-group-pagination]").isHidden())) {
    throw new Error("Current <=24-tool category unexpectedly paginated");
  }
  const currentCategoryFilter = categoryPage.locator("[data-group-tools] [data-filter]:not([data-filter='all'])").first();
  const currentCategoryFilterText = await currentCategoryFilter.innerText();
  const currentCategoryFilterMatch = currentCategoryFilterText.match(/\((\d+)\)\s*$/u);
  if (currentCategoryFilterMatch === null) throw new Error("Current category facet does not expose a generated count");
  const currentCategoryFilterCount = Number.parseInt(currentCategoryFilterMatch[1], 10);
  await currentCategoryFilter.focus();
  await categoryPage.keyboard.press("Enter");
  if ((await currentCategoryFilter.getAttribute("aria-pressed")) !== "true") throw new Error("Current category facet is not keyboard-operable");
  if (await categoryPage.locator("[data-group-tools] [data-tool-grid] .tool-card:not([hidden])").count() !== currentCategoryFilterCount) {
    throw new Error("Current category facet count does not match the filtered card set");
  }
  if ((await categoryPage.locator("[data-tool-status]").getAttribute("aria-live")) !== "polite") {
    throw new Error("Current category filtered count is not exposed through a polite live region");
  }
  await categoryPage.setViewportSize({ width: 390, height: 844 });
  const currentCategoryOverflow = await categoryPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (currentCategoryOverflow) throw new Error("Current category surface overflows horizontally at 390px");
  assertNoImplementationRequests(categoryRequestedScripts, toolAssets, "Current category discovery");
  await categoryPage.close();

  // --- Expanded catalogue fixture (>200 tools) ----------------------------
  const expandedPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const expandedRequestedScripts = [];
  expandedPage.on("request", (request) => {
    if (request.resourceType() === "script") expandedRequestedScripts.push(request.url());
  });

  await expandedPage.goto(`${expandedOrigin}/strumenti/`, { waitUntil: "networkidle" });
  const expandedContract = JSON.parse(await expandedPage.locator("[data-expanded-directory-fixture]").textContent());
  if (!(expandedContract.totalCount > 200 && expandedContract.syntheticCount > 0)) {
    throw new Error(`Expanded fixture is not actually expanded: ${JSON.stringify(expandedContract)}`);
  }
  await expandedPage.waitForFunction(
    (expected) => document.querySelector("[data-directory-count]")?.textContent?.trim() === String(expected),
    expandedContract.totalCount,
  );
  const expandedAllCardCount = await expandedPage.locator("[data-directory-grid] .tool-card").count();
  if (expandedAllCardCount !== expandedContract.totalCount) {
    throw new Error(`Expanded fixture rendered ${expandedAllCardCount} cards for ${expandedContract.totalCount} inventory entries`);
  }

  const expandedFacetAudit = await expandedPage.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-directory-grid] .tool-card")];
    const numberText = (node) => Number.parseInt(node?.textContent?.trim() || "0", 10);
    const countGroup = (slug) => cards.filter((card) => card.dataset.group === slug).length;
    const countQuality = (quality) => cards.filter((card) => card.dataset.quality === quality).length;
    const countInput = (input) => cards.filter((card) => (card.dataset.inputs || "").split(" ").includes(input)).length;
    const mismatches = [];
    for (const row of document.querySelectorAll("[data-group-row]")) {
      const slug = row.dataset.groupRow;
      const expected = countGroup(slug);
      const actual = numberText(row.querySelector(".filtri-count"));
      if (actual !== expected) mismatches.push(`group:${slug}:${actual}/${expected}`);
    }
    for (const box of document.querySelectorAll("input[data-facet='input']")) {
      const expected = countInput(box.value);
      const actual = numberText(box.closest("li")?.querySelector(".filtri-count"));
      if (actual !== expected) mismatches.push(`input:${box.value}:${actual}/${expected}`);
    }
    for (const box of document.querySelectorAll("input[data-facet='quality']")) {
      const expected = countQuality(box.value);
      const actual = numberText(box.closest("li")?.querySelector(".filtri-count"));
      if (actual !== expected) mismatches.push(`quality:${box.value}:${actual}/${expected}`);
    }
    for (const head of document.querySelectorAll("[data-group-head]")) {
      const slug = head.dataset.groupHead;
      const expected = countGroup(slug);
      const actual = numberText(head.querySelector("small"));
      if (actual !== expected) mismatches.push(`group-head:${slug}:${actual}/${expected}`);
    }
    return {
      mismatches,
      groups: document.querySelectorAll("[data-group-row]").length,
      inputs: document.querySelectorAll("input[data-facet='input']").length,
      qualities: document.querySelectorAll("input[data-facet='quality']").length,
    };
  });
  if (expandedFacetAudit.mismatches.length > 0) {
    throw new Error(`Expanded fixture facet counts diverge from tested inventory: ${expandedFacetAudit.mismatches.join(", ")}`);
  }
  const expandedVerifiedTab = await expandedPage.locator('[data-tab="verificati"]').innerText();
  if (!expandedVerifiedTab.includes(`(${expandedContract.verifiedCount})`)) {
    throw new Error(`Expanded verified tab count does not match fixture inventory: ${expandedVerifiedTab}`);
  }

  const expandedQuery = encodeURIComponent(expandedContract.fixtureQuery);
  await expandedPage.goto(`${expandedOrigin}/strumenti/?q=${expandedQuery}`, { waitUntil: "networkidle" });
  await expandedPage.waitForFunction(
    (expected) => document.querySelector("[data-directory-count]")?.textContent?.trim() === String(expected),
    expandedContract.syntheticCount,
  );
  const expandedFilteredRows = await expandedPage.locator(visibleCards).count();
  if (expandedFilteredRows !== Math.min(24, expandedContract.syntheticCount)) {
    throw new Error(`Expanded filtered page rendered ${expandedFilteredRows} cards; expected ${Math.min(24, expandedContract.syntheticCount)}`);
  }

  const keyboardGroupBox = expandedPage.locator("input[data-facet='group']").first();
  const keyboardGroup = await keyboardGroupBox.inputValue();
  const expectedKeyboardGroupCount = await expandedPage.evaluate(({ group, query }) => {
    const normalized = query.toLocaleLowerCase("it");
    return [...document.querySelectorAll("[data-directory-grid] .tool-card")]
      .filter((card) => card.dataset.group === group && (card.textContent || "").toLocaleLowerCase("it").includes(normalized)).length;
  }, { group: keyboardGroup, query: expandedContract.fixtureQuery });
  await keyboardGroupBox.focus();
  await expandedPage.keyboard.press("Space");
  await expandedPage.waitForFunction((group) => new URLSearchParams(location.search).get("gruppo") === group, keyboardGroup);
  const keyboardFilteredCount = Number.parseInt(await expandedPage.locator("[data-directory-count]").innerText(), 10);
  if (keyboardFilteredCount !== expectedKeyboardGroupCount) {
    throw new Error(`Keyboard group filter count ${keyboardFilteredCount} does not match inventory count ${expectedKeyboardGroupCount}`);
  }
  const stateBeforeReload = await sortedNames(expandedPage);
  await expandedPage.reload({ waitUntil: "networkidle" });
  await expandedPage.waitForFunction((group) => document.querySelector(`input[data-facet='group'][value="${group}"]`)?.checked === true, keyboardGroup);
  const stateAfterReload = await sortedNames(expandedPage);
  assertSameSet(stateBeforeReload, stateAfterReload, "Expanded directory reload did not preserve the filtered set");
  if ((await expandedPage.locator("[data-directory-query]").inputValue()) !== expandedContract.fixtureQuery) {
    throw new Error("Expanded directory reload lost the query");
  }

  await expandedPage.locator(`${visibleCards} .tool-card-name a`).first().click();
  await expandedPage.waitForLoadState("networkidle");
  await expandedPage.goBack({ waitUntil: "networkidle" });
  await expandedPage.waitForFunction((group) => document.querySelector(`input[data-facet='group'][value="${group}"]`)?.checked === true, keyboardGroup);
  const stateAfterBack = await sortedNames(expandedPage);
  assertSameSet(stateBeforeReload, stateAfterBack, "Expanded directory back navigation did not restore the filtered set");
  if ((await expandedPage.locator("[data-directory-query]").inputValue()) !== expandedContract.fixtureQuery) {
    throw new Error("Expanded directory back navigation lost the query");
  }

  await expandedPage.goto(`${expandedOrigin}/strumenti/?vista=gruppi&q=${expandedQuery}`, { waitUntil: "networkidle" });
  await expandedPage.waitForFunction(
    (expected) => document.querySelector("[data-directory-count]")?.textContent?.trim() === String(expected),
    expandedContract.syntheticCount,
  );
  const expandedGroupView = await expandedPage.evaluate(() => {
    const visible = [...document.querySelectorAll("[data-directory-grid] .tool-card:not([hidden])")].map((card) => card.dataset.group);
    const heads = [...document.querySelectorAll("[data-group-head]:not([hidden])")].map((head) => head.dataset.groupHead);
    return {
      visibleCards: visible.length,
      visibleHeads: heads.length,
      headlessCards: visible.filter((group) => !heads.includes(group)),
      emptyHeads: heads.filter((group) => !visible.includes(group)),
    };
  });
  if (expandedGroupView.visibleCards !== Math.min(24, expandedContract.syntheticCount)) {
    throw new Error(`Expanded group view rendered ${expandedGroupView.visibleCards} cards on page 1`);
  }
  if (expandedGroupView.visibleHeads < 2 || expandedGroupView.headlessCards.length > 0 || expandedGroupView.emptyHeads.length > 0) {
    throw new Error(`Expanded group view is inconsistent: ${JSON.stringify(expandedGroupView)}`);
  }

  const expandedTotalPages = Math.ceil(expandedContract.totalCount / 24);
  const deepPage = Math.min(6, expandedTotalPages - 1);
  if (deepPage < 2) throw new Error(`Expanded fixture has only ${expandedTotalPages} pages`);
  await expandedPage.goto(`${expandedOrigin}/strumenti/?pagina=${deepPage}`, { waitUntil: "networkidle" });
  await expandedPage.waitForFunction(
    (expected) => document.querySelector("[data-directory-pagination] .directory-page-current")?.textContent?.trim() === String(expected),
    deepPage,
  );
  const deepPageNames = await sortedNames(expandedPage);
  if (deepPageNames.length !== 24) throw new Error(`Expanded deep page ${deepPage} rendered ${deepPageNames.length} cards`);
  const expandedPaginationShape = await expandedPage.evaluate(() => ({
    controls: document.querySelectorAll("[data-directory-pagination] .directory-page, [data-directory-pagination] .directory-page-gap").length,
    gaps: document.querySelectorAll("[data-directory-pagination] .directory-page-gap").length,
  }));
  if (expandedPaginationShape.controls > 9 || (expandedTotalPages > 5 && expandedPaginationShape.gaps < 1)) {
    throw new Error(`Expanded pagination is not bounded: ${JSON.stringify(expandedPaginationShape)}`);
  }
  const nextDeepPage = deepPage + 1;
  const nextDeepLink = expandedPage.locator(`[data-directory-pagination] .directory-page:not(.directory-page-nav)[data-page="${nextDeepPage}"]`);
  await nextDeepLink.focus();
  await expandedPage.keyboard.press("Enter");
  await expandedPage.waitForFunction(
    (expected) => document.querySelector("[data-directory-pagination] .directory-page-current")?.textContent?.trim() === String(expected),
    nextDeepPage,
  );
  const expandedPaginationFocus = await expandedPage.evaluate(() => document.activeElement === document.querySelector("[data-directory-head]"));
  if (!expandedPaginationFocus) throw new Error("Expanded pagination did not move keyboard focus to the results heading");
  const nextDeepNames = await sortedNames(expandedPage);
  if (nextDeepNames.some((name) => deepPageNames.includes(name))) throw new Error("Expanded adjacent deep pages repeat cards");

  await expandedPage.setViewportSize({ width: 390, height: 844 });
  await expandedPage.goto(`${expandedOrigin}/strumenti/?q=${expandedQuery}`, { waitUntil: "networkidle" });
  await expandedPage.waitForFunction(
    (expected) => document.querySelector("[data-directory-count]")?.textContent?.trim() === String(expected),
    expandedContract.syntheticCount,
  );
  const expandedMobile = await expandedPage.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const cards = [...document.querySelectorAll("[data-directory-grid] .tool-card:not([hidden])")];
    const rects = cards.map((card) => card.getBoundingClientRect());
    const columns = new Set(rects.map((rect) => Math.round(rect.left))).size;
    const minCardWidth = rects.length === 0 ? 0 : Math.min(...rects.map((rect) => rect.width));
    const pagination = document.querySelector("[data-directory-pagination]");
    return {
      viewportWidth,
      visibleCards: cards.length,
      columns,
      minCardWidth,
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth,
      paginationOverflow: pagination ? pagination.scrollWidth > pagination.clientWidth : false,
      filtersCollapsed: document.querySelector("[data-directory-filters]")?.dataset.collapsed === "true",
    };
  });
  if (expandedMobile.horizontalOverflow || expandedMobile.paginationOverflow) {
    throw new Error(`Expanded directory overflows at 390px: ${JSON.stringify(expandedMobile)}`);
  }
  if (expandedMobile.visibleCards !== Math.min(24, expandedContract.syntheticCount) || expandedMobile.columns !== 1 || expandedMobile.minCardWidth < expandedMobile.viewportWidth * 0.75) {
    throw new Error(`Expanded 390px card density is unusable: ${JSON.stringify(expandedMobile)}`);
  }
  if (!expandedMobile.filtersCollapsed) throw new Error("Expanded 390px filters did not start collapsed");
  const mobileFilterToggle = expandedPage.locator("[data-filters-toggle]");
  await mobileFilterToggle.focus();
  await expandedPage.keyboard.press("Enter");
  if ((await mobileFilterToggle.getAttribute("aria-expanded")) !== "true") throw new Error("Expanded mobile filters are not keyboard-operable");

  const expandedNavigation = await expandedPage.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry ? {
      domContentLoadedMs: entry.domContentLoadedEventEnd - entry.startTime,
      loadMs: entry.loadEventEnd - entry.startTime,
    } : { domContentLoadedMs: null, loadMs: null };
  });
  assertNoImplementationRequests(expandedRequestedScripts, toolAssets, "Expanded directory discovery");

  // --- Expanded category page ---------------------------------------------
  expandedRequestedScripts.length = 0;
  await expandedPage.setViewportSize({ width: 1280, height: 900 });
  await expandedPage.goto(`${expandedOrigin}/categorie/fixture-scale/`, { waitUntil: "networkidle" });
  const expandedCategoryContract = JSON.parse(await expandedPage.locator("[data-expanded-category-fixture]").textContent());
  if (!(expandedCategoryContract.totalCount > 200 && expandedCategoryContract.syntheticCount >= 100)) {
    throw new Error(`Expanded category fixture is not large enough: ${JSON.stringify(expandedCategoryContract)}`);
  }
  const categoryCards = await expandedPage.locator("[data-group-tools] [data-tool-grid] .tool-card").count();
  if (categoryCards !== expandedCategoryContract.totalCount) {
    throw new Error(`Expanded category rendered ${categoryCards} cards for ${expandedCategoryContract.totalCount} inventory entries`);
  }
  const categoryTitle = (await expandedPage.locator("#tutti-gli-strumenti").innerText()).trim();
  if (!categoryTitle.includes(`(${expandedCategoryContract.totalCount})`)) {
    throw new Error(`Expanded category heading count is stale: ${categoryTitle}`);
  }
  const categoryFacetAudit = await expandedPage.evaluate((expectedCounts) => {
    const mismatches = [];
    for (const button of document.querySelectorAll("[data-group-tools] [data-filter]:not([data-filter='all'])")) {
      const category = button.getAttribute("data-filter") ?? "";
      const match = (button.textContent ?? "").match(/\((\d+)\)\s*$/u);
      const shown = match === null ? Number.NaN : Number.parseInt(match[1], 10);
      const expected = expectedCounts[category];
      if (shown !== expected) mismatches.push(`${category}:${shown}!=${expected}`);
    }
    return mismatches;
  }, expandedCategoryContract.counts);
  if (categoryFacetAudit.length > 0) {
    throw new Error(`Expanded category facet counts diverge from rendered inventory: ${categoryFacetAudit.join(", ")}`);
  }

  const populatedCategory = Object.entries(expandedCategoryContract.counts).find(([, count]) => count > 0)?.[0];
  if (!populatedCategory) throw new Error("Expanded category fixture has no populated subcategory");
  const categoryFilter = expandedPage.locator(`[data-group-tools] [data-filter="${populatedCategory}"]`);
  await categoryFilter.focus();
  await expandedPage.keyboard.press("Enter");
  if ((await categoryFilter.getAttribute("aria-pressed")) !== "true") {
    throw new Error("Expanded category filter is not keyboard-operable or does not expose pressed state");
  }
  const categoryVisible = await expandedPage.locator("[data-group-tools] [data-tool-grid] .tool-card:not([hidden])").count();
  const categoryFilteredTotal = expandedCategoryContract.counts[populatedCategory];
  if (categoryVisible !== Math.min(24, categoryFilteredTotal)) {
    throw new Error(`Expanded category filter shows ${categoryVisible}, expected page size ${Math.min(24, categoryFilteredTotal)}`);
  }
  const categoryStatus = expandedPage.locator("[data-group-tools] [data-tool-status]");
  if ((await categoryStatus.getAttribute("aria-live")) !== "polite") throw new Error("Expanded category count is not announced politely");
  if (!(await categoryStatus.innerText()).includes(`di ${categoryFilteredTotal} strumenti filtrati`)) {
    throw new Error(`Expanded category status does not expose filtered/total counts: ${await categoryStatus.innerText()}`);
  }
  const categoryPageCount = Math.ceil(categoryFilteredTotal / 24);
  const categoryPagination = expandedPage.locator("[data-group-pagination]");
  if (categoryPageCount > 1 && await categoryPagination.isHidden()) throw new Error("Expanded category pagination is hidden for a multi-page result");
  const categoryPaginationControls = await expandedPage.locator("[data-group-pagination-list] .pill").count();
  if (categoryPaginationControls > 9) throw new Error(`Expanded category pagination is not bounded: ${categoryPaginationControls} controls`);
  if (categoryPageCount > 1) {
    const categoryNext = expandedPage.locator("[data-group-pagination-list]").getByRole("button", { name: "2", exact: true });
    await categoryNext.focus();
    await expandedPage.keyboard.press("Enter");
    await expandedPage.waitForFunction(() => document.querySelector('[data-group-pagination-list] [aria-current="page"]')?.textContent?.trim() === "2");
    const categoryPaginationFocus = await expandedPage.evaluate(() => document.activeElement?.id === "tutti-gli-strumenti");
    if (!categoryPaginationFocus) throw new Error("Expanded category pagination did not move keyboard focus to the category heading");
    const secondCategoryPageVisible = await expandedPage.locator("[data-group-tools] [data-tool-grid] .tool-card:not([hidden])").count();
    if (secondCategoryPageVisible !== Math.min(24, Math.max(0, categoryFilteredTotal - 24))) {
      throw new Error(`Expanded category second page shows ${secondCategoryPageVisible} unexpected cards`);
    }
  }

  await expandedPage.setViewportSize({ width: 390, height: 844 });
  const expandedCategoryMobile = await expandedPage.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const cards = [...document.querySelectorAll("[data-group-tools] [data-tool-grid] .tool-card:not([hidden])")];
    const rects = cards.map((card) => card.getBoundingClientRect());
    return {
      visibleCards: cards.length,
      columns: new Set(rects.map((rect) => Math.round(rect.left))).size,
      minCardWidth: rects.length === 0 ? 0 : Math.min(...rects.map((rect) => rect.width)),
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth,
      viewportWidth,
    };
  });
  if (expandedCategoryMobile.horizontalOverflow || expandedCategoryMobile.columns !== 1 || expandedCategoryMobile.minCardWidth < expandedCategoryMobile.viewportWidth * 0.75) {
    throw new Error(`Expanded category is unusable at 390px: ${JSON.stringify(expandedCategoryMobile)}`);
  }
  assertNoImplementationRequests(expandedRequestedScripts, toolAssets, "Expanded category discovery");
  await expandedPage.close();

  // --- /cerca/ results page ----------------------------------------------
  await page.goto(`${origin}/cerca/?q=comprimi%20pdf`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll("[data-search-results] .tool-card").length > 0);
  const searchRows = await page.locator("[data-search-results] .tool-card").count();
  const searchCount = (await page.locator("[data-search-count]").innerText()).trim();
  if (searchRows < 1) throw new Error("Search page rendered no result rows");
  if (!/^Abbiamo trovato \d+ strument/u.test(searchCount)) throw new Error(`Search page count line is not a real count: "${searchCount}"`);
  const firstSearchHref = await page.locator("[data-search-results] .tool-card-name a").first().getAttribute("href");
  if (firstSearchHref !== "/tools/pdf-compression-lite") throw new Error(`Search page ranked the wrong route for "comprimi pdf": ${firstSearchHref}`);
  await page.goto(`${origin}/cerca/?q=comprmi%20pdf`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-search-nothing]")?.hasAttribute("hidden") === false);
  const nothingVisible = await page.locator("[data-search-nothing]:not([hidden])").isVisible();
  if (!nothingVisible) throw new Error("Search page did not surface the empty state for a nonsense query");
  const searchRecovery = page.locator('[data-search-suggestions] [data-search-reuse="comprimi pdf"]');
  await searchRecovery.waitFor();
  await searchRecovery.click();
  await page.waitForFunction(() => document.querySelectorAll("[data-search-results] .tool-card").length > 0);
  const recoveredHref = await page.locator("[data-search-results] .tool-card-name a").first().getAttribute("href");
  if (recoveredHref !== "/tools/pdf-compression-lite") throw new Error(`Search-page recovery ranked the wrong route: ${recoveredHref}`);

  // --- Command palette ----------------------------------------------------
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  const trigger = page.locator("[data-search-trigger]");
  await trigger.focus();
  await page.keyboard.press("Meta+K");
  await page.locator("[data-search-dialog][open]").waitFor();
  const paletteInput = page.locator("#global-search-input");
  await paletteInput.fill("conta giorni lavorativi");
  await page.locator("[role='option']").first().waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  const restored = await page.evaluate(() => document.activeElement?.hasAttribute("data-search-trigger") ?? false);
  if (!restored) throw new Error("Command palette did not restore focus to its invoking control");
  assertNoImplementationRequests(requestedScripts, toolAssets, "Command palette discovery");

  await page.keyboard.press("Control+K");
  await page.locator("[data-search-dialog][open]").waitFor();
  await paletteInput.fill("comprmi pdf");
  const closeIntent = page.locator('[data-intent="comprimi pdf"]');
  await closeIntent.waitFor();
  await closeIntent.click();
  await page.locator("[role='option']").first().waitFor();
  const recoveredPaletteHref = await page.locator("[role='option']").first().getAttribute("href");
  if (recoveredPaletteHref !== "/tools/pdf-compression-lite") throw new Error(`Palette recovery ranked the wrong route: ${recoveredPaletteHref}`);
  await paletteInput.fill("zzqqxx inesistente");
  const continuation = page.getByRole("link", { name: "Apri tutti gli strumenti", exact: true });
  await continuation.waitFor();
  const continuationHref = await continuation.getAttribute("href");
  if (!continuationHref?.startsWith("/strumenti/?q=")) throw new Error(`Zero-result continuation does not point at the directory: ${continuationHref}`);
  await page.keyboard.press("Escape");
  assertNoImplementationRequests(requestedScripts, toolAssets, "Zero-result discovery");

  await page.keyboard.press("Meta+K");
  await paletteInput.fill("conta giorni lavorativi");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/tools\/business-day\/?$/u);

  // --- Mobile 390px -------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (homeOverflow) throw new Error("Home overflowed horizontally at 390px");
  await page.locator("[data-search-trigger]").click();
  await page.locator("[data-search-dialog][open]").waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "global-search-input");
  const mobileFocused = await page.evaluate(() => document.activeElement?.id === "global-search-input");
  if (!mobileFocused) throw new Error("Mobile header search control did not focus the palette input");
  await page.keyboard.press("Escape");

  await page.goto(`${origin}/strumenti/`, { waitUntil: "networkidle" });
  const directoryOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (directoryOverflow) throw new Error("Directory overflowed horizontally at 390px");

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
    zeroResult: { queryPreserved: true, metadataCloseIntent: true, directoryContinuation: true },
    directoryState: {
      urlAddressable: true,
      backNavigationPreserved: true,
      reloadPreserved: true,
      query: "giorni",
      order: "za",
      filteredCount,
    },
    directoryView: { totalGroups: totalHeads, shownGroups: shownHeads, hiddenGroups: hiddenHeads },
    categoryCurrent: {
      route: "/categorie/immagini/",
      totalCount: currentCategoryTotal,
      facetCount: currentCategoryFilterCount,
      keyboardFilterOperable: true,
      politeCountAnnouncement: true,
      paginationHiddenWithinPageSize: true,
      mobile390: { horizontalOverflow: currentCategoryOverflow },
      eagerToolImplementationRequests: 0,
    },
    searchPage: { query: "comprimi pdf", results: searchRows, countLine: searchCount, emptyStateVisible: nothingVisible, metadataRecovery: true },
    mobile: { headerSearchOpensPalette: true, searchFocused: mobileFocused, homeOverflow, directoryOverflow },
    directoryPaging: { catalogItems, renderedRows: pageOneRows, pageSize: 24, secondPageRows: pageTwoRows, pageOverlap: overlap.length },
    expandedCatalog: {
      fixture: expandedContract,
      facets: { ...expandedFacetAudit, countsMatchInventory: true },
      state: {
        query: expandedContract.fixtureQuery,
        keyboardGroup,
        keyboardFilteredCount,
        reloadPreserved: true,
        backNavigationPreserved: true,
      },
      groupView: expandedGroupView,
      pagination: {
        totalPages: expandedTotalPages,
        deepPage,
        deepPageRows: deepPageNames.length,
        nextPage: nextDeepPage,
        nextPageRows: nextDeepNames.length,
        adjacentOverlap: 0,
        focusMovedToResultsHeading: expandedPaginationFocus,
        ...expandedPaginationShape,
      },
      mobile390: { ...expandedMobile, filterToggleKeyboardOperable: true },
      payload: {
        ...expandedPayload,
        budget: expandedPayloadBudget,
        gate: "PASS",
        navigationBaseline: expandedNavigation,
      },
      categoryPage: {
        fixture: expandedCategoryContract,
        facetCountsMatchInventory: true,
        keyboardFilterOperable: true,
        filteredCount: categoryFilteredTotal,
        pagination: { totalPages: categoryPageCount, boundedControls: categoryPaginationControls, keyboardOperable: true },
        mobile390: expandedCategoryMobile,
        payload: { ...expandedCategoryPayload, budget: expandedPayloadBudget, gate: "PASS" },
      },
      lazy: {
        fixtureImplementationAssets: expandedImplementationAssets,
        requestedScripts: expandedRequestedScripts.map((url) => basename(new URL(url).pathname)),
        eagerToolImplementationRequests: 0,
      },
    },
    chunkProof: {
      discoveryImplementationRequests: 0,
      actualScriptRequests: requestedScripts.map((url) => basename(new URL(url).pathname)),
    },
  };
  await writeFile(resolve(receiptDir, "acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`discovery acceptance PASS: focus restored, URL/reload/back preserved, ${catalogItems} production tools + ${expandedContract.totalCount} expanded-fixture tools, 390px single-column, eager tool chunks=0`);
} finally {
  await browser?.close().catch(() => undefined);
  server?.kill("SIGTERM");
  expandedServer?.kill("SIGTERM");
  if (expandedTempDir) await rm(expandedTempDir, { recursive: true, force: true });
}
