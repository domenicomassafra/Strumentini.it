/** #407: HTML5 responsive-image attributes request resources without src=. */
import { describe, expect, it } from "vitest";
import { parse } from "parse5";
import { strToU8, unzipSync, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";
import { checkTextPart407 } from "../src/runtime/file-threat-gate-407";

type HtmlNode = {
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

function htmlAttribute(node: HtmlNode, tag: string, attribute: string): string | undefined {
  if (node.tagName === tag) {
    const value = node.attrs?.find(({ name }) => name === attribute)?.value;
    if (value !== undefined) return value;
  }
  for (const child of node.childNodes ?? []) {
    const found = htmlAttribute(child, tag, attribute);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function actualZipDecision(html: string) {
  const packed = zipSync({ "pages/index.html": strToU8(html) }, { level: 6 });
  expect(new TextDecoder("utf-8", { fatal: true }).decode(unzipSync(packed)["pages/index.html"]))
    .toBe(html);
  const file = new File([Uint8Array.from(packed)], "responsive-images.zip", { type: "application/zip" });
  let totalReadBytes = 0;
  const decision = await detectLocalFile({
    name: file.name, type: file.type, size: file.size,
    slice(start = 0, end = file.size) {
      const count = end - start;
      expect(count).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
      totalReadBytes += count;
      expect(totalReadBytes).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      return file.slice(start, end);
    },
  });
  expect(decision.readBytes).toBe(totalReadBytes);
  return decision;
}

const remote = "https://outside.invalid/pixel.svg";
const hostile = [
  ["quoted image srcset", "img", `<img srcset="${remote} 1x">`, `${remote} 1x`],
  ["unquoted image srcset", "img", `<img srcset=${remote}>`, remote],
  ["HTML5 slash-delimited srcset", "img", `<img/srcset="${remote} 2x">`, `${remote} 2x`],
  ["quote recovered from unquoted attribute", "img", `<img data-x=a' srcset="${remote} 1x">`, `${remote} 1x`],
  ["HTML5 numeric character reference", "img", `<img srcset="&#x68;ttps://outside.invalid/pixel.svg 1x">`, `${remote} 1x`],
  ["HTML5 image alias", "img", `<image srcset="${remote} 1x">`, `${remote} 1x`],
  ["picture source responsive image", "source", `<picture><source srcset="${remote} 1x"><img alt="placeholder"></picture>`, `${remote} 1x`],
  ["relative resource outside member", "img", `<img srcset="../other/pixel.svg 1x">`, "../other/pixel.svg 1x"],
] as const;

describe("#407 HTML5 responsive-image requests before ZIP candidate admission", () => {
  for (const [label, tag, fragment, expected] of hostile) {
    it(`refuses externally resolvable ${label}`, async () => {
      const html = `<html><body>${fragment}</body></html>`;
      // parse5 independently recovers HTML5 tokenization, aliasing and entities.
      expect(htmlAttribute(parse(html) as HtmlNode, tag, "srcset")).toBe(expected);
      expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
      expect(await actualZipDecision(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    });
  }

  it("keeps empty responsive attributes and inert image metadata", async () => {
    const html = '<html><body><picture><source srcset=""><img alt="Local preview" srcset="" '
      + 'data-note="srcset=https://outside.invalid/never-requested.svg"></picture></body></html>';
    const parsed = parse(html) as HtmlNode;
    expect(htmlAttribute(parsed, "source", "srcset")).toBe("");
    expect(htmlAttribute(parsed, "img", "srcset")).toBe("");
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await actualZipDecision(html)).toMatchObject({ status: "supported", format: "zip" });
  });

  it("keeps ordinary non-fetching image tags and escaped text", async () => {
    const html = '<html><body><img alt="inert sample" width="16" height="16">'
      + '<p>srcset= is only text &amp; not an image attribute.</p></body></html>';
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await actualZipDecision(html)).toMatchObject({ status: "supported", format: "zip" });
  });

  it("preserves the existing refusal of HTML preload imagesrcset", async () => {
    const html = `<html><head><link rel="preload" as="image" imagesrcset="${remote} 1x"></head></html>`;
    expect(htmlAttribute(parse(html) as HtmlNode, "link", "imagesrcset")).toBe(`${remote} 1x`);
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await actualZipDecision(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });
});
