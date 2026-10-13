/** #407: CSS image-set() accepts quoted URLs without CSS url() or HTML src=. */
import { describe, expect, it } from "vitest";
import { chromium } from "@playwright/test";
import { parse } from "parse5";
import { strToU8, unzipSync, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";
import { checkTextPart407 } from "../src/runtime/file-threat-gate-407";

type HtmlNode = { tagName?: string; attrs?: Array<{ name: string; value: string }>; childNodes?: HtmlNode[] };

function attribute(node: HtmlNode, tag: string, key: string): string | undefined {
  if (node.tagName === tag) {
    const found = node.attrs?.find((attr) => attr.name === key);
    if (found) return found.value;
  }
  for (const child of node.childNodes ?? []) {
    const found = attribute(child, tag, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function zippedDecision407(html: string) {
  const zipped = zipSync({ "pages/index.html": strToU8(html) }, { level: 6 });
  expect(new TextDecoder("utf-8", { fatal: true }).decode(unzipSync(zipped)["pages/index.html"])).toBe(html);
  const file = new File([Uint8Array.from(zipped)], "css-images.zip", { type: "application/zip" });
  let totalRead = 0;
  const decision = await detectLocalFile({
    name: file.name, type: file.type, size: file.size,
    slice(start = 0, end = file.size) {
      const count = end - start;
      expect(count).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
      totalRead += count;
      expect(totalRead).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      return file.slice(start, end);
    },
  });
  expect(decision.readBytes).toBe(totalRead);
  return decision;
}

const endpoint = "https://outside.invalid/remote-background.png";
const cases = [
  ["CSS image-set quoted URL", `background-image:image-set("${endpoint}" 1x)`],
  ["CSS -webkit-image-set quoted URL", `background-image:-webkit-image-set("${endpoint}" 1x)`],
  ["CSS escaped image-set function", `background-image:im\\61 ge-set("${endpoint}" 1x)`],
] as const;

describe("#407 deny CSS image-set external resources within actual ZIP HTML members", () => {
  for (const [label, style] of cases) {
    it(`refuses ${label} before ZIP candidate admission`, async () => {
      const html = `<html><body><div id="tile" style='width:20px;height:20px;${style}'></div></body></html>`;
      expect(attribute(parse(html) as HtmlNode, "div", "style")).toContain(style);
      expect(checkTextPart407(html, "html"), label).toMatchObject({ reason: "UNSUPPORTED" });
      expect(await zippedDecision407(html), label).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    });
  }

  it("real Chromium CSSOM resolves CSS image-set quoted URL into an attempted image load; route blocks egress", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const attempted: string[] = [];
      await page.route("**/*", (route) => {
        attempted.push(route.request().url());
        return route.abort("blockedbyclient"); // Network is never contacted.
      });
      const html = `<html><body><div id="tile" style='width:20px;height:20px;background-image:image-set("${endpoint}" 1x)'></div></body></html>`;
      await page.setContent(html);
      const property = await page.locator("#tile").evaluate((element) => getComputedStyle(element).backgroundImage);
      expect(property).toContain("image-set(");
      expect(property).toContain(endpoint);
      expect(attempted).toContain(endpoint);
      await page.close();
    } finally { await browser.close(); }
  });

  it("allows inert gradients and CSS values that do not reference resources", async () => {
    const html = '<html><body><div style="background:linear-gradient(red,blue);color:white" title="inert"></div></body></html>';
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await zippedDecision407(html)).toMatchObject({ status: "supported", format: "zip" });
  });

  it("does not confuse inert text/data attributes containing image-set with live CSS", async () => {
    const html = `<html><body><div data-caption='image-set("${endpoint}" 1x)'></div>`
      + `<p>image-set("${endpoint}" 1x) is documentation, not a CSS declaration.</p></body></html>`;
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await zippedDecision407(html)).toMatchObject({ status: "supported", format: "zip" });
  });
});
