import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const port = 18123;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  stdio: "ignore",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  await sleep(500);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const jsBeforeAction = [];
  const jsAfterAction = [];
  const taskRequests = [];
  let taskStarted = false;
  page.on("request", (request) => {
    if (request.resourceType() === "script") {
      (taskStarted ? jsAfterAction : jsBeforeAction).push(request.url());
    }
    if (taskStarted) {
      taskRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });
    }
  });

  const response = await page.goto(`${origin}/tools/business-day/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`tool route returned ${response?.status()}`);
  await page.getByText("Runs on this device.").waitFor();

  taskStarted = true;
  await page.getByRole("button", { name: "Calculate" }).click();
  await page.getByRole("alert").waitFor();
  if (!(await page.getByRole("alert").innerText()).includes("Check the dates")) {
    throw new Error("Invalid input did not produce the normalized recoverable error");
  }
  if (jsAfterAction.length === 0) {
    throw new Error("Expected the lazy tool implementation chunk to load on first operation attempt");
  }

  await page.getByLabel("Start date").fill("2026-09-18");
  await page.getByLabel("Business days to add").fill("1");

  await page.getByRole("button", { name: "Calculate" }).click();
  await page.getByText("2026-09-21", { exact: true }).waitFor();
  await page.waitForTimeout(100);

  const contentLeaks = taskRequests.filter((request) => {
    const haystack = `${request.url}\n${request.postData ?? ""}`;
    return request.method !== "GET" || /2026-09-18|2026-09-21|businessDays|startDate/u.test(haystack);
  });
  if (contentLeaks.length > 0) {
    throw new Error(`Task content appeared in network requests: ${JSON.stringify(contentLeaks)}`);
  }
  const externalRequests = taskRequests.filter((request) => !request.url.startsWith(origin));
  if (externalRequests.length > 0) {
    throw new Error(`Unexpected external requests after task start: ${JSON.stringify(externalRequests)}`);
  }

  await page.getByRole("button", { name: /^(?:Reset|Reimposta)$/u }).click();
  await page.getByText("Your result appears here.").waitFor();
  if ((await page.getByLabel("Start date").inputValue()) !== "") {
    throw new Error("Reset did not clear the operation state");
  }
  await page.getByText("Work Profile default", { exact: true }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("Mobile layout has horizontal overflow");

  await browser.close();
  console.log(`browser acceptance PASS: lazy scripts after action=${jsAfterAction.length}, task-content network requests=0`);
} finally {
  server.kill("SIGTERM");
}
