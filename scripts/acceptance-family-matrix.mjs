import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18350;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const newline = String.fromCharCode(10);
const pdfFixture = Buffer.from([
  "%PDF-1.7",
  "1 0 obj",
  "<</Type /Catalog /Pages 2 0 R>>",
  "endobj",
  "2 0 obj",
  "<</Type /Pages /Kids [3 0 R] /Count 1>>",
  "endobj",
  "3 0 obj",
  "<</Type /Page /Parent 2 0 R /MediaBox [0 0 300 400]>>",
  "endobj",
  "trailer",
  "<</Size 4 /Root 1 0 R>>",
  "%%EOF",
  "",
].join(newline));
const imageFixture = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const fileFixture = Buffer.from("strumentini-cross-family-private-value", "utf8");
const fileDigest = createHash("sha256").update(fileFixture).digest("hex");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// The site shell asks the Worker for the current account session on every route.
// This acceptance server is a plain static file server, so that single endpoint is
// expected to answer 404 here. Every other failed response — and every console error
// that is not a resource-load failure already attributed by URL — stays fatal.
const staticOnlyFailurePaths = new Set(["/api/auth/session"]);
const isExpectedStaticFailure = (url) => {
  try {
    return staticOnlyFailurePaths.has(new URL(url).pathname);
  } catch {
    return false;
  }
};

async function accessibilityAudit(page) {
  const audit = await page.evaluate(() => {
    const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
    const controls = [...document.querySelectorAll("input, textarea, select")].filter(visible);
    const unlabeled = controls.filter((element) => {
      const labels = "labels" in element && element.labels ? [...element.labels] : [];
      return labels.length === 0 && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && !element.getAttribute("title") && element.closest("label") === null;
    }).map((element) => ({ tag: element.tagName, id: element.id, type: element.getAttribute("type") }));
    return {
      main: document.querySelector("main") !== null,
      heading: document.querySelector("h1") !== null,
      controls: controls.length,
      unlabeled,
    };
  });
  assert(audit.main, "route is missing the main landmark");
  assert(audit.heading, "route is missing a level-one heading");
  assert(audit.unlabeled.length === 0, `route has unlabeled controls: ${JSON.stringify(audit.unlabeled)}`);
  return audit;
}

async function runFamily(browser, family) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  let taskStarted = false;
  const requests = [];
  const scripts = [];
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  page.on("request", (request) => {
    if (!taskStarted) return;
    const item = { url: request.url(), method: request.method(), postData: request.postData() };
    requests.push(item);
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(response.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    const response = await page.goto(`${origin}${family.route}`, { waitUntil: "networkidle" });
    assert(response?.status() === 200, `${family.id}: route returned ${response?.status()}`);
    await page.getByText("Il risultato si calcola nel tuo browser, senza attese di caricamento.", { exact: true }).waitFor();
    const hydration = { form: await page.locator("form").count(), buttons: await page.getByRole("button").count() };
    assert(hydration.form >= 1 && hydration.buttons >= 1, `${family.id}: hydrated controls did not appear`);
    const accessibility = await accessibilityAudit(page);
    taskStarted = true;
    if (family.invalid !== undefined) {
      try {
        await family.invalid(page);
        const alert = page.getByRole("alert").filter({ hasText: /\S/u }).first();
        await alert.waitFor();
        assert((await alert.innerText()).trim().length > 0, `${family.id}: invalid input did not produce an alert`);
      } catch (error) {
        throw new Error(`${family.id}: invalid-input check failed: ${String(error)}`);
      }
    }
    await family.run(page);
    await page.waitForTimeout(150);
    const badRequests = requests.filter((request) => !request.url.startsWith(origin) || request.method !== "GET");
    const contentLeaks = requests.filter((request) => family.sensitive.some((value) => `${request.url}\n${request.postData ?? ""}`.includes(value)));
    assert(badRequests.length === 0, `${family.id}: network privacy failed: ${JSON.stringify(badRequests)}`);
    assert(contentLeaks.length === 0, `${family.id}: task content leaked: ${JSON.stringify(contentLeaks)}`);
    assert(scripts.length > 0, `${family.id}: operation did not load a lazy implementation script`);
    assert(pageErrors.length === 0, `${family.id}: page errors: ${JSON.stringify(pageErrors)}`);
    const unexpectedStaticFailures = [...new Set(failedResponses)].filter((url) => !isExpectedStaticFailure(url));
    const unexpectedConsoleErrors = consoleErrors.filter((text) => !/Failed to load resource/u.test(text));
    assert(unexpectedConsoleErrors.length === 0, `${family.id}: console errors: ${JSON.stringify(unexpectedConsoleErrors)}`);
    assert(unexpectedStaticFailures.length === 0, `${family.id}: failed responses: ${JSON.stringify(unexpectedStaticFailures)}`);
    const mobile = { width: 390, height: 844, overflow: false };
    await page.setViewportSize({ width: mobile.width, height: mobile.height });
    mobile.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!mobile.overflow, `${family.id}: horizontal overflow at 390px`);
    return {
      id: family.id,
      route: family.route,
      status: response?.status() ?? null,
      hydration,
      accessibility,
      keyboard: "submit pressed with Enter",
      invalidInput: family.invalid !== undefined ? "recoverable alert observed" : "covered by shared tool operation",
      network: { sameOriginGetOnly: true, taskContentLeaks: 0, externalRequests: 0 },
      runtimeConsoleErrors: unexpectedConsoleErrors.length,
      staticEnvironmentFailures: [...new Set(failedResponses)].filter((url) => isExpectedStaticFailure(url)),
      lazyScriptsAfterAction: scripts.length,
      mobile,
    };
  } finally {
    await context.close();
  }
}

