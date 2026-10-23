// Native Android picker probe: verifies adb taps reach the OS picker and that a
// pushed fixture can be selected, before the ticket acceptance lane runs.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const adbBin = process.env.ADB_BIN ?? "/home/udodo/Android/Sdk/platform-tools/adb";
const port = 18897;
const page = resolve(process.env.HOME ?? "/home/udodo", ".str336-probe-index.html");
const adb = (...args) => execFileSync(adbBin, args, { encoding: "utf8", timeout: 30000 }).trim();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
function nodes() {
  adb("shell", "uiautomator", "dump", "/sdcard/probe.xml");
  const xml = adb("shell", "cat", "/sdcard/probe.xml");
  return [...xml.matchAll(/<node\s+[^>]*>/gu)].map(([entry]) => {
    const attr = (name) => (entry.match(new RegExp(name + '="([^"]*)"', "u"))?.[1] ?? "").replaceAll("&amp;", "&");
    return { text: attr("text"), description: attr("content-desc"),
      bounds: attr("bounds").match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/u)?.slice(1).map(Number) };
  });
}
const labels = () => nodes().map((item) => item.text || item.description).filter(Boolean);
async function tapNative(name, tries = 8) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const match = nodes().find((item) => item.bounds &&
      (item.text === name || item.description === name || item.description.startsWith(name + ",")));
    if (match) {
      const [x1, y1, x2, y2] = match.bounds;
      adb("shell", "input", "tap", String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2)));
      await sleep(900);
      return true;
    }
    await sleep(700);
  }
  return false;
}
const server = createServer(async (req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(await readFile(page));
});
let browser;
await new Promise((ok) => server.listen(port, "127.0.0.1", ok));
try {
  adb("reverse", `tcp:${port}`, `tcp:${port}`);
  adb("forward", "tcp:9222", "localabstract:chrome_devtools_remote");
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `http://127.0.0.1:${port}/`, "com.android.chrome");
  for (let attempt = 0; attempt < 15 && !browser; attempt++) {
    try { browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 4000, noDefaults: true }); }
    catch { await sleep(1000); }
  }
  assert(browser, "CDP attach failed");
  const target = browser.contexts()[0];
  const tab = target.pages().find((item) => item.url().includes(`:${port}`)) ?? target.pages()[0];
  await tab.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
  for (const selector of ["[data-probe-photos]", "[data-probe-files]"]) {
    const box = await tab.evaluate((sel) => {
      const element = document.querySelector(sel);
      element.scrollIntoView({ block: "center" });
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }, selector);
    await sleep(500);
    adb("shell", "input", "tap", String(Math.round(box.x + 40)), String(Math.round(box.y + box.height / 2)));
    await sleep(2200);
    console.log(selector, "picker labels", JSON.stringify(labels().slice(-12)));
    if (selector === "[data-probe-photos]") {
      // Photo Picker: tap the first media cell, whatever its label.
      const chosen = (await tapNative("str336-probe.png")) ||
        (await tapNative("Foto")) || (await tapNative("Photos"));
      console.log(selector, "photo tapped", chosen);
    } else {
      if (labels().includes("More options")) await tapNative("More options");
      if (labels().includes("Browse…")) await tapNative("Browse…");
      if (labels().includes("Downloads")) await tapNative("Downloads");
      console.log(selector, "docs labels", JSON.stringify(labels().slice(-12)));
      console.log(selector, "file tapped", await tapNative("str336-probe.png"));
    }
    await sleep(1200);
    console.log(selector, "page status", await tab.locator("#status").innerText());
  }
} finally {
  await browser?.close().catch(() => {});
  await new Promise((ok) => server.close(ok));
  adb("reverse", "--remove", `tcp:${port}`);
  adb("forward", "--remove", "tcp:9222");
}
