import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.STRUMENTINI_MIC_ACCEPTANCE_PORT ?? 18183);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`invalid acceptance port: ${String(port)}`);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  "python3",
  ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"],
  { cwd: root, stdio: "ignore" },
);
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function isExternal(url) {
  return !url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:");
}

const installSupportedMocks = () => {
  window.__micMode = "deny";
  window.__gumCalls = 0;
  window.__mimeChecks = [];
  window.__trackStops = 0;
  window.__createdObjectUrls = 0;
  window.__revokedObjectUrls = 0;

  const mediaDevices = navigator.mediaDevices;
  const mediaDevicesPrototype = mediaDevices === undefined ? null : Object.getPrototypeOf(mediaDevices);
  if (mediaDevicesPrototype !== null) {
    Object.defineProperty(mediaDevicesPrototype, "getUserMedia", {
      configurable: true,
      value: async () => {
        window.__gumCalls += 1;
        if (window.__micMode === "deny") throw new DOMException("denied", "NotAllowedError");
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const destination = context.createMediaStreamDestination();
        oscillator.frequency.value = 440;
        oscillator.connect(destination);
        oscillator.start();
        const track = destination.stream.getAudioTracks()[0];
        const originalStop = track.stop.bind(track);
        track.stop = () => {
          window.__trackStops += 1;
          originalStop();
        };
        window.__lastTrack = track;
        window.__lastCaptureContext = context;
        return destination.stream;
      },
    });
  }

  const originalIsTypeSupported = MediaRecorder.isTypeSupported.bind(MediaRecorder);
  Object.defineProperty(MediaRecorder, "isTypeSupported", {
    configurable: true,
    value: (mimeType) => {
      window.__mimeChecks.push(mimeType);
      return mimeType === "audio/webm" && originalIsTypeSupported(mimeType);
    },
  });

  const createObjectURL = URL.createObjectURL.bind(URL);
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    window.__createdObjectUrls += 1;
    return createObjectURL(blob);
  };
  URL.revokeObjectURL = (url) => {
    window.__revokedObjectUrls += 1;
    revokeObjectURL(url);
  };
};

