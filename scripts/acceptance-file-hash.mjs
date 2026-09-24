import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const port = 18124;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  cwd: root,
  stdio: "ignore",
});
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

try {
  await sleep(500);
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requestsBeforeHash = [];
  const requestsAfterSelection = [];
  let selected = false;
  page.on("request", (request) => {
    const target = selected ? requestsAfterSelection : requestsBeforeHash;
    target.push({ url: request.url(), method: request.method(), postData: request.postData() });
  });

  const response = await page.goto(`${origin}/tools/file-hash/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`file-hash route returned ${response?.status()}`);
  await page.getByText("Runs on this device.").waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) {
    throw new Error("mobile file-hash layout has horizontal overflow");
  }

  const payload = Buffer.from("private-file-payload-utilityos-ticket-10", "utf8");
  const expected = createHash("sha256").update(payload).digest("hex");
  selected = true;
  await page.getByLabel("File").setInputFiles({ name: "owner-private-name.txt", mimeType: "text/plain", buffer: payload });
  await page.getByLabel("Expected SHA-256 optional").fill(`  ${expected.toUpperCase()}  `);
  await page.getByRole("button", { name: "Calculate SHA-256" }).click();
  await page.getByText("Checksum matches", { exact: true }).waitFor();
  await page.getByText(expected, { exact: true }).waitFor();

  const allNetworkText = JSON.stringify(requestsAfterSelection);
  for (const secret of ["owner-private-name.txt", payload.toString("utf8"), expected]) {
    if (allNetworkText.includes(secret)) throw new Error(`private task value leaked into request metadata: ${secret}`);
  }
  const external = requestsAfterSelection.filter((item) => !item.url.startsWith(origin));
  if (external.length > 0) throw new Error(`unexpected external requests: ${JSON.stringify(external)}`);
  const beforeUrls = new Set(requestsBeforeHash.map((item) => item.url));
  const lazyRequests = requestsAfterSelection.filter((item) => !beforeUrls.has(item.url));
  if (!lazyRequests.some((item) => /worker.*\.js(?:$|\?)/u.test(item.url))) {
    throw new Error(`hash worker was not observed as a lazy request: ${JSON.stringify(lazyRequests)}`);
  }

  await page.getByRole("button", { name: "Reset" }).click();
  const large = Buffer.alloc(48 * 1024 * 1024, 0x5a);
  await page.getByLabel("File").setInputFiles({ name: "cancel-me.bin", mimeType: "application/octet-stream", buffer: large });
  const cancellationRun = page.getByRole("button", { name: "Calculate SHA-256" }).click({ noWaitAfter: true });
  await page.getByRole("button", { name: "Cancel", exact: true }).click({ timeout: 5000 });
  await cancellationRun;
  await page.getByRole("alert").filter({ hasText: "Hashing cancelled." }).waitFor();
  await sleep(200);
  await page.getByText("Your SHA-256 digest appears here.").waitFor();

  const receipt = {
    schemaVersion: 1,
    route: "/tools/file-hash/",
    mobileViewport: { width: 390, height: 844 },
    checksumVerification: "PASS",
    locality: { externalRequests: 0, privateValueRequestLeaks: 0 },
    lazyWorkerRequests: lazyRequests.map((item) => item.url),
    cancellation: "PASS",
    cancellationPayloadBytes: large.length,
    horizontalOverflow: false,
  };
  await mkdir(resolve(root, "quality/receipts/file-hash"), { recursive: true });
  await writeFile(resolve(root, "quality/receipts/file-hash/browser-acceptance.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await browser.close();
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  server.kill("SIGTERM");
}
