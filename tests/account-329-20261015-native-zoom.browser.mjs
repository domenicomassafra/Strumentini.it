/** #329 native Chromium zoom, isolated local account routes and HTTP 503 fixtures.
 * Start the repository's local Astro server, then ACCOUNT329_ORIGIN=... node this file.
 * Uses supported chrome.tabs zoom, never CSS zoom, viewport emulation or CDP pageScale.
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const origin = process.env.ACCOUNT329_ORIGIN ?? "http://127.0.0.1:19739";
assert.equal(new URL(origin).hostname, "127.0.0.1");
// Headless Chromium does not reliably resize an existing OS window through
// chrome.windows.update. Launch once at each real desktop window width instead
// of silently substituting page viewport emulation for native browser zoom.
const desktopWidth = Number(process.env.ACCOUNT329_DESKTOP_WIDTH ?? 1280);
assert([1280,1560].includes(desktopWidth), "Native zoom baseline must be 1280 or 1560 desktop pixels");
// Debug only the previously timed-out remote 503/focus seam without rerunning
// the full native zoom/contrast matrix already proved for this exact source.
const remote503Seam = process.env.ACCOUNT329_REMOTE_503_SEAM === "1";
const themes = remote503Seam ? ["light"] : ["light", "dark"];
const factors = remote503Seam ? [4] : [4, 2, 1];
const panels = ["login", "register", "profile"];
const temporary = await mkdtemp(join(tmpdir(), "strumentini329-zoom-"));
const reports = [], errors = [], offsite = [], submissions = [];
let context, control, tabId;
let signedIn = false;
let samples = 0, minimumContrast = Infinity;
const user = { id: "fixture", name: "Persona Test", email: "persona@example.test", passwordEnabled: true, googleConnected: true };

function contrast(first, second) {
  const luminance = color => {
    assert.match(color, /^rgb\(\d+[, ]+\d+[, ]+\d+\)$/, "Opaque browser paint required");
    return color.match(/\d+/g).map(Number).map(v => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function audit(page, state) {
  const result = await page.evaluate(() => {
    const root = document.querySelector(".ac-access, .ac-shell");
    if (!root) throw Error("Real account root missing");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), rows = [];
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!node.textContent.trim() || !el?.getClientRects().length || el.closest("[hidden], [aria-hidden=true], script, style")) continue;
      const css = getComputedStyle(el);
      if (css.visibility !== "visible" || Number(css.opacity) !== 1) continue;
      let ancestor = el, background;
      while (ancestor) {
        const color = getComputedStyle(ancestor).backgroundColor;
        if (/^rgb\(\d+[, ]+\d+[, ]+\d+\)$/.test(color)) { background = color; break; }
        ancestor = ancestor.parentElement;
      }
      if (!background) throw Error("Unresolved account text background");
      const range = document.createRange(); range.selectNodeContents(node);
      const scroller = el.closest("[data-settings-nav]");
      rows.push({ text: node.textContent.trim(), ink: css.color, background,
        threshold: parseFloat(css.fontSize) >= 24 || (parseFloat(css.fontSize) >= 18.66 && Number(css.fontWeight) >= 700) ? 3 : 4.5,
        tabScroller: scroller && scroller.scrollWidth > scroller.clientWidth ? scroller.clientWidth : null,
        rects: [...range.getClientRects()].map(r => ({ left: r.left, right: r.right })) });
    }
    return { rows, width: innerWidth, documentWidth: document.documentElement.scrollWidth };
  });
  assert(result.rows.length > 5, "Nonempty real account text audit");
  assert(result.documentWidth <= result.width + 1, `Horizontal overflow ${JSON.stringify({state,...result})}`);
  for (const row of result.rows) {
    const ratio = contrast(row.ink, row.background);
    assert(ratio >= row.threshold, `AA text contrast ${JSON.stringify({state,row,ratio})}`);
    assert(row.rects.every(r => row.tabScroller ? r.right-r.left<=row.tabScroller : r.left >= -1 && r.right <= result.width + 1),
      `Text clipped horizontally ${JSON.stringify({state,row,width:result.width})}`);
    minimumContrast = Math.min(minimumContrast, ratio); samples++;
  }
}

async function focused(page, selector) {
  await page.waitForTimeout(250); // Native focus scrolling may finish after the key event.
  // Evaluate against the current document in one shot. On the prior remote
  // preview, locator.evaluate timed out despite a preceding :visible wait;
  // avoiding a second locator resolution makes that seam directly falsifiable.
  // This read is deliberately non-retrying: a missing/ambiguous target fails,
  // rather than accepting an earlier page's focus state.
  const result = await page.evaluate(selector => {
    const matches = document.querySelectorAll(selector);
    if (matches.length !== 1) throw Error(`Expected one current-document focus target for ${selector}, got ${matches.length}`);
    const el = matches[0];
    const css = getComputedStyle(el), r = el.getBoundingClientRect();
    const nav=el.closest("[data-settings-nav]");
    const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
    return { active: document.activeElement === el, visible: el.matches(":focus-visible"), outline: css.outlineStyle,
      outlineWidth: parseFloat(css.outlineWidth), left:r.left, right:r.right, top:r.top, bottom:r.bottom,
      nav:nav ? {left:nav.scrollLeft,width:nav.clientWidth,scroll:nav.scrollWidth} : null,
      unoccluded:el.contains(hit),hit:hit?.outerHTML.slice(0,250),
      width:innerWidth, height:innerHeight, text:el.textContent.trim() };
  }, selector);
  assert(result.active && result.visible && result.outline !== "none" && result.outlineWidth >= 2, `Visible keyboard focus ${JSON.stringify(result)}`);
  assert(result.left >= 0 && result.right <= result.width + 1 && result.top >= 0 && result.bottom <= result.height + 1,
    `Focused target visible in actual zoom viewport ${JSON.stringify(result)}`);
  assert(result.unoccluded,`Focused control not covered by a sticky header/overlay ${JSON.stringify(result)}`);
  return result.text;
}

async function zoomState(page, base, factor) {
  const native = await control.evaluate(async id => ({factor:await chrome.tabs.getZoom(id),settings:await chrome.tabs.getZoomSettings(id)}),tabId);
  assert(Math.abs(native.factor-factor)<0.0001,"Current tab native zoom matches factor after navigation/action");
  await page.waitForFunction(({width,dpr,factor}) => Math.abs(innerWidth-width/factor)<=1 && Math.abs(devicePixelRatio-dpr*factor)<0.01, {...base,factor});
  const geometry = await page.evaluate(() => ({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visualScale:visualViewport.scale}));
  assert.equal(geometry.visualScale,1,"No pinch/page-scale emulation");
  return {...geometry,native};
}

try {
  await writeFile(join(temporary, "manifest.json"), JSON.stringify({ manifest_version:3, name:"Local account zoom proof", version:"1.0",
    host_permissions:[`${origin}/*`], background:{service_worker:"worker.js"} }));
  await writeFile(join(temporary, "worker.js"), "chrome.runtime.onInstalled.addListener(() => {});");
  await writeFile(join(temporary, "control.html"), "<!doctype html><title>Local zoom control</title>");
  context = await chromium.launchPersistentContext("", { headless:true, channel:"chromium", viewport:null,
    args:["--screen-info={1920x1200}",`--window-size=${desktopWidth},1000`, `--disable-extensions-except=${temporary}`, `--load-extension=${temporary}`] });
  if (process.env.ACCOUNT329_FOCUS_FAULT === "drop-alert-focus") {
    await context.addInitScript(() => {
      const original = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = function (...args) {
        if (this.matches("[data-access-error]")) return;
        return original.apply(this, args);
      };
    });
  }
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  control = await context.newPage();
  await control.goto(`chrome-extension://${new URL(worker.url()).host}/control.html`);
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === "https://challenges.cloudflare.com" && url.pathname.startsWith("/turnstile/v0/api.js")) return route.fulfill({ contentType:"text/javascript", body:`
      window.__account329Widget={};window.turnstile={render(el,options){window.__account329Widget[options.action]=options;return 'fixture-'+options.action},reset(){}};window.strumentiniTurnstileLoaded();` });
    if (url.origin !== origin) { offsite.push(url.href); return route.abort(); }
    if (url.pathname === "/api/auth/session") return route.fulfill({json:{user:signedIn ? user : null}});
    if (url.pathname.startsWith("/api/auth/")) {
      if (request.method() !== "GET") {
        assert(["/api/auth/login", "/api/auth/register", "/api/auth/profile"].includes(url.pathname));
        submissions.push(url.pathname);
      }
      return route.fulfill({status:503,json:{error:"Servizio temporaneamente non disponibile. Riprova."}});
    }
    assert(["GET","HEAD"].includes(request.method())); return route.continue();
  });
  const page = context.pages()[0];
  page.on("pageerror", error => errors.push(error.message));
  assert.equal((await page.goto(`${origin}/accedi/`))?.status(),200);
  tabId = await control.evaluate(async url => (await chrome.tabs.query({url:`${url}/*`}))[0].id, origin);
  for (const theme of themes) for (const factor of factors) {
    await control.evaluate(async id => { await chrome.tabs.setZoom(id,1); },tabId);
    await page.waitForFunction(width=>innerWidth===width,desktopWidth,{timeout:8000});
    const base = await page.evaluate(() => ({width:innerWidth,dpr:devicePixelRatio}));
    await control.evaluate(async ({id,factor,scope}) => {
      await chrome.tabs.setZoomSettings(id,{mode:"automatic",scope});
      await chrome.tabs.setZoom(id,factor);
    }, {id:tabId,factor,scope:process.env.ACCOUNT329_ZOOM_FAULT === "navigation-reset" ? "per-tab" : "per-origin"});
    await zoomState(page,base,factor);
    assert.equal(base.width,desktopWidth,"Actual desktop window width before native zoom");
    await page.evaluate(value => localStorage.setItem("strumentini:theme:v1",value),theme);
    for (const panel of panels) {
      signedIn=panel==="profile";
      assert.equal((await page.goto(`${origin}${signedIn ? '/impostazioni/' : '/accedi/'}`,{waitUntil:"domcontentloaded"}))?.status(),200);
      await zoomState(page,base,factor);
      assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
      const state={desktopWidth,theme,factor,panel};
      if (signedIn) {
        await page.locator("[data-profile-name]:visible").waitFor();
        await page.locator("#tab-profilo").focus();
        for (const tab of ["profilo","preferenze","tema","privacy"]) {
          await focused(page,`#tab-${tab}`);
          assert.equal(await page.locator(`#tab-${tab}`).getAttribute("aria-selected"),"true");
          assert(await page.locator(`#panel-${tab}`).isVisible());
          await audit(page,{...state,stage:`settings-${tab}`});
          await page.keyboard.press("ArrowRight");
        }
        await page.keyboard.press("End"); await focused(page,"#tab-privacy");
        await page.keyboard.press("Home"); await focused(page,"#tab-profilo");
        await page.locator("#account-name").fill("Persona Nuova");
        await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
        await focused(page,"[data-account-submit]"); await page.keyboard.press("Enter");
        await page.locator("[data-account-message][role=alert]:visible").waitFor();
        await page.waitForTimeout(250); // Observe settled layout after asynchronous error rendering.
        await focused(page,"[data-account-submit]");
        assert.equal(await page.locator("[data-profile-name]").textContent(),user.name);
        assert.equal(await page.locator("#account-name").inputValue(),"Persona Nuova");
      } else {
        await page.locator(`#tab-${panel}`).click();
        const submit=`#panel-${panel} [data-access-submit]`;
        await page.locator(submit).focus(); await page.keyboard.press("Enter");
        await page.locator(`#${panel}-${panel==='login' ? 'email' : 'name'}-error:visible`).waitFor();
        await audit(page,{...state,stage:"inline-errors"});
        if(panel==="register") await page.locator("#register-name").fill("Persona Test");
        await page.locator(`#${panel}-email`).fill("persona@example.test");
        await page.locator(`#${panel}-password`).fill("fixture-password-329");
        await page.waitForFunction(action=>window.__account329Widget?.[action],panel);
        await page.evaluate(action=>window.__account329Widget[action].callback("local-fixture-token"),panel);
        await page.locator(submit).focus(); await page.keyboard.press("Enter");
        await page.locator("[data-access-error][role=alert]:visible").waitFor();
        assert.match(await focused(page,"[data-access-error]"),/temporaneamente non disponibile/u);
        assert(await page.locator(submit).isEnabled());
        assert.equal(await page.locator(`#${panel}-email`).inputValue(),"persona@example.test");
      }
      await audit(page,{...state,stage:"503"}); reports.push({...state,...await zoomState(page,base,factor)});
    }
  }
  const expectedStates = themes.length * factors.length * panels.length;
  assert.equal(reports.length,expectedStates); assert.equal(submissions.length,remote503Seam ? expectedStates : 18);
  assert.deepEqual(errors,[]); assert.deepEqual(offsite,[]);
  const sourceFiles=["src/components/account/account.css","src/components/account/auth-client.ts","src/pages/accedi.astro","src/pages/impostazioni.astro","src/components/shell/SiteHeader.astro","src/styles/global.css"];
  const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash("sha256").update(await readFile(file)).digest("hex")])));
  console.log(JSON.stringify({ticket:329,result:"PASS",head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),browser:context.browser().version(),sourceHashes,samples,minimumContrast,reports,submissions:submissions.length,errors,offsite,physicalDevices:"NOT_RUN",screenreaders:"NOT_RUN"}));
} finally {
  try {
    if(control && tabId !== undefined) await Promise.race([
      control.evaluate(async id=>{await chrome.tabs.setZoom(id,1);if(Math.abs(await chrome.tabs.getZoom(id)-1)>0.0001)throw Error("Zoom restore failed");},tabId),
      new Promise((_,reject)=>setTimeout(()=>reject(Error("Zoom restore timed out")),3000).unref()),
    ]);
  } finally { await context?.close(); await rm(temporary,{recursive:true,force:true}); }
}
