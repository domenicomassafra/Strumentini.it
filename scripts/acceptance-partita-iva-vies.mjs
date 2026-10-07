import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 18149;
const origin = `http://127.0.0.1:${port}`;
const dist = process.env.STRUMENTINI_ACCEPTANCE_DIST ?? "dist";
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dist], { cwd: root, stdio: "ignore" });
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function ready() {
  for (let index = 0; index < 40; index += 1) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await sleep(100);
  }
  throw new Error("static acceptance server unavailable");
}

try {
  await ready();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let viesRequests = 0;
  await page.route("**/api/vies/check", async (route) => {
    viesRequests += 1;
    const request = route.request();
    if (request.method() !== "POST") throw new Error("VIES action must use POST");
    const posted = JSON.parse(request.postData() ?? "{}");
    if (posted.vatNumber !== "12345678903") throw new Error("unexpected VIES VAT payload");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ state: "remote-valid", valid: true, countryCode: "IT", vatNumber: "12345678903", authority: "European Commission — VIES VAT Information Exchange System", source: "https://ec.europa.eu/taxation_customs/vies/", retrievedAt: "2026-10-06T12:00:00.000Z", requestDate: "2026-10-06" }),
    });
  });
  await page.goto(`${origin}/tools/partita-iva-validator/`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Partita IVA", exact: true }).fill("IT 12345678903");
  await page.getByRole("button", { name: "Verifica Partita IVA", exact: true }).click();
  await page.locator("[data-vies-verification]").waitFor();
  if (viesRequests !== 0) throw new Error("VIES was contacted before explicit remote action");
  const boundary = await page.locator("[data-vies-network-boundary]").innerText();
  if (!/Solo premendo[\s\S]*inviata[\s\S]*VIES/iu.test(boundary)) throw new Error("network boundary disclosure missing before VIES action");
  await page.locator("[data-vies-submit]").click();
  await page.getByText(/Valido secondo la fonte remota/iu).waitFor();
  if (viesRequests !== 1) throw new Error(`expected one explicit VIES request, observed ${String(viesRequests)}`);
  const provenance = await page.locator('[aria-label="Provenienza e verifica"]').innerText();
  if (!/European Commission[\s\S]*2026-10-06T12:00:00.000Z[\s\S]*Fonte consultata in rete[\s\S]*Verifica remota autorevole/iu.test(provenance)) throw new Error("VIES authority/timestamp/network provenance missing");
  await browser.close();
  console.log("Partita IVA / VIES browser acceptance PASS: no implicit network; explicit remote provenance observed");
} finally {
  server.kill("SIGTERM");
}