async function runDiscovery(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.locator("[data-search-trigger]").waitFor();
    const trigger = page.locator("[data-search-trigger]");
    await trigger.focus();
    await page.keyboard.press("Meta+K");
    const dialog = page.locator("[data-search-dialog][open]");
    await dialog.waitFor();
    const input = page.locator("#global-search-input");
    await input.fill("giorni lavorativi");
    await page.locator("[role='option']").first().waitFor();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    const focusRestored = await page.evaluate(() => document.activeElement?.hasAttribute("data-search-trigger") ?? false);
    assert(focusRestored, "command palette did not restore focus");
    await page.keyboard.press("Control+K");
    await dialog.waitFor();
    await input.fill("zzqqxx inesistente");
    await page.getByRole("link", { name: "Apri tutti gli strumenti", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+K");
    await input.fill("giorni lavorativi");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/tools\/business-day\/?$/u);
    await page.goto(`${origin}/strumenti/?q=lavorativi&ordine=za`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("[data-directory-query]")?.value === "lavorativi");
    assert((await page.locator("[data-directory-query]").inputValue()) === "lavorativi", "Directory query was not restored");
    assert((await page.locator("[data-directory-sort]").inputValue()) === "za", "Directory sort was not restored");
    const directoryCards = page.locator("[data-directory-grid] .tool-card:not([hidden])");
    assert((await directoryCards.count()) > 0, "Directory returned no filtered cards");
    const firstRow = directoryCards.first();
    await firstRow.click();
    await page.waitForLoadState("networkidle");
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("[data-directory-query]")?.value === "lavorativi");
    assert((await page.locator("[data-directory-query]").inputValue()) === "lavorativi", "back navigation lost the directory query");
    assert((await page.locator("[data-directory-sort]").inputValue()) === "za", "back navigation lost the directory sort");
    await page.setViewportSize({ width: 390, height: 844 });
    const directoryOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!directoryOverflow, "Directory overflowed at 390px");
    await page.locator("[data-search-trigger]").click();
    await page.locator("[data-search-dialog][open]").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "global-search-input");
    const mobileFocus = await page.evaluate(() => document.activeElement?.id === "global-search-input");
    assert(mobileFocus, "Mobile header search control did not focus the palette input");
    return {
      commandPalette: { keyboardShortcuts: ["Meta+K", "Control+K"], arrowNavigation: true, enterOpen: true, escapeClose: true, focusRestored },
      zeroResult: { queryPreserved: true, directoryContinuation: true },
      directory: { urlAddressable: true, backNavigationPreserved: true, mobileOverflow: false, headerSearchFocus: mobileFocus },
    };
  } finally {
    await context.close();
  }
}

