/**
 * #350 narrow-viewport global shell regression, independent of #329's
 * account component/style lane. Only locally served, already-built Astro dist.
 * Run after Astro build: node tests/site-header-reflow-350.browser.mjs
 * Chrome CSS widths 640/320 simulate 200/400%-equivalent desktop reflow.
 * They are NOT proof of native zoom or physical/screen-reader compliance.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    const file = resolve(root, "." + decodeURIComponent(pathname), pathname.endsWith("/") ? "index.html" : "");
    const rel = relative(root, file);
    if (file === root || rel === ".." || rel.startsWith(".." + sep)) return res.writeHead(403).end();
    const bytes = await readFile(file);
    res.writeHead(200, { "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store" }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok, fail) => { server.once("error", fail); server.listen(0, "127.0.0.1", ok); });
const origin = "http://127.0.0.1:" + server.address().port;
const user = { id: "fixture-only", name: "Persona Test", email: "persona@example.test" };
let signedIn = false;
let browser;
const external = [], mutations = [], errors = [];
const measurements = [];
try {
  browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 320, height: 850 },
    reducedMotion: "reduce", locale: "it-IT" });
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) { external.push(url.href); return route.abort(); }
    if (url.pathname === "/api/auth/session") {
      return route.fulfill({ status: signedIn ? 200 : 503, contentType: "application/json",
        body: JSON.stringify(signedIn ? { user } : { error: "Fixture disconnessa" }) });
    }
    if (url.pathname.startsWith("/api/")) {
      if (request.method() !== "GET") mutations.push(url.pathname);
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"fixture"}' });
    }
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      mutations.push(request.method() + " " + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));

  for (const width of [320, 390, 640]) {
    for (const theme of ["light", "dark"]) {
      for (const auth of [false, true]) {
        signedIn = auth;
        await page.setViewportSize({ width, height: 850 });
        await page.addInitScript((t) => localStorage.setItem("strumentini:theme:v1", t), theme);
        const response = await page.goto(origin + "/accedi/", { waitUntil: "domcontentloaded" });
        assert.equal(response?.status(), 200);
        await page.locator(auth ? "[data-account-menu]:visible" : "[data-account-login]:visible")
          .waitFor({ timeout: 10_000 });
        assert.equal(await page.locator("[data-account-login]").isVisible(), !auth,
          "Authenticated header must remove the signed-out login target visually and from tab order");
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        const geometry = await page.evaluate(() => {
          const doc = document.documentElement;
          const selectors = [".site-header", ".site-header-inner", ".site-brand",
            ".site-actions", ".site-menu-button", "[data-account-chip]",
            "[data-account-toggle]", "[data-search-trigger]"];
          const boxes = Object.fromEntries(selectors.map((sel) => {
            const node = document.querySelector(sel);
            if (!node) return [sel, null];
            const r = node.getBoundingClientRect();
            return [sel, { left: r.left, right: r.right, width: r.width, height: r.height,
              visible: Boolean(node.getClientRects().length) }];
          }));
          return { viewport: doc.clientWidth, scrollWidth: doc.scrollWidth, boxes };
        });
        measurements.push({ width, auth, theme, ...geometry });
        assert(geometry.scrollWidth <= geometry.viewport + 1,
          "Global horizontal reflow failure " + JSON.stringify({ width, auth, theme, ...geometry }));
        for (const sel of [".site-header-inner", ".site-actions", ".site-menu-button"]) {
          const box = geometry.boxes[sel];
          assert(box && box.visible && box.left >= -1 && box.right <= width + 1,
            "Header control offscreen " + JSON.stringify({ width, auth, theme, sel, box }));
        }
        const menuBox = geometry.boxes[".site-menu-button"];
        assert(menuBox.width >= 44 && menuBox.height >= 44, "Menu touch target clipped");
        const chip = geometry.boxes[auth ? "[data-account-toggle]" : "[data-account-chip]"];
        assert(chip.left >= -1 && chip.right <= width + 1, "Authenticated account target clipped");
        if (auth) assert(chip.height >= 44, "Authenticated account target must retain 44px touch height");

        if (width === 320 && auth) {
          const toggle = page.locator(".site-menu-button");
          // Confirm keyboard navigation reaches the same real menu control.
          await page.keyboard.press("Tab");
          let reached = false;
          for (let i = 0; i < 20; i++) {
            if (await toggle.evaluate((el) => document.activeElement === el)) { reached = true; break; }
            await page.keyboard.press("Tab");
          }
          assert(reached, "Mobile site menu must be reachable through keyboard Tab");
          const focus = await toggle.evaluate((el) => {
            const style = getComputedStyle(el);
            return { visible: el.matches(":focus-visible"), outline: style.outlineStyle,
              thickness: parseFloat(style.outlineWidth) };
          });
          assert(focus.visible && focus.outline !== "none" && focus.thickness >= 2,
            "Mobile menu must retain visible keyboard focus " + JSON.stringify(focus));
          await page.keyboard.press("Enter");
          assert.equal(await toggle.getAttribute("aria-expanded"), "true");
          assert.equal(await page.locator("#site-mobile-panel nav").isVisible(), true);
          await page.keyboard.press("Tab");
          const toolsSummary = page.locator("#site-mobile-panel .site-mobile-menu summary").first();
          assert.equal(await toolsSummary.evaluate((el) => document.activeElement === el), true,
            "The first mobile navigation section must be reachable after the menu trigger");
          await page.keyboard.press("Enter");
          assert.equal(await page.locator("#site-mobile-panel nav a[href='/strumenti/']").isVisible(), true,
            "Keyboard must reveal the actual tools link inside the expandable nav");
          await page.keyboard.press("Escape");
          assert.equal(await toggle.getAttribute("aria-expanded"), "false");
          assert.equal(await page.locator("#site-mobile-panel").isVisible(), false);
          assert.equal(await toggle.evaluate((el) => document.activeElement === el), true,
            "Escape restores keyboard focus to menu trigger");
          const account = page.locator("[data-account-toggle]");
          await account.focus();
          assert.equal(await account.isVisible(), true);
          await account.click();
          assert.equal(await account.getAttribute("aria-expanded"), "true");
          assert.equal(await page.getByRole("menuitem", { name: "Il tuo account" }).isVisible(), true);
          await toggle.click();
          assert.equal(await account.getAttribute("aria-expanded"), "false",
            "Outside click closes account dropdown without losing navigation");
        }
      }
    }
  }
  // Distinct route: the same shared header must work without the login form.
  signedIn = true;
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto(origin + "/preferiti/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-account-menu]:visible").waitFor();
  const area = await page.evaluate(() => ({ document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth, actionsRight: document.querySelector(".site-actions").getBoundingClientRect().right }));
  assert(area.document <= area.viewport + 1 && area.actionsRight <= 321,
    "Global header must not overflow signed-in favourites " + JSON.stringify(area));
  assert.deepEqual(mutations, [], "No state-changing account/upload requests");
  assert.deepEqual(errors, [], "No browser errors in tested header paths");
  assert(external.every((url) => url.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js")),
    "Only the login page's intentionally blocked optional challenge may request offsite: " + JSON.stringify(external));
  console.log("PASS #350 real installed Chrome: 320/390/640 CSS widths, light/dark, signed-in/out, shared header on login and favourites, menu keyboard/focus/Escape, zero header overflow; width 320 models 400%-equivalent reflow, not native zoom");
  await context.close();
} finally {
  await browser?.close();
  await new Promise((ok) => server.close(ok));
}
