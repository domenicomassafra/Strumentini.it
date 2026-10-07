import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18137;
const externalOrigin = process.env.BROWSER_DIAGNOSTICS_ORIGIN?.replace(/\/$/u, "") ?? null;
const origin = externalOrigin ?? `http://127.0.0.1:${port}`;
const server = externalOrigin === null
  ? spawn(
    "python3",
    ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
    { cwd: root, stdio: "ignore" },
  )
  : null;
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function isExternal(url) {
  return !url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:");
}

try {
  if (server !== null) await sleep(500);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  const connectionPage = await context.newPage();
  const connectionRequests = [];
  connectionPage.on("request", (request) => {
    if (isExternal(request.url())) connectionRequests.push({ url: request.url(), method: request.method() });
  });
  let ipCalls = 0;
  await connectionPage.route("https://api64.ipify.org/**", async (route) => {
    ipCalls += 1;
    if (ipCalls === 1) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ip: "203.0.113.42" }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "mock failure" }) });
  });
  const connectionResponse = await connectionPage.goto(`${origin}/tools/connection-device-info/`, { waitUntil: "networkidle" });
  if (connectionResponse?.status() !== 200) throw new Error(`connection/device route returned ${connectionResponse?.status()}`);
  await connectionPage.getByRole("heading", { name: "Informazioni browser e dispositivo", exact: true }).waitFor();
  await connectionPage.getByText(/Nessuna ricerca IP parte automaticamente/u).waitFor();
  await connectionPage.getByText(/Viewport CSS/u).waitFor();
  const expectedLocalFacts = await connectionPage.evaluate(() => ({
    userAgent: navigator.userAgent,
    locale: navigator.language,
    screen: `${window.screen.width}×${window.screen.height}`,
    viewport: `${Math.round(window.visualViewport?.width ?? window.innerWidth)}×${Math.round(window.visualViewport?.height ?? window.innerHeight)}`,
    dpr: String(window.devicePixelRatio || 1),
  }));
  await connectionPage.getByText(expectedLocalFacts.userAgent, { exact: true }).first().waitFor();
  await connectionPage.getByText(expectedLocalFacts.locale, { exact: true }).first().waitFor();
  await connectionPage.getByText(expectedLocalFacts.screen, { exact: true }).first().waitFor();
  await connectionPage.getByText(expectedLocalFacts.viewport, { exact: true }).first().waitFor();
  await connectionPage.getByText(expectedLocalFacts.dpr, { exact: true }).first().waitFor();
  if (connectionRequests.length !== 0) {
    throw new Error(`connection/device made an implicit external request: ${JSON.stringify(connectionRequests)}`);
  }

  await connectionPage.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__browserDiagnosticsCopied = String(value);
        },
      },
    });
  });
  await connectionPage.getByRole("button", { name: "Copia riepilogo di supporto" }).click();
  const copied = await connectionPage.evaluate(() => window.__browserDiagnosticsCopied ?? "");
  if (!copied.includes("non sono un fingerprint") || copied.includes("203.0.113.42")) {
    throw new Error(`copy-all privacy contract failed: ${copied}`);
  }

  await connectionPage.getByRole("button", { name: "Trova IP pubblico (rete)" }).click();
  await connectionPage.getByText("203.0.113.42", { exact: true }).waitFor();
  if (ipCalls !== 1 || connectionRequests.length !== 1) {
    throw new Error(`public-IP explicit network action mismatch: calls=${ipCalls} requests=${JSON.stringify(connectionRequests)}`);
  }
  await connectionPage.getByRole("button", { name: "Trova IP pubblico (rete)" }).click();
  await connectionPage.getByRole("alert").filter({ hasText: /Non riesco a recuperare l'IP pubblico/u }).waitFor();
  if (ipCalls !== 2) throw new Error(`expected mocked public-IP retry failure, got ${ipCalls} call(s)`);

  const keyboardPage = await context.newPage();
  const keyboardRequests = [];
  keyboardPage.on("request", (request) => {
    if (isExternal(request.url())) keyboardRequests.push({ url: request.url(), method: request.method() });
  });
  const keyboardResponse = await keyboardPage.goto(`${origin}/tools/keyboard-event-diagnostic/`, { waitUntil: "networkidle" });
  if (keyboardResponse?.status() !== 200) throw new Error(`keyboard diagnostic route returned ${keyboardResponse?.status()}`);
  await keyboardPage.getByRole("heading", { name: "Diagnostica eventi tastiera", exact: true }).waitFor();
  const storageBefore = await keyboardPage.evaluate(() => ({
    local: Object.fromEntries(Object.keys(localStorage).toSorted().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).toSorted().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  const surface = keyboardPage.getByRole("region", { name: "Area di prova eventi tastiera" });
  await keyboardPage.getByRole("button", { name: "Avvia test" }).click();
  await surface.waitFor();
  await keyboardPage.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Area di prova eventi tastiera");

  await surface.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", {
      key: "K",
      code: "KeyK",
      location: 1,
      shiftKey: true,
      repeat: true,
      isComposing: true,
      bubbles: true,
      cancelable: true,
    }));
  });
  await keyboardPage.getByText("KeyK", { exact: true }).first().waitFor();
  await keyboardPage.getByText("Shift", { exact: true }).first().waitFor();
  await keyboardPage.getByText("sì", { exact: true }).first().waitFor();

  const shortcutPrevented = await surface.evaluate((element) => {
    const event = new KeyboardEvent("keydown", {
      key: "l",
      code: "KeyL",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  if (shortcutPrevented) throw new Error("keyboard diagnostic prevented a browser/system shortcut event");

  await surface.focus();
  await keyboardPage.keyboard.press("Tab");
  if (await surface.getAttribute("data-active") !== "false") throw new Error("Tab did not leave/deactivate the keyboard test surface");

  await keyboardPage.getByRole("button", { name: "Avvia test" }).click();
  for (let index = 0; index < 15; index += 1) {
    await surface.evaluate((element, value) => {
      element.dispatchEvent(new KeyboardEvent("keydown", {
        key: String(value),
        code: `Digit${value}`,
        bubbles: true,
      }));
    }, index);
  }
  await keyboardPage.getByText("Cronologia recente (12/12)", { exact: true }).waitFor();
  const historyRows = await keyboardPage.locator(".keyboard-history tbody tr").count();
  if (historyRows !== 12) throw new Error(`keyboard history is not bounded to 12 rows: ${historyRows}`);
  const storageAfter = await keyboardPage.evaluate(() => ({
    local: Object.fromEntries(Object.keys(localStorage).toSorted().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).toSorted().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  if (JSON.stringify(storageAfter) !== JSON.stringify(storageBefore)) {
    throw new Error(`keyboard diagnostic changed browser storage: before=${JSON.stringify(storageBefore)} after=${JSON.stringify(storageAfter)}`);
  }
  if (keyboardRequests.length !== 0) throw new Error(`keyboard diagnostic made external requests: ${JSON.stringify(keyboardRequests)}`);
  await keyboardPage.getByRole("button", { name: "Cancella cronologia" }).click();
  await keyboardPage.getByText("Cronologia recente (0/12)", { exact: true }).waitFor();

  await connectionPage.setViewportSize({ width: 390, height: 844 });
  const connectionOverflow = await connectionPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await keyboardPage.setViewportSize({ width: 390, height: 844 });
  const keyboardOverflow = await keyboardPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (connectionOverflow || keyboardOverflow) throw new Error("browser diagnostics has horizontal overflow at 390px");

  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tools: {
      connectionDeviceInfo: {
        route: "/tools/connection-device-info/",
        localFactsWithoutExternalRequests: "PASS",
        publicIpDisclosureBeforeAction: "PASS",
        publicIpMockSuccess: "PASS",
        publicIpMockFailure: "PASS",
        copiedSummaryExcludesPublicIp: "PASS",
        fingerprintUniquenessNotClaimed: "PASS",
      },
      keyboardEventDiagnostic: {
        route: "/tools/keyboard-event-diagnostic/",
        focusedCapture: "PASS",
        keyCodeModifiersRepeatComposition: "PASS",
        boundedHistory12: "PASS",
        tabFocusExit: "PASS",
        shortcutEventNotPrevented: "PASS",
        storageUnchanged: "PASS",
        externalRequests: 0,
      },
    },
    mobile390: { connectionOverflow: false, keyboardOverflow: false },
  };
  await mkdir(resolve(root, "quality/receipts/browser-diagnostics"), { recursive: true });
  await writeFile(
    resolve(root, "quality/receipts/browser-diagnostics/acceptance.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8",
  );
  await browser.close();
  console.log("browser diagnostics acceptance PASS: local facts/no implicit network + explicit mocked IP + bounded non-trapping keyboard inspector");
} finally {
  server?.kill("SIGTERM");
}
