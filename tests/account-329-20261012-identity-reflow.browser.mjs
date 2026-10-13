/** #329: valid long identities must not widen the real settings/error form.
 * ACCOUNT329_ORIGIN=http://127.0.0.1:19632 node tests/account-329-20261012-identity-reflow.browser.mjs
 * Reuses installed Playwright and the existing account tests' local API fixtures.
 * CSS-width reflow only; native zoom, screen readers and physical devices NOT_RUN.
 */
import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";

const origin = process.env.ACCOUNT329_ORIGIN ?? "http://127.0.0.1:19632";
const target = new URL(origin);
assert(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname), "Local fixture server required");
const identities = [
  { name: "Persona Test", email: "persona@example.test" },
  { name: "Persona Test", email: "ufficio.amministrazione.contabilita.fornitori@example.test" },
  { name: "W".repeat(80), email: "ufficio.amministrazione.contabilita.fornitori@example.test" },
];
const reports = [];
const errors = [];
const offsite = [];
let deniedUpdates = 0;

async function bounds(page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const clipped = [];
    // Range fragments inspect actual painted text, not merely a container box.
    for (const selector of ["[data-profile-name]", "[data-profile-email]", "[data-account-message]"]) {
      const element = document.querySelector(selector);
      if (!element || element.hidden) continue;
      const range = document.createRange();
      range.selectNodeContents(element);
      for (const rect of range.getClientRects()) {
        if (rect.left < -1 || rect.right > viewport + 1) clipped.push({ selector, left: rect.left, right: rect.right });
      }
    }
    const controls = ["[data-session-signedin].ac-stack", "[data-account-form]", "#account-name", "#account-email", "[data-account-submit]", "[data-account-message]"]
      .map((selector) => {
        const element = document.querySelector(selector);
        if (!element || element.hidden) return null;
        const rect = element.getBoundingClientRect();
        return { selector, left: rect.left, right: rect.right };
      }).filter(Boolean);
    return { viewport, documentWidth: document.documentElement.scrollWidth, clipped, controls };
  });
}

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const width of [320, 390, 640, 1280]) for (const theme of ["light", "dark"]) for (const identity of identities) {
      const meta = { engine: engine.name(), version: browser.version(), width, theme, nameLength: identity.name.length, email: identity.email };
      const context = await browser.newContext({ viewport: { width, height: 844 }, locale: "it-IT", reducedMotion: "reduce" });
      try {
        await context.addInitScript((mode) => localStorage.setItem("strumentini:theme:v1", mode), theme);
        await context.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== target.origin) { offsite.push(url.href); return route.abort(); }
          if (url.pathname === "/api/auth/session") return route.fulfill({ json: { user: { id: "fixture", ...identity, passwordEnabled: true, googleConnected: true } } });
          if (url.pathname.startsWith("/api/auth/")) {
            if (route.request().method() !== "GET") {
              assert.equal(url.pathname, "/api/auth/profile", "Only the local profile update fixture may mutate");
              assert.equal(route.request().method(), "PATCH");
              deniedUpdates++;
            }
            return route.fulfill({ status: 503, json: { error: "Servizio non disponibile. Le informazioni precedenti restano invariate: riprova più tardi." } });
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        const response = await page.goto(`${target.origin}/impostazioni/`, { waitUntil: "domcontentloaded" });
        assert.equal(response?.status(), 200);
        await page.locator("[data-profile-email]:visible").waitFor();
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        assert.equal(await page.locator("[data-profile-email]").textContent(), identity.email, "Full address retained");
        assert.equal(await page.locator("[data-profile-name]").textContent(), identity.name, "Full name retained");
        assert(await page.evaluate((email) => {
          const input = document.createElement("input"); input.type = "email"; input.value = email;
          return input.checkValidity() && email.length <= 254;
        }, identity.email), "Fixture is a supported valid email");

        const before = await bounds(page);
        assert(before.documentWidth <= width + 1, `Profile must reflow: ${JSON.stringify({ ...meta, ...before })}`);
        assert.deepEqual(before.clipped, [], `Identity text must remain within viewport: ${JSON.stringify(meta)}`);
        assert(before.controls.every((rect) => rect.left >= -1 && rect.right <= width + 1), "Account form stays within viewport");

        // Real form handler + actual keyboard submit, with every API intercepted.
        await page.locator("#account-name").fill("Persona Aggiornata");
        await page.keyboard.press(engine === webkit ? "Alt+Tab" : "Tab");
        assert(await page.locator("#account-email").evaluate((el) => document.activeElement === el));
        await page.keyboard.press(engine === webkit ? "Alt+Tab" : "Tab");
        assert(await page.locator("[data-account-submit]").evaluate((el) => document.activeElement === el && el.matches(":focus-visible")));
        await page.keyboard.press("Enter");
        await page.locator("[data-account-message]:visible").waitFor();
        assert.equal(await page.locator("[data-account-message]").getAttribute("role"), "alert");
        const after = await bounds(page);
        assert(after.documentWidth <= width + 1, `Denied profile form must reflow: ${JSON.stringify({ ...meta, ...after })}`);
        assert.deepEqual(after.clipped, [], "Identity and 503 error text remain fully within viewport");
        assert(after.controls.every((rect) => rect.left >= -1 && rect.right <= width + 1), "503 state preserves bounded controls");
        assert.equal(await page.locator("[data-profile-name]").textContent(), identity.name, "Failed update preserves old identity");
        assert.equal(await page.locator("[data-profile-email]").textContent(), identity.email);
        assert(await page.locator("[data-account-submit]").isEnabled(), "Recovery action remains usable");
        reports.push({ ...meta, beforeWidth: before.documentWidth, afterWidth: after.documentWidth });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
assert.equal(reports.length, 48);
assert.equal(deniedUpdates, 48);
assert.deepEqual(errors, []);
assert.deepEqual(offsite, [], "No request may leave the local fixture server");
console.log("PASS #329 valid identity + keyboard HTTP503 reflow", JSON.stringify({
  variants: reports.length, deniedUpdates, reports, errors, offsite,
  nativeZoom: "NOT_RUN", physicalDevices: "NOT_RUN", screenreaders: "NOT_RUN",
}));
