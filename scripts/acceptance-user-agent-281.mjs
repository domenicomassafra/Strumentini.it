import { chromium, webkit } from "@playwright/test";
import { spawn } from "node:child_process";
import { request } from "node:http";

const port = 18281;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], { stdio: "ignore" });
const iosSafari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function waitForServer() {
  for (let index = 0; index < 40; index += 1) {
    const ready = await new Promise((resolve) => {
      const req = request(origin, { method: "HEAD" }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.setTimeout(1000, () => req.destroy());
      req.on("error", () => resolve(false));
      req.end();
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("User-Agent browser test static server unavailable");
}

async function inspectBrowser(browserType) {
  console.log(`STR-281: launching ${browserType.name()}`);
  const existingChrome = browserType === chromium && process.argv.includes("--cdp-existing");
  const browser = existingChrome
    ? await chromium.connectOverCDP("http://127.0.0.1:17629", { timeout: 45000 })
    : await browserType.launch({ headless: true, timeout: 45000 });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true,
      hasTouch: true, userAgent: iosSafari, deviceScaleFactor: 3,
    });
    const page = await context.newPage();
    console.log(`STR-281: ${browserType.name()} navigates`);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const requests = [];
    page.on("request", (request) => requests.push({ url: request.url(), method: request.method(), kind: request.resourceType() }));
    page.on("console", (message) => {
      if (/content security policy|unsafe-eval|refused to (?:execute|load)/iu.test(message.text())) errors.push(message.text());
    });
    const response = await page.goto(`${origin}/tools/user-agent-parser/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (response?.status() !== 200) throw new Error(`HTTP ${response?.status()} user-agent-parser`);
    const submit = page.locator('[data-tool-run-control="true"]');
    await submit.waitFor();
    console.log(`STR-281: ${browserType.name()} submits`);
    const scriptsBeforeSubmit = requests.filter((item) => item.kind === "script").length;
    await submit.click();
    await page.locator(".gutter[data-state='success']").waitFor({ timeout: 10000 });
    const output = await page.locator(".bounded-result-preview pre").textContent();
    if (!output?.includes("Safari") || !output.includes("iOS") || !output.includes("WebKit")) {
      throw new Error(`Unexpected UA result: ${output}`);
    }
    const unexpected = requests.filter((item) => !item.url.startsWith(origin) || item.method !== "GET");
    if (unexpected.length || errors.length) throw new Error(JSON.stringify({ unexpected, errors }));
    const lazyJs = requests.filter((item) => item.kind === "script").length - scriptsBeforeSubmit;
    if (lazyJs === 0) throw new Error("No lazy parser script loaded on submit");
    const result = { browser: browserType.name(), iOSViewport: "390x844", output: "Safari / iOS / WebKit", lazyJs, offsiteRequests: 0, cspErrors: 0 };
    await context.close();
    return result;
  } finally {
    if (!existingChrome) await browser.close();
  }
}

try {
  await waitForServer();
  console.log("STR-281: static server ready");
  const results = [];
  const browsers = process.argv.includes("--webkit-only") ? [webkit]
    : process.argv.includes("--all") ? [chromium, webkit] : [chromium];
  for (const browser of browsers) {
    const result = await inspectBrowser(browser);
    console.log(`STR-281: ${result.browser} PASS`);
    results.push(result);
  }
  console.log(JSON.stringify({ status: "PASS", results }));
} finally {
  server.kill();
}
