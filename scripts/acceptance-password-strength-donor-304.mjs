import { chromium, firefox, webkit } from "@playwright/test";
import { spawn } from "node:child_process";

const port = 18304;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
const engines = [
  ["Chromium", chromium, { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }],
  ["Firefox", firefox, {}],
  ["WebKit", webkit, {}],
];
const selectedEngines = process.env.PASSWORD_DONOR_ENGINES?.split(",") ?? null;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  for (const [name, engine, options] of engines) {
    if (selectedEngines !== null && !selectedEngines.includes(name)) continue;
    let browser;
    try {
      browser = await engine.launch({ headless: true, timeout: 30000, ...options });
      const page = await browser.newPage();
      let externalRequests = 0;
      let workers = 0;
      page.on("request", (request) => {
        if (!request.url().startsWith(origin) && !request.url().startsWith("blob:") && !request.url().startsWith("data:")) externalRequests++;
      });
      page.on("worker", () => { workers++; });
      const response = await page.goto(`${origin}/tools/password-strength-estimator/`, { waitUntil: "networkidle" });
      assert(response?.status() === 200, `${name}: route unavailable`);
      const storage = () => page.evaluate(() => JSON.stringify({
        local: Object.fromEntries(Object.keys(localStorage).toSorted().map((key) => [key, localStorage.getItem(key)])),
        session: Object.fromEntries(Object.keys(sessionStorage).toSorted().map((key) => [key, sessionStorage.getItem(key)])),
      }));
      const before = await storage();
      await page.getByLabel("Password da stimare").fill("casa-mare-sole-luna");
      await page.getByRole("button", { name: "Stima e spiega" }).click();
      await page.getByText(/Stima di zxcvbn-ts combinata/iu).waitFor({ timeout: 30000 });
      assert(workers === 1, `${name}: donor Worker not invoked`);
      const after = await storage();
      if (after !== before) {
        const original = JSON.parse(before);
        const current = JSON.parse(after);
        const modified = ["local", "session"].flatMap((area) =>
          [...new Set([...Object.keys(original[area]), ...Object.keys(current[area])])]
            .filter((key) => original[area][key] !== current[area][key]).map((key) => `${area}:${key}`));
        throw new Error(`${name}: estimator persisted state keys: ${modified.join(", ")}`);
      }
      assert(externalRequests === 0, `${name}: external traffic`);
      await page.getByLabel("Password da stimare").fill("🙂".repeat(1024));
      await page.getByRole("button", { name: "Stima e spiega" }).click();
      await page.getByRole("button", { name: "Cancella" }).click();
      assert((await page.getByLabel("Password da stimare").inputValue()) === "", `${name}: reset did not clear`);
      await page.waitForTimeout(400);
      assert(await page.getByText(/Stima di zxcvbn-ts combinata/iu).count() === 0, `${name}: stale result after cancellation`);
      assert(externalRequests === 0, `${name}: external request after cancellation`);
      console.log(`${name}: PASS (same-origin Worker, abort/reset, storage unchanged, 0 external requests)`);
    } finally {
      if (browser) {
        await Promise.race([
          browser.close().catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      }
    }
  }
} finally {
  server.kill("SIGTERM");
}
