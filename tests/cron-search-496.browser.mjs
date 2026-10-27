import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const port = 18196;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: process.cwd(), stdio: "ignore",
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The local static site did not start");
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const externalRequests = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin) || request.method() !== "GET") externalRequests.push(request.url());
  });
  const response = await page.goto(`${origin}/tools/cron-next-run/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error("Cron route did not respond with HTTP 200");
  await page.locator("[data-tool-page][data-runtime='LOCAL']").waitFor();

  const expression = page.locator("#cron-next-run-expression");
  const from = page.locator("#cron-next-run-from");
  const timezone = page.locator("#cron-next-run-timezone");
  const count = page.locator("#cron-next-run-count");
  const run = page.locator("[data-tool-run-control]");

  await expression.fill("0 0 31 2 *");
  await from.fill("2026-10-27T00:00:00Z");
  await timezone.fill("Europe/Rome");
  await count.fill("1");
  const started = performance.now();
  await run.click();
  await page.locator("[data-tool-error]").waitFor();
  const elapsedMs = performance.now() - started;
  if (elapsedMs > 1500) throw new Error(`Impossible cron stalled the browser for ${elapsedMs.toFixed(0)} ms`);

  await expression.fill("30 2 * * *");
  await from.fill("2026-03-28T01:31:00Z");
  await run.click();
  await page.locator(".gutter[data-state='success']").waitFor();
  const spring = await page.locator(".bounded-result-preview pre").innerText();
  if (!spring.includes("2026-03-30T00:30:00.000Z") || spring.includes("2026-03-29T01:30:00.000Z")) {
    throw new Error("Spring DST gap was not skipped");
  }

  await from.fill("2026-10-24T01:31:00Z");
  await count.fill("2");
  await run.click();
  await page.locator(".gutter[data-state='success']").waitFor();
  const fall = await page.locator(".bounded-result-preview pre").innerText();
  if (!fall.includes("2026-10-25T00:30:00.000Z") || !fall.includes("2026-10-25T01:30:00.000Z")) {
    throw new Error("DST overlap did not include both UTC instants");
  }

  // Hold the first lazy runtime module to make cancellation observable by a
  // real browser click, regardless of machine speed or warmed module caches.
  const cancelPage = await browser.newPage();
  await cancelPage.goto(`${origin}/tools/cron-next-run/`, { waitUntil: "networkidle" });
  let releaseLazyImport;
  await cancelPage.route(/\/_astro\/registry\.[^/]+\.js$/u, async (route) => {
    await new Promise((resolve) => { releaseLazyImport = resolve; });
    await route.continue();
  });
  await cancelPage.locator("#cron-next-run-expression").fill("0 0 31 2 *");
  await cancelPage.locator("[data-tool-run-control]").click();
  const cancel = cancelPage.getByRole("button", { name: "Annulla" });
  await cancel.waitFor({ timeout: 3000 });
  await cancel.click();
  releaseLazyImport?.();
  await cancelPage.locator(".gutter[data-state='cancelled']").waitFor({ timeout: 3000 });
  await cancelPage.close();
  if (externalRequests.length > 0) throw new Error(`Unexpected network requests: ${externalRequests.join(", ")}`);
  console.log(`cron browser PASS: impossible schedule ${elapsedMs.toFixed(1)} ms, responsive retry and cancel, DST gap/overlap, local GET only`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
