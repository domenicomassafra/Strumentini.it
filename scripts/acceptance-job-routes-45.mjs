import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createServer } from "node:net";

const root = resolve(import.meta.dirname, "..");

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.once("error", rejectPort);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (typeof address === "string" || address === null) {
        probe.close();
        rejectPort(new Error("Port probe failed"));
      } else {
        probe.close(() => resolvePort(address.port));
      }
    });
  });
}

const existingOrigin = process.env.JOB45_ORIGIN;
const port = existingOrigin ? null : await freePort();
const origin = existingOrigin ?? `http://127.0.0.1:${port}`;
const server = existingOrigin ? null : spawn(process.execPath, ["node_modules/astro/bin/astro.mjs", "dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: "ignore",
});
let browser;
try {
  let ready = false;
  for (let index = 0; index < 80; index += 1) {
    if (server !== null && server.exitCode !== null) throw new Error(`Dev server stopped (${server.exitCode})`);
    try {
      const response = await fetch(`${origin}/strumenti/`);
      if (response.ok) { ready = true; break; }
    } catch { /* server still starting */ }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 250));
  }
  if (!ready) throw new Error("Dev server did not become ready");

  browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/strumenti/`, { waitUntil: "networkidle" });
    if (await page.locator(".job-topic").count() !== 4) throw new Error("Topic count is not four");
    if (await page.locator(".job-route").count() !== 4) throw new Error("Route count is not four");
    if (await page.locator(".job-routes-note").first().isVisible() !== true) throw new Error("Manual reselect disclosure is missing");
    const groupLabels = await page.locator("[data-group-row] .filtri-count").allTextContents();
    const total = groupLabels.reduce((sum, label) => sum + Number(label.trim()), 0);
    const displayedTotal = Number((await page.locator("[data-directory-count]").textContent())?.trim());
    if (!Number.isSafeInteger(total) || total !== displayedTotal) {
      throw new Error(`Facet counts do not match the generated catalog: ${total} vs ${displayedTotal}`);
    }
    const journeyLinks = page.locator(".job-route a");
    for (const href of await journeyLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
      if (!href?.startsWith("/tools/")) throw new Error(`Noncanonical journey route: ${href}`);
    }
    const signatureHref = await page.getByRole("link", { name: "Apri la firma grafica visiva" }).getAttribute("href");
    if (signatureHref !== "/tools/pdf-watermark/#firma-grafica-visiva") throw new Error(`Unexpected PDF signature route: ${signatureHref}`);
    await page.goto(`${origin}${signatureHref}`, { waitUntil: "networkidle" });
    if (await page.locator("#firma-grafica-visiva").count() !== 1) {
      throw new Error("PDF signature link does not resolve to the existing public mode");
    }
    await page.goto(`${origin}/strumenti/`, { waitUntil: "networkidle" });
    if (width === 390 && await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
      throw new Error("390px directory horizontal overflow");
    }
    await page.goto(`${origin}/tools/image-format-conversion/`, { waitUntil: "networkidle" });
    const continueLink = page.locator("section", { has: page.locator("h2", { hasText: "Continua l'attività" }) }).getByRole("link", { name: /Compressione immagine/u });
    if (await continueLink.count() !== 1) throw new Error("Missing canonical image compression next step");
    if (!(await page.getByText("I link non trasferiscono automaticamente dati", { exact: false }).count())) {
      throw new Error("Missing explicit manual handoff disclosure");
    }
    await page.goto(`${origin}/cerca/?q=togli%20exif%20foto`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-search-results] .tool-card-name a");
    const firstHit = await page.locator("[data-search-results] .tool-card-name a").first().getAttribute("href");
    if (firstHit !== "/tools/exif-remover") throw new Error(`Wrong EXIF intent destination: ${firstHit}`);
    await page.goto(`${origin}/cerca/?q=pdf`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-search-results] .tool-card-name a");
    const initial = await page.locator("[data-search-results] .tool-card").count();
    if (initial !== 12) throw new Error(`Search displays ${initial} instead of initial 12`);
    await page.locator("[data-search-more]").click();
    if (await page.locator("[data-search-results] .tool-card").count() !== 24) {
      throw new Error("Search show-more did not display the next 12");
    }
    if (width === 390 && await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
      throw new Error("390px search horizontal overflow");
    }
    if (errors.length > 0) throw new Error(`Browser errors: ${errors.join("; ")}`);
    await page.close();
    console.log(`#45 browser ${width}px PASS: 4 topics, 4 journeys, ${total} count-backed tools, live next step, EXIF intent, paginated search`);
  }
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
