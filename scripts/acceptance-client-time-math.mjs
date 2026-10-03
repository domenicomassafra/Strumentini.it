import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18138;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "0.0.0.0", "--directory", "dist"], {
  stdio: "ignore",
});
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function localNetworkIpv4() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return undefined;
}

async function acceptRoute(context, route, sensitiveValues, operate) {
  const page = await context.newPage();
  let started = false;
  const requests = [];
  page.on("request", (request) => {
    if (started) requests.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });
  const response = await page.goto(`${origin}${route}/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`${route}: HTTP ${response?.status()}`);
  await page.locator('[data-tool-page][data-runtime="LOCAL"]').waitFor();
  await operate(page, () => { started = true; });
  await page.waitForTimeout(100);
  if (requests.some((request) => {
    const body = `${request.url}\n${request.postData ?? ""}`;
    return !request.url.startsWith(origin) || request.method !== "GET" || sensitiveValues.some((value) => value !== "" && body.includes(value));
  })) {
    throw new Error(`${route}: external or task-content request observed`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) {
    throw new Error(`${route}: mobile horizontal overflow`);
  }
  await page.close();
}

try {
  await sleep(500);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // The work profile editor no longer lives on the home route: it is the settings
  // page's Preferenze panel, and that panel is only un-hidden once the settings
  // script has run — so this wait still proves the editor is live, not just served.
  const setup = await context.newPage();
  await setup.goto(`${origin}/impostazioni/#preferenze`, { waitUntil: "networkidle" });
  await setup.locator('[data-settings-panel="preferenze"]').waitFor();
  await setup.getByLabel("Fuso orario").fill("Europe/Rome");
  await setup.getByLabel("Valuta").fill("EUR");
  await setup.getByRole("button", { name: "Salva le preferenze" }).click();
  await setup.getByText("Preferenze salvate su questo dispositivo.", { exact: true }).waitFor();
  await setup.waitForFunction(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("utility-workbench", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction("state", "readonly");
    const state = await new Promise((resolve, reject) => {
      const request = transaction.objectStore("state").get("workbench/state:v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return state?.profile?.timezone === "Europe/Rome" && state?.profile?.currency === "EUR";
  });
  await setup.close();

  await acceptRoute(context, "/tools/timezone-overlap", ["Europe/Rome", "America/New_York"], async (page, start) => {
    await page.getByText(/^(?:Work Profile default|Valore predefinito dal profilo)$/u, { exact: true }).waitFor();
    const homeTimezone = page.locator("label").filter({ hasText: /^Il tuo fuso orario/u }).locator("input").first();
    if ((await homeTimezone.inputValue()) !== "Europe/Rome") {
      throw new Error("Timezone tool did not receive saved Work Profile timezone");
    }
    await page.getByLabel("Data nel tuo fuso orario", { exact: true }).fill("2026-09-23");
    start();
    await page.getByRole("button", { name: "Trova la sovrapposizione" }).press("Enter");
    await page.getByText("1 finestra condivisa", { exact: true }).waitFor();
  });

  await acceptRoute(context, "/tools/rate-converter", ["50.00"], async (page, start) => {
    await page.getByText(/Valore predefinito dal profilo · solo etichetta/u).waitFor();
    if ((await page.getByLabel("Valuta").inputValue()) !== "EUR") {
      throw new Error("Rate tool did not receive saved Work Profile currency");
    }
    await page.getByLabel("Importo della tariffa").fill("50.00");
    start();
    await page.getByRole("button", {name:"Converti tariffa"}).press("Enter");
    await page.getByText("EUR 400.00 / giorno", { exact: true }).waitFor();
  });

  await acceptRoute(context, "/tools/margin-markup", ["100.00", "80.00"], async (page, start) => {
    await page.getByText(/^(?:Work Profile default|Valore predefinito dal profilo)$/u, { exact: true }).waitFor();
    if ((await page.getByLabel("Valuta").inputValue()) !== "EUR") {
      throw new Error("Margin tool did not receive saved Work Profile currency");
    }
    await page.getByLabel("Prezzo o ricavi").fill("100.00");
    await page.getByLabel("Costo").fill("80.00");
    start();
    await page.getByRole("button", {name:"Calcola margine e ricarico"}).press("Enter");
    await page.getByText("EUR 20.00 di profitto", { exact: true }).waitFor();
    await page.getByText(/20.00% · profitto ÷ prezzo/u).waitFor();
    await page.getByText(/25.00% · profitto ÷ costo/u).waitFor();
  });

  const lanAddress = localNetworkIpv4();
  if (lanAddress === undefined) throw new Error("No non-loopback IPv4 interface available for local-network acceptance");
  const lanResponse = await fetch(`http://${lanAddress}:${port}/tools/timezone-overlap/`); await lanResponse.arrayBuffer();
  if (lanResponse.status !== 200) throw new Error(`Local-network route returned HTTP ${lanResponse.status}`);

  await context.close();
  await browser.close();
  await mkdir(resolve(root, "quality/receipts/client-time-math"), { recursive: true });
  await writeFile(
    resolve(root, "quality/receipts/client-time-math/browser-acceptance.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      status: "PASS",
      workProfile: { timezone: "Europe/Rome", currency: "EUR", reusedAcross: ["timezone-overlap", "rate-converter", "margin-markup"] },
      keyboard: "submit actions exercised with Enter",
      mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
      network: "zero external/task-content requests after task start",
      localNetwork: { serverBind: "0.0.0.0", nonLoopbackRouteReachable: true },
    }, null, 2)}\n`,
  );
  console.log("client/time/math browser acceptance PASS: Work Profile reuse, keyboard/mobile, locality, local-network route");
} finally {
  server.kill("SIGTERM");
}
