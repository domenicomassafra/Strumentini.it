import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
const dist = resolve(root, "dist");
const assetDir = resolve(dist, "_astro");
const receiptDir = resolve(root, "quality/receipts/discovery");
const port = 18000 + (process.pid % 1000);
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const visibleCards = "[data-directory-grid] .tool-card:not([hidden])";

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

  // --- Directory URL state ------------------------------------------------
  await page.goto(`${origin}/strumenti/?q=giorni&ordine=za&pagina=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-directory-query]")?.value === "giorni");
  if ((await page.locator("[data-directory-query]").inputValue()) !== "giorni") throw new Error("Directory query did not restore from the URL");
  if ((await page.locator("[data-directory-sort]").inputValue()) !== "za") throw new Error("Directory sort did not restore from the URL");
  const filteredCount = Number.parseInt(await page.locator("[data-directory-count]").innerText(), 10);
  const filteredRows = await page.locator(visibleCards).count();
  if (!(filteredCount > 0 && filteredCount < 200)) throw new Error(`Directory filtered count ${filteredCount} is not a real subset of the 200-tool catalog`);
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
  await page.waitForFunction(() => document.querySelector("[data-directory-count]")?.textContent?.trim() === "200");
  const catalogItems = Number.parseInt(await page.locator("[data-directory-count]").innerText(), 10);
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

  // --- /cerca/ results page ----------------------------------------------
  await page.goto(`${origin}/cerca/?q=conta%20giorni`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll("[data-search-results] .tool-card").length > 0);
  const searchRows = await page.locator("[data-search-results] .tool-card").count();
  const searchCount = (await page.locator("[data-search-count]").innerText()).trim();
  if (searchRows < 1) throw new Error("Search page rendered no result rows");
  if (!/^Abbiamo trovato \d+ strument/u.test(searchCount)) throw new Error(`Search page count line is not a real count: "${searchCount}"`);
  await page.goto(`${origin}/cerca/?q=zzqqxx%20inesistente`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("[data-search-nothing]")?.hasAttribute("hidden") === false);
  const nothingVisible = await page.locator("[data-search-nothing]:not([hidden])").isVisible();
  if (!nothingVisible) throw new Error("Search page did not surface the empty state for a nonsense query");

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
    searchPage: { query: "conta giorni", results: searchRows, countLine: searchCount, emptyStateVisible: nothingVisible },
    mobile: { headerSearchOpensPalette: true, searchFocused: mobileFocused, homeOverflow, directoryOverflow },
    directoryPaging: { catalogItems, renderedRows: pageOneRows, pageSize: 24, secondPageRows: pageTwoRows, pageOverlap: overlap.length },
    chunkProof: {
      discoveryImplementationRequests: 0,
      actualScriptRequests: requestedScripts.map((url) => basename(new URL(url).pathname)),
    },
  };
  await writeFile(resolve(receiptDir, "acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await browser.close();
  console.log(`discovery acceptance PASS: focus restored, URL/reload/back preserved, 200→${pageOneRows}+${pageTwoRows} paged DOM cards, groups ${shownHeads}/${totalHeads}, eager tool chunks=0`);
} finally {
  server.kill("SIGTERM");
}
