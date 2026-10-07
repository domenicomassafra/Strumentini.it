import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
const receiptPath = resolve(root, "quality/receipts/result-v2/privacy-network.json");
const tempRoot = await mkdtemp(join(tmpdir(), "strumentini-result-network-"));
const fixtureEntry = resolve(root, "scripts/fixtures/result-network-provenance-fixture.tsx");
const port = 18720 + (process.pid % 100);
const origin = "http://127.0.0.1:" + String(port);

await build({
  logLevel: "error",
  build: {
    outDir: tempRoot,
    emptyOutDir: true,
    lib: {
      entry: fixtureEntry,
      name: "ResultNetworkFixture",
      formats: ["iife"],
      fileName: () => "fixture.js",
    },
    minify: false,
  },
});
const fixtureScript = await readFile(resolve(tempRoot, "fixture.js"), "utf8");
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", resolve(root, "dist")], {
  cwd: root,
  stdio: "ignore",
});
const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(100);
  }
  throw new Error("privacy/network acceptance server did not start");
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const localPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let taskStarted = false;
    const localTaskRequests: Array<{ url: string; method: string; postData: string | null }> = [];
    localPage.on("request", (request) => {
      if (!taskStarted) return;
      localTaskRequests.push({ url: request.url(), method: request.method(), postData: request.postData() });
    });
    await localPage.goto(origin + "/tools/business-day/", { waitUntil: "networkidle" });
    await localPage.getByLabel(/^Data iniziale/u).fill("2026-09-18");
    await localPage.getByLabel(/^Giorni lavorativi da aggiungere/u).fill("1");
    taskStarted = true;
    await localPage.getByRole("button", { name: "Calcola", exact: true }).click();
    await localPage.getByText("2026-09-21", { exact: true }).waitFor();
    const localNetworkText = JSON.stringify(localTaskRequests);
    const localLeak = ["2026-09-18", "2026-09-21", "startDate", "businessDays"].some((secret) => localNetworkText.includes(secret));
    const localBadRequests = localTaskRequests.filter((request) =>
      !request.url.startsWith(origin) || request.method !== "GET" || (request.postData ?? "") !== "",
    );
    if (localLeak || localBadRequests.length > 0) {
      throw new Error("LOCAL task emitted a content-bearing or external request");
    }
    await localPage.close();

    const referencePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const referenceRequests: string[] = [];
    await referencePage.route("**/__result-v2-reference-fixture?*", async (route) => {
      referenceRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ valid: true }),
      });
    });
    await referencePage.goto(origin, { waitUntil: "domcontentloaded" });
    await referencePage.setContent('<!doctype html><html lang="it"><body><div id="app"></div></body></html>');
    await referencePage.addScriptTag({ content: fixtureScript });
    await referencePage.locator("[data-reference-before-action]").waitFor();
    if (referenceRequests.length !== 0) throw new Error("REFERENCE fixture used the network before explicit action");
    await referencePage.getByRole("button", { name: "Simula errore locale" }).click();
    await referencePage.locator("[data-local-invalid]").waitFor();
    if (referenceRequests.length !== 0) throw new Error("Local invalid state caused a reference-network request");
    await referencePage.getByRole("button", { name: "Verifica fonte remota" }).click();
    await referencePage.getByText(/Valido secondo la fonte remota/u).waitFor();
    await referencePage.getByText("Fonte consultata in rete", { exact: true }).waitFor();
    await referencePage.getByText("Verifica remota autorevole", { exact: true }).waitFor();
    const referenceCountAfterAction = referenceRequests.slice().length;
    if (referenceCountAfterAction !== 1 || !referenceRequests[0]?.includes("reference-key-123")) {
      throw new Error("REFERENCE fixture did not perform exactly one declared lookup after action");
    }
    await referencePage.close();

    const deniedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await deniedPage.route("**/__result-v2-reference-fixture?*", (route) => route.abort());
    await deniedPage.goto(origin, { waitUntil: "domcontentloaded" });
    await deniedPage.setContent('<!doctype html><html lang="it"><body><div id="app"></div></body></html>');
    await deniedPage.addScriptTag({ content: fixtureScript });
    await deniedPage.getByRole("button", { name: "Verifica fonte remota" }).click();
    await deniedPage.getByText(/Fonte non disponibile/u).waitFor();
    await deniedPage.getByText("Rete non disponibile", { exact: true }).waitFor();
    if (await deniedPage.getByText(/Non valido secondo la fonte remota/u).count() !== 0) {
      throw new Error("Network denial was incorrectly presented as a remote-invalid verdict");
    }
    await deniedPage.close();

    const receipt = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      providerMutation: false,
      evidenceMode: "same-origin browser interception plus denied fixture; no provider endpoint is contacted",
      local: {
        route: "/tools/business-day/",
        taskRequests: localTaskRequests.length,
        contentLeaks: 0,
        externalOrNonGetRequests: 0,
        requests: localTaskRequests.map((request) => ({
          path: new URL(request.url).pathname,
          method: request.method,
          hasBody: (request.postData ?? "") !== "",
        })),
      },
      referenceFixture: {
        explicitBeforeAction: true,
        requestsBeforeAction: 0,
        requestsAfterAction: referenceCountAfterAction,
        requests: referenceRequests.map((url) => {
          const parsed = new URL(url);
          return { path: parsed.pathname, queryKeys: [...parsed.searchParams.keys()].sort() };
        }),
        provenance: "remote-valid / network-used / remote-authoritative",
      },
      deniedFixture: {
        provenance: "unavailable / network-denied / none",
        remoteInvalidClaimed: false,
      },
      status: "PASS",
    };
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
    console.log("result-v2 privacy/network acceptance PASS: LOCAL zero leak + explicit reference + denied unavailable");
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
  await rm(tempRoot, { recursive: true, force: true });
}
