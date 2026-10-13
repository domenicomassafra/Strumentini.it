/** Actual Chromium CSSOM proof. Run explicitly on a host with Playwright browsers.
 * Kept outside headless source CI: its Linux runner does not install Chromium.
 * All network routes are aborted before external egress.
 */
import { chromium } from "@playwright/test";

const endpoint = "https://outside.invalid/remote-background.png";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const attempted = [];
  await page.route("**/*", (route) => {
    attempted.push(route.request().url());
    return route.abort("blockedbyclient");
  });
  const html = `<html><body><div id="tile" style='width:20px;height:20px;background-image:image-set("${endpoint}" 1x)'></div></body></html>`;
  await page.setContent(html);
  const computed = await page.locator("#tile").evaluate((element) => getComputedStyle(element).backgroundImage);
  if (!computed.includes("image-set(") || !computed.includes(endpoint) || !attempted.includes(endpoint)) {
    throw new Error("IMAGE_SET_BROWSER_PROOF_FAILED: Chromium did not recognize or attempt the local CSS test resource");
  }
  await page.close();
  console.log("PASS #407 Chromium CSS image-set resource attempted, intercepted with zero egress");
} finally {
  await browser.close();
}
