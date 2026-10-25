/** Public settings-page deletion seam with synthetic API responses and local built HTML. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = 18482;
const origin = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "dist"], {
  detached: true, stdio: "ignore",
});
let browser;

try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${origin}/impostazioni/`)).status === 200) break;
    } catch { /* server starting */ }
    if (i === 79) throw new Error("Local built settings page never served");
    await delay(200);
  }
  browser = await chromium.launch({ headless: true });
  for (const status of [401, 200, 204]) {
    const page = await browser.newPage();
    let deleteRequests = 0;
    await page.route("**/api/auth/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/session") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          user: { email: "fixture@example.invalid", name: "Fixture", passwordEnabled: true, googleConnected: true },
        }) });
      }
      if (path === "/api/auth/sessions") {
        return route.fulfill({ status: 200, contentType: "application/json", body: '{"sessions":[]}' });
      }
      if (path === "/api/auth/account") {
        deleteRequests++;
        assert.equal(route.request().method(), "DELETE");
        assert.equal(route.request().postDataJSON().password, "correct-password");
        return route.fulfill({ status, contentType: "application/json",
          headers: status === 204 ? { "set-cookie": "su_session=; HttpOnly; Path=/; Max-Age=0" } : {},
          body: status === 204 ? "" : status === 401 ? '{"error":"Password errata"}' : "<html>unexpected fallback</html>",
        });
      }
      return route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"not found"}' });
    });
    await page.goto(`${origin}/impostazioni/#privacy`);
    await page.locator("[data-delete-form]").waitFor({ state: "visible" });
    await page.locator("#delete-password").fill("correct-password");
    await page.locator("#delete-confirm").fill("ELIMINA");
    const response = page.waitForResponse((r) => r.url().endsWith("/api/auth/account"));
    await page.locator("[data-delete-submit]").click();
    assert.equal((await response).status(), status);
    if (status === 204) {
      await page.waitForURL(`${origin}/`, { timeout: 7000 });
      assert.equal(new URL(page.url()).pathname, "/");
    } else {
      await page.locator("[data-delete-message]:visible").waitFor({ timeout: 7000 });
      assert.equal(new URL(page.url()).pathname, "/impostazioni/");
      assert.equal(await page.locator("[data-delete-form]").isVisible(), true);
    }
    assert.equal(deleteRequests, 1);
    await page.close();
    console.log(`PASS delete navigation HTTP${status}`);
  }
} finally {
  await browser?.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch { /* stopped */ }
}