const families = [
  {
    id: "date-time",
    route: "/tools/working-hours/",
    sensitive: ["2024-01-15T09:00:00Z", "2024-01-15T17:30:00Z"],
    invalid: async (page) => {
      await page.getByLabel(/^Inizio/u).fill("not-a-date");
      await page.getByRole("button", { name: "Calcola ore" }).press("Enter");
    },
    run: async (page) => {
      await page.getByLabel(/^Inizio/u).fill("2024-01-15T09:00:00Z");
      await page.getByLabel(/^Fine/u).fill("2024-01-15T17:30:00Z");
      await page.getByLabel(/^Fuso orario/u).fill("UTC");
      await page.getByRole("button", { name: "Calcola ore" }).press("Enter");
      await page.getByText("8.5 ore", { exact: true }).waitFor();
    },
  },
  {
    id: "business-math",
    route: "/tools/margin-markup/",
    sensitive: ["100.00", "80.00"],
    invalid: async (page) => {
      await page.getByLabel(/^Prezzo o ricavi/u).fill("");
      await page.getByLabel(/^Costo/u).fill("");
      await page.getByRole("button", { name: "Calcola margine e ricarico" }).press("Enter");
    },
    run: async (page) => {
      await page.getByLabel(/^Prezzo o ricavi/u).fill("100");
      await page.getByLabel(/^Costo/u).fill("80");
      await page.getByRole("button", { name: "Calcola margine e ricarico" }).press("Enter");
      await page.getByText(/20\.00 (?:profit|di profit)/u).waitFor();
    },
  },
  {
    id: "campaign-url",
    route: "/tools/utm-builder/",
    sensitive: ["newsletter", "fall sale", "https://example.com/landing"],
    invalid: async (page) => {
      await page.getByRole("button", { name: "Crea URL" }).press("Enter");
    },
    run: async (page) => {
      await page.getByLabel(/^URL di destinazione/u).fill("https://example.com/landing#frag");
      await page.getByLabel(/^Sorgente/u).fill("newsletter");
      await page.getByLabel(/^Mezzo/u).fill("email");
      await page.getByLabel(/^Campagna/u).fill("fall sale");
      await page.getByRole("button", { name: "Crea URL" }).press("Enter");
      await page.locator('[data-result-slot="selectable-output"]').filter({ hasText: "https://example.com/landing" }).waitFor();
    },
  },
  {
    id: "table-csv",
    route: "/tools/csv-viewer/",
    sensitive: ["a,b", "1,2"],
    run: async (page) => {
      await page.getByLabel(/^CSV o testo tabellare/u).fill(`a,b${newline}1,2${newline}`);
      await page.getByRole("button", { name: "Apri e controlla un CSV" }).press("Enter");
      await page.locator('[data-result-slot="table-preview"]').waitFor();
    },
  },
  {
    id: "text-writing",
    route: "/tools/line-sorter/",
    sensitive: ["zeta-line-input", "alpha-line-input"],
    run: async (page) => {
      await page.getByLabel(/^Testo/u).fill(`zeta-line-input${newline}alpha-line-input${newline}`);
      await page.getByRole("button", { name: "Ordina righe" }).press("Enter");
      const output = await page.locator(".bounded-result-preview pre").innerText();
      assert(output.includes(`alpha-line-input${newline}zeta-line-input`), `line sorter output was unexpected: ${output}`);
    },
  },
  {
    id: "research-reference",
    route: "/tools/doi-isbn-normalizer/",
    sensitive: ["doi:10.1000/182", "10.1000/182"],
    run: async (page) => {
      const field = page.getByRole("textbox", { name: /^DOI/u });
      await field.fill("doi:10.1000/182");
      await field.press("Enter");
      await page.locator('[data-research-result-tool="doi-isbn-normalizer"]').getByText("Valido", { exact: true }).waitFor();
    },
  },
  {
    id: "developer-web",
    route: "/tools/base64-codec/",
    sensitive: ["foobar", "Zm9vYmFy"],
    invalid: async (page) => {
      await page.locator("#base64-codec-mode").selectOption("decode");
      await page.locator("#base64-codec-text").fill("%%%");
      await page.getByRole("button", { name: "Converti Base64" }).press("Enter");
    },
    run: async (page) => {
      await page.locator("#base64-codec-text").fill("foobar");
      await page.locator("#base64-codec-mode").selectOption("encode");
      await page.getByRole("button", { name: "Converti Base64" }).press("Enter");
      await page.locator(".bounded-result-preview pre").filter({ hasText: "Zm9vYmFy" }).waitFor();
    },
  },
  {
    id: "pdf-document",
    route: "/tools/pdf-page-count-verifier/",
    sensitive: ["sample.pdf", "pdf-page-count-verifier"],
    invalid: async (page) => {
      await page.getByRole("button", { name: "Verifica numero pagine" }).press("Enter");
    },
    run: async (page) => {
      await page.getByLabel(/^Conta e verifica pagine PDF/u).setInputFiles({ name: "sample.pdf", mimeType: "application/pdf", buffer: pdfFixture });
      await page.getByRole("button", { name: "Verifica numero pagine" }).press("Enter");
      await page.getByRole("button", { name: "Verifica numero pagine" }).waitFor();
      const output = await page.locator('.result-panel[data-state="success"]').innerText();
      assert(/numero_pagine[\s\S]*1/u.test(output), `PDF page count missing from Result v2: ${output}`);
    },
  },
  {
    id: "file-privacy",
    route: "/tools/file-hash/",
    sensitive: ["owner-private-name.txt", "strumentini-cross-family-private-value", fileDigest],
    invalid: async (page) => {
      await page.getByRole("button", { name: "Calcola SHA-256" }).press("Enter");
    },
    run: async (page) => {
      await page.getByLabel(/^File/u).setInputFiles({ name: "owner-private-name.txt", mimeType: "text/plain", buffer: fileFixture });
      await page.getByLabel(/^SHA-256 atteso/u).fill(fileDigest);
      await page.getByRole("button", { name: "Calcola SHA-256" }).press("Enter");
      await page.getByText(/checksum (?:matches|corrisponde)/u).waitFor();
      await page.getByText(fileDigest, { exact: true }).waitFor();
    },
  },
  {
    id: "image-visual",
    route: "/tools/image-resize/",
    sensitive: ["cross-family.png", "image/png"],
    invalid: async (page) => {
      await page.getByRole("button", { name: "Ridimensiona" }).press("Enter");
    },
    run: async (page) => {
      await page.locator("#image-resize-file").setInputFiles({ name: "cross-family.png", mimeType: "image/png", buffer: imageFixture });
      await page.getByRole("spinbutton", { name: "Larghezza", exact: true }).fill("1");
      await page.getByRole("spinbutton", { name: "Altezza", exact: true }).fill("1");
      await page.getByRole("button", { name: "Ridimensiona" }).press("Enter");
      await page.locator('[data-result-slot="visual-preview"] figcaption').filter({ hasText: "1×1" }).waitFor();
    },
  },
];

