import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const port = 18124;
const origin = "http://127.0.0.1:" + port;
const server = spawn(
  "python3",
  ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitReady(page) {
  await page.locator('[data-ready="true"]').waitFor();
}

async function waitSaved(page) {
  await page.locator('[data-saving="false"]').waitFor();
}

async function installedIds(page) {
  return page.locator("[data-tool-id]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-tool-id")),
  );
}

async function readStoredState(page) {
  return page.evaluate(async () => {
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
    return state;
  });
}

try {
  await sleep(400);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1280, height: 900 } });
  const response = await page.goto(origin + "/", { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error("Workbench route did not return 200");
  await waitReady(page);

  await page.locator("#your-tools-title").waitFor();
  if (await page.getByText("DOI / ISBN Normalizer", { exact: true }).count()) {
    throw new Error("Full catalog rendered before user requested add-tool choices");
  }

  const addTool = page.getByRole("button", { name: "Aggiungi uno strumento" });
  await addTool.focus();
  await page.keyboard.press("Enter");
  await page.getByText("DOI / ISBN Normalizer", { exact: true }).waitFor();

  const doiRow = page.locator("li").filter({ hasText: "DOI / ISBN Normalizer" });
  const doiAdd = doiRow.getByRole("button", { name: "Aggiungi" });
  await doiAdd.focus();
  await page.keyboard.press("Enter");

  const addToolsToggle = page.locator("[aria-controls='available-tools']");
  if ((await addToolsToggle.getAttribute("aria-expanded")) !== "true") await addToolsToggle.click();
  const fileHashChoice = page.locator("#available-tools li").filter({ hasText: "File Hash / Checksum Verifier" });
  await fileHashChoice.getByRole("button", { name: "Aggiungi" }).click();

  let ids = await installedIds(page);
  if (!ids.includes("business-day") || !ids.includes("doi-isbn-normalizer") || !ids.includes("file-hash")) {
    throw new Error("Add-tool behavior did not update installed state");
  }

  await page.getByLabel("Gestisci File Hash / Checksum Verifier").click();
  const moveHashUp = page.getByRole("button", { name: "Sposta File Hash / Checksum Verifier in alto" });
  await moveHashUp.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Sposta File Hash / Checksum Verifier in alto" }).focus();
  await page.keyboard.press("Enter");
  await waitSaved(page);
  ids = await installedIds(page);
  if (ids[0] !== "file-hash") throw new Error("Manual reorder did not move File Hash to the first slot");

  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  ids = await installedIds(page);
  if (ids[0] !== "file-hash" || ids.length < 3) {
    throw new Error("Installed order did not survive reload through IndexedDB");
  }

  await page.getByLabel("Valuta").fill("EUR");
  await page.getByLabel("Dom").check();
  await page.getByRole("button", { name: "Salva il Profilo di lavoro" }).click();
  await waitSaved(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  if ((await page.getByLabel("Valuta").inputValue()) !== "EUR") {
    throw new Error("Work Profile edit did not persist");
  }
  if (!(await page.getByLabel("Dom").isChecked())) {
    throw new Error("Work Profile workweek did not persist");
  }
  const businessProfileProvenance = page.locator('[data-tool-id="business-day"] small', { hasText: "dal Profilo di lavoro" });
  await businessProfileProvenance.waitFor();
  if (!(await businessProfileProvenance.innerText()).includes("SUN")) {
    throw new Error("Saved Work Profile value is not visible at the tool use site");
  }

  const businessRow = page.locator('[data-tool-id="business-day"]');
  await businessRow.getByRole("link", { name: "Apri" }).click();
  await page.getByText("Work Profile default", { exact: true }).waitFor();
  await page.getByLabel("Sat").check();
  await page.getByText("Current task override", { exact: true }).waitFor();

  await page.goto(origin + "/", { waitUntil: "networkidle" });
  await waitReady(page);
  await page.locator("#recent").getByText("Business Day Calculator", { exact: true }).waitFor();

  const stored = await readStoredState(page);
  const storedJson = JSON.stringify(stored);
  if (/startDate|endDate|excludedDates|input|output|https?:\/\//u.test(storedJson)) {
    throw new Error("Stored Workbench state contains task content");
  }
  const recent = stored?.recent?.[0];
  if (!recent || Object.keys(recent).sort().join(",") !== "lastUsedAt,toolId,useCount") {
    throw new Error("Recent contains fields beyond tool-level activity metadata");
  }

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta la configurazione" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Config export did not produce a downloadable artifact");
  const exported = JSON.parse(await readFile(path, "utf8"));
  const exportKeys = Object.keys(exported).sort().join(",");
  if (exportKeys !== "installedTools,kind,layout,packs,preferences,profile,version") {
    throw new Error("Export contains unexpected fields: " + exportKeys);
  }
  if ("recent" in exported || /startDate|endDate|excludedDates|input|output/u.test(JSON.stringify(exported))) {
    throw new Error("Export leaked Recent or task content");
  }

  const beforeInvalid = await installedIds(page);
  await page.getByLabel("Scegli la configurazione da importare").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not-json"),
  });
  await page.getByRole("alert").getByText("Importazione non applicata.").waitFor();
  const afterInvalid = await installedIds(page);
  if (JSON.stringify(beforeInvalid) !== JSON.stringify(afterInvalid)) {
    throw new Error("Malformed import mutated Workbench state");
  }

  const validConfig = {
    kind: "utility-workbench-config",
    version: 1,
    installedTools: ["business-day", "doi-isbn-normalizer"],
    packs: [],
    layout: { mode: "list" },
    profile: {
      locale: "it-IT",
      timezone: "Europe/Rome",
      currency: "GBP",
      dateFormat: "day-first",
      numberFormat: "decimal-comma",
      workweek: ["MON", "TUE", "WED", "THU", "FRI"],
      preferredUnits: "metric",
    },
    preferences: { compactRows: true },
  };
  await page.getByLabel("Scegli la configurazione da importare").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(validConfig)),
  });
  await page.getByText("Anteprima importazione", { exact: true }).waitFor();
  if (JSON.stringify(await installedIds(page)) !== JSON.stringify(beforeInvalid)) {
    throw new Error("Validated import mutated state before explicit apply");
  }
  await page.getByRole("button", { name: "Applica l'importazione" }).click();
  await waitSaved(page);
  if (JSON.stringify(await installedIds(page)) !== JSON.stringify(validConfig.installedTools)) {
    throw new Error("Validated import did not apply atomically");
  }
  if ((await page.getByLabel("Valuta").inputValue()) !== "GBP") {
    throw new Error("Imported Work Profile was not applied");
  }

  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  if (JSON.stringify(await installedIds(page)) !== JSON.stringify(validConfig.installedTools)) {
    throw new Error("Imported configuration did not persist across reload");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  if (overflow) throw new Error("390px Workbench has horizontal overflow");
  const buttonHeights = await page.locator("button:visible").evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  if (buttonHeights.some((height) => height < 44)) {
    throw new Error("Visible Workbench button below 44px touch target");
  }
  await page.locator("[data-shell-mobile-nav]").waitFor();

  await context.close();

  const deniedContext = await browser.newContext();
  await deniedContext.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open() {
          throw new DOMException("Storage denied", "SecurityError");
        },
      },
    });
  });
  const deniedPage = await deniedContext.newPage({ viewport: { width: 390, height: 844 } });
  await deniedPage.goto(origin + "/", { waitUntil: "networkidle" });
  await waitReady(deniedPage);
  await deniedPage.getByRole("status", { name: "Storage warning" }).waitFor();
  const deniedBusinessRow = deniedPage.locator('[data-tool-id="business-day"]');
  await deniedPage.getByLabel("Gestisci Business Day Calculator").click();
  await deniedBusinessRow.getByRole("button", { name: "Rimuovi" }).focus();
  await deniedPage.keyboard.press("Enter");
  await deniedPage.getByText("Nessuno strumento installato.", { exact: true }).waitFor();
  await deniedPage.getByRole("status", { name: "Storage warning" }).waitFor();
  await deniedContext.close();

  await browser.close();
  console.log("workbench acceptance PASS: IndexedDB reload, add/remove/reorder, Recent privacy, profile provenance/override, config export/import, storage denial, keyboard, 390px");
} finally {
  server.kill("SIGTERM");
}
