import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const port = 18157;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  stdio: "ignore",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
    }
    await sleep(100);
  }
  throw new Error(`static server did not become ready at ${origin}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const response = await page.goto(`${origin}/tools/rate-converter/`, { waitUntil: "networkidle" });
  if (response?.status() !== 200) throw new Error(`rate-converter returned HTTP ${response?.status()}`);

  const panel = page.locator(".result-panel");
  await panel.waitFor();
  if (await panel.getAttribute("aria-live") !== null) {
    throw new Error("Result payload is still a live region; large output could be re-announced.");
  }
  if (!(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))) {
    throw new Error("Reduced-motion browser fixture was not active.");
  }

  const submit = page.locator("[data-tool-run-control]");
  await submit.focus();
  await page.keyboard.press("Enter");
  const inlineError = page.locator("[data-tool-error]");
  await inlineError.waitFor();
  await page.locator('[data-result-state="error"]').waitFor();
  const focusedAfterError = await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.hasAttribute("data-tool-error") : false));
  if (!focusedAfterError) throw new Error("Error completion did not move focus to the shared inline error target.");
  if ((await page.locator('[data-result-state="error"]').innerText()).trim() !== "Stato: Errore") {
    throw new Error("Error state lacks the shared visible non-colour label.");
  }
  const assertiveText = (await page.locator('[data-result-announcement="assertive"]').innerText()).trim();
  if (assertiveText !== "Operazione non riuscita. Controlla l'errore e riprova.") {
    throw new Error(`Unexpected concise error announcement: ${JSON.stringify(assertiveText)}`);
  }
  if (assertiveText.includes((await inlineError.innerText()).trim())) {
    throw new Error("The live state announcement duplicated the full inline error payload.");
  }

  await page.getByLabel("Importo della tariffa").fill("50");
  await submit.focus();
  await page.keyboard.press("Enter");
  await page.locator('.result-panel[data-state="success"]').waitFor();
  const politeText = (await page.locator('[data-result-announcement="polite"]').innerText()).trim();
  if (politeText !== "Operazione completata. Il risultato è disponibile.") {
    throw new Error(`Unexpected concise success announcement: ${JSON.stringify(politeText)}`);
  }

  const accessibleSuccessStatuses = page.getByRole("status").filter({ hasText: "Operazione completata. Il risultato è disponibile." });
  if (await accessibleSuccessStatuses.count() !== 1) {
    throw new Error("Role-based accessibility query did not expose exactly one concise success status.");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow390) throw new Error("Result accessibility contract introduced horizontal overflow at 390px.");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  const overflowAt200 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflowAt200) throw new Error("Result accessibility contract introduced horizontal overflow at 200% zoom.");

  await context.close();
  await browser.close();
  console.log("result accessibility acceptance PASS: keyboard error/retry focus, concise AX announcements, reduced motion, 390px, 200% zoom");
} finally {
  server.kill("SIGTERM");
}
