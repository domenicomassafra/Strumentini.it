/**
 * #350: native desktop details menu must return keyboard focus to its visible
 * trigger on Escape from a submenu link, at 1060px and desktop width.
 * Real Chrome and WebKit against the current owner Astro dev source. This is
 * not VoiceOver, physical mobile, native zoom or an axe conformance claim.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, webkit } from "@playwright/test";

const port = 19650;
const origin = process.env.WCAG350_ORIGIN ?? `http://127.0.0.1:${port}`;
const server = process.env.WCAG350_ORIGIN ? null : spawn("./node_modules/.bin/astro", ["dev", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(), detached: true, stdio: "ignore",
});

async function ready() {
  for (let retry = 0; retry < 100; retry++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw new Error(`Astro exited ${server.exitCode}`);
    try { if ((await fetch(origin + "/strumenti/")).ok) return; } catch { /* startup */ }
    await sleep(200);
  }
  throw new Error("Astro dev route unavailable");
}

try {
  await ready();
  for (const [name, engine, options] of [
    ["Chrome", chromium, { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true }],
    ["WebKit", webkit, { headless: true }],
  ]) {
    const browser = await engine.launch(options);
    try {
      for (const width of [1060, 1280]) {
        for (const theme of ["light", "dark"]) {
          const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: "reduce", locale: "it-IT" });
          await context.route("**/*", (route) => {
            const req = route.request();
            if (new URL(req.url()).origin !== origin || !["GET", "HEAD"].includes(req.method())) return route.abort();
            return route.continue();
          });
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          if (theme === "dark") {
            await page.addInitScript(() => localStorage.setItem("strumentini:theme:v1", "dark"));
          }
          assert.equal((await page.goto(origin + "/strumenti/", { waitUntil: "domcontentloaded" }))?.status(), 200);
          const menu = page.locator(".site-nav details[data-nav-menu]").first();
          const summary = menu.locator("summary");
          assert.equal(await summary.isVisible(), true, `${name}/${width}: desktop nav is visible`);
          await summary.focus();
          await page.keyboard.press("Enter");
          assert.equal(await menu.getAttribute("open"), "", `${name}/${width}: keyboard Enter opens dropdown`);
          await page.keyboard.press("Tab");
          // WebKit on macOS can use controls-only Tab navigation by default;
          // target the real visible submenu link with focus() in that engine
          // so the subsequent Escape still executes as a keyboard action.
          if (name === "WebKit" && !await menu.locator(".site-nav-panel a").first().evaluate(
            (link) => document.activeElement === link)) {
            await menu.locator(".site-nav-panel a").first().focus();
          }
          const before = await page.evaluate(() => {
            const menu = document.querySelector(".site-nav details[data-nav-menu]");
            const active = document.activeElement;
            return { insidePanel: Boolean(menu?.querySelector(".site-nav-panel")?.contains(active)), text: active?.textContent?.trim().slice(0, 60) };
          });
          assert(before.insidePanel, `${name}/${width}: Tab enters dropdown link: ${JSON.stringify(before)}`);
          await page.keyboard.press("Escape");
          const after = await page.evaluate(() => {
            const menu = document.querySelector(".site-nav details[data-nav-menu]");
            const trigger = menu?.querySelector("summary");
            const active = document.activeElement;
            const style = trigger ? getComputedStyle(trigger) : null;
            return {
              open: menu?.open,
              triggerFocused: active === trigger,
              activeIsHiddenLink: Boolean(menu?.querySelector(".site-nav-panel")?.contains(active)),
              bodyFocused: active === document.body,
              triggerVisible: Boolean(trigger?.getClientRects().length),
              focusVisible: trigger?.matches(":focus-visible"),
              outline: style?.outlineStyle,
              outlineWidth: parseFloat(style?.outlineWidth ?? "0"),
            };
          });
          assert.equal(after.open, false, `${name}/${width}/${theme}: Escape closes menu`);
          assert(after.triggerFocused && after.triggerVisible && after.focusVisible && after.outline !== "none" && after.outlineWidth >= 2,
            `${name}/${width}/${theme}: Escape must restore visible keyboard focus to summary: ${JSON.stringify(after)}`);
          await page.keyboard.press("Tab");
          const subsequent = await page.evaluate(() => {
            const next = document.activeElement;
            return { visible: Boolean(next?.getClientRects().length), isMenuHiddenLink: Boolean(document.querySelector(".site-nav-panel")?.contains(next)), body: next === document.body };
          });
          assert(subsequent.visible && !subsequent.isMenuHiddenLink && !subsequent.body,
            `${name}/${width}/${theme}: after Escape, Tab continues to visible navigation ${JSON.stringify(subsequent)}`);
          // Escape can also be pressed while the dropdown is open but focus is
          // on another visible header control. Closing must not steal focus.
          if (width === 1280 && theme === "light") {
            await summary.focus();
            await page.keyboard.press("Enter");
            assert.equal(await menu.getAttribute("open"), "");
            const search = page.locator("[data-search-trigger]");
            await search.focus();
            await page.keyboard.press("Escape");
            assert.equal(await menu.getAttribute("open"), null);
            assert.equal(await search.evaluate((node) => document.activeElement === node), true,
              `${name}: Escape from an external visible control must preserve its focus`);
          }
          assert.deepEqual(errors, [], `${name}: no script errors`);
          await context.close();
        }
      }
    } finally { await browser.close(); }
  }
  console.info("PASS #350 desktop Escape restores visible summary focus and Tab flow: Chrome+WebKit, 1060/1280px, light/dark (8 cases)");
} finally {
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already stopped */ } }
}