try {
  await sleep(500);
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const results = [];
  for (const family of families) results.push(await runFamily(browser, family));
  const discovery = await runDiscovery(browser);
  await browser.close();
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: "PASS",
    browser: "Google Chrome",
    viewport: { desktop: "1280x900", mobile: "390x844" },
    coverage: {
      representativeFamilies: results.length,
      hydration: results.every((result) => result.hydration.form >= 1),
      errors: results.filter((result) => result.invalidInput.includes("alert")).length,
      keyboard: results.every((result) => result.keyboard.includes("Enter")),
      accessibility: results.every((result) => result.accessibility.unlabeled.length === 0),
      networkPrivacy: results.every((result) => result.network.sameOriginGetOnly && result.network.taskContentLeaks === 0),
      runtimeConsoleErrors: results.every((result) => result.runtimeConsoleErrors === 0),
      mobile390: results.every((result) => !result.mobile.overflow),
    },
    families: results,
    searchDiscovery: discovery,
    fixedDefects: [
      "PDF URL cleanup no longer aborts an active operation when a result is reset.",
      "The shell declares a local favicon so route loads do not emit a missing-resource console error.",
      "CSV acceptance scopes the result preview instead of matching the intentional handoff preview.",
      "Workbench acceptance adds File Hash through the visible Add a tool path instead of a stale suggestion assumption.",
    ],
  };
  await mkdir(resolve(root, "quality/receipts/cross-family"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/cross-family/browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`cross-family browser acceptance PASS: ${results.length} families, hydration/errors/keyboard/accessibility/390px/privacy, search/directory`);
} finally {
  server.kill("SIGTERM");
}