try {
  await sleep(500);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(installSupportedMocks);
  const externalRequests = [];
  await context.route("**/*", async (route) => {
    if (isExternal(route.request().url())) {
      externalRequests.push(route.request().url());
      await route.abort();
      return;
    }
    await route.continue();
  });

  const page = await context.newPage();
  const response = await page.goto(`${origin}/tools/microphone-recorder/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`microphone recorder route returned ${response?.status()}`);
  await page.locator("[data-microphone-recorder]").waitFor();
  const supportSnapshot = await page.evaluate(() => ({
    secureContext: window.isSecureContext,
    mediaDevices: typeof navigator.mediaDevices,
    getUserMedia: typeof navigator.mediaDevices?.getUserMedia,
    mediaRecorder: typeof MediaRecorder,
    buttonDisabled: document.querySelector("[data-microphone-recorder] button")?.disabled ?? null,
    islandHydrated: document.querySelector("astro-island")?.hasAttribute("ssr") === false,
  }));
  if (supportSnapshot.buttonDisabled !== false) {
    throw new Error(`microphone recorder client support did not hydrate: ${JSON.stringify(supportSnapshot)}`);
  }
  if (await page.evaluate(() => window.__gumCalls) !== 0) throw new Error("getUserMedia ran before explicit user action");

  await page.getByRole("button", { name: "Attiva microfono", exact: true }).click();
  await page.getByText(/Accesso al microfono negato o revocato/u).waitFor();
  if (await page.evaluate(() => window.__gumCalls) !== 1) throw new Error("permission denial did not use exactly one explicit getUserMedia call");

  await page.evaluate(() => { window.__micMode = "allow"; });
  await page.getByRole("button", { name: "Riprova microfono", exact: true }).click();
  const healthRegion = page.getByRole("region", { name: "Stato microfono" });
  await healthRegion.waitFor();
  await healthRegion.getByText("live", { exact: true }).waitFor();

  await page.evaluate(() => {
    window.__lastTrack.stop();
    window.__lastTrack.dispatchEvent(new Event("ended"));
  });
  await page.getByText(/Accesso al microfono terminato o revocato/u).waitFor();
  await page.getByRole("button", { name: "Riprova microfono", exact: true }).click();
  await healthRegion.waitFor();
  await healthRegion.getByText("live", { exact: true }).waitFor();

  await page.getByRole("button", { name: "Registra", exact: true }).click();
  await page.getByText(/Formato scelto dal runtime: audio\/webm/u).waitFor();
  await page.waitForTimeout(40);
  await page.getByRole("button", { name: "Pausa", exact: true }).click();
  await page.getByText("Registrazione in pausa.", { exact: true }).waitFor();
  await page.waitForTimeout(30);
  await page.getByRole("button", { name: "Riprendi", exact: true }).click();
  await page.getByText("Registrazione ripresa.", { exact: true }).waitFor();
  await page.waitForTimeout(40);
  await page.getByRole("button", { name: "Ferma registrazione", exact: true }).click();

  const result = page.getByRole("region", { name: "Registrazione locale" });
  await result.waitFor();
  await result.getByText(/audio\/webm/u).waitFor();
  const resultText = await result.textContent();
  const durationMatch = resultText?.match(/Durata misurata([0-9,.]+) s/u);
  if (durationMatch === null || Number(durationMatch[1].replace(",", ".")) <= 0) {
    throw new Error(`measured duration was not positive: ${resultText}`);
  }
  const download = result.getByRole("link", { name: "Scarica registrazione" });
  const href = await download.getAttribute("href");
  const filename = await download.getAttribute("download");
  if (!href?.startsWith("blob:") || filename !== "registrazione-audio.webm") {
    throw new Error(`local download mismatch: href=${href} filename=${filename}`);
  }
  if ((await page.evaluate(() => window.__trackStops)) < 2) throw new Error("microphone tracks were not released after revoke/stop");

  await page.getByRole("button", { name: "Azzera", exact: true }).click();
  if (await result.count() !== 0) throw new Error("reset did not remove the local recording result");
  if ((await page.evaluate(() => window.__revokedObjectUrls)) < 1) throw new Error("reset did not revoke the Blob URL");

  await page.getByRole("button", { name: "Attiva microfono", exact: true }).click();
  await healthRegion.waitFor();
  await page.getByRole("button", { name: "Registra", exact: true }).click();
  await page.getByText(/Formato scelto dal runtime: audio\/webm/u).waitFor();
  await page.getByRole("button", { name: "Azzera", exact: true }).click();
  await page.getByText(/Ripristinato\. Il microfono verrà richiesto/u).waitFor();
  await page.waitForTimeout(100);
  if (await result.count() !== 0) throw new Error("reset during recording recreated a late Blob result");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("microphone recorder has horizontal overflow at 390px");
  if (externalRequests.length !== 0) throw new Error(`microphone recorder made external requests: ${JSON.stringify(externalRequests)}`);

  const unsupportedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await unsupportedContext.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: undefined });
  });
  const unsupportedPage = await unsupportedContext.newPage();
  await unsupportedPage.goto(`${origin}/tools/microphone-recorder/`, { waitUntil: "networkidle" });
  await unsupportedPage.getByRole("alert").filter({ hasText: /non espone getUserMedia e MediaRecorder/u }).waitFor();
  if (await unsupportedPage.getByRole("button", { name: "Attiva microfono", exact: true }).isEnabled()) {
    throw new Error("unsupported browser still exposes an enabled microphone action");
  }
  const unsupportedOverflow = await unsupportedPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (unsupportedOverflow) throw new Error("unsupported-state UI has horizontal overflow at 390px");

  await unsupportedContext.close();
  await context.close();
  await browser.close();
  const receipt = {
    schemaVersion: 1,
    status: "PASS",
    tool: "microphone-recorder",
    automatedScope: "desktop Chromium with deterministic getUserMedia/MediaRecorder mocks for permission, revoke, MIME, Blob, cleanup and unsupported-state behavior",
    physicalAcceptance: { iosSafari: "NOT_OBSERVED", androidChrome: "NOT_OBSERVED" },
    mobileViewport: { width: 390, height: 844, horizontalOverflow: false },
    network: "zero external requests during automated task scope",
    goldPromotion: "BLOCKED_PHYSICAL_DEVICE_EVIDENCE",
  };
  const receiptDir = resolve(root, "quality/receipts/microphone-recorder");
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, "browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log("microphone recorder acceptance PASS: explicit permission + deny/revoke recovery + runtime MIME/Blob + no external network + 390px");
} finally {
  server.kill("SIGTERM");
}
