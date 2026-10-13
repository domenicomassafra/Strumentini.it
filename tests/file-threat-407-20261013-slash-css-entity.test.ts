/** #407 HTML5 treats a slash before an attribute name as a separator. */
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

function recoveredStyle(node: HtmlNode, tag: string): string | undefined {
  if (node.tagName === tag) {
    const value = node.attrs?.find(({ name }) => name === "style")?.value;
    if (value !== undefined) return value;
  }
  for (const child of node.childNodes ?? []) {
    const style = recoveredStyle(child, tag);
    if (style !== undefined) return style;
  }
  return undefined;
}

const external = "https://outside.invalid/steal.svg";
const hostile = [
  ["immediate slash before quoted HTML style", "div",
    '<div/style="background-image:url&#40;' + external + '&#41;"></div>', "background-image"],
  ["whitespace then slash before quoted HTML style", "div",
    '<div /style="background-image:url&#40;' + external + '&#41;"></div>', "background-image"],
  ["repeated slashes before HTML style", "div",
    '<div///style="background-image:url&#40;' + external + '&#41;"></div>', "background-image"],
  ["slash before SVG-in-HTML style", "rect",
    '<svg><rect/style="fill:url&#40;' + external + '&#41;" width="16" height="16"></rect></svg>', "fill"],
  ["slash before unquoted HTML5 style", "div",
    '<div/style=background-image:u&#114;l(' + external + ')></div>', "background-image"],
] as const;

async function zipDecision(html: string) {
  const bytes = zipSync({ "pages/index.html": strToU8(html) }, { level: 6 });
  const extracted = unzipSync(bytes)["pages/index.html"];
  expect(new TextDecoder("utf-8", { fatal: true }).decode(extracted)).toBe(html);
  const file = new File([Uint8Array.from(bytes)], "slash-css.zip", { type: "application/zip" });
  let reads = 0;
  const input = {
    name: file.name, type: file.type, size: file.size,
    slice(start = 0, end = file.size) {
      const count = end - start;
      expect(count).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
      reads += count;
      expect(reads).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      return file.slice(start, end);
    },
  };
  const decision = await detectLocalFile(input);
  expect(decision.readBytes).toBe(reads);
  return decision;
}

describe("#407 HTML5 slash-separated CSS attributes after numeric entity decoding", () => {
  for (const [name, tag, snippet, property] of hostile) {
    it("refuses real ZIP containing browser-recovered external CSS: " + name, async () => {
      const html = '<html><head><meta charset="utf-8"></head><body>' + snippet + '</body></html>';
      // parse5 independently follows HTML5 tokenization: slash is not part
      // of the style attribute name, and numeric references decode to url().
      const style = recoveredStyle(parse(html) as HtmlNode, tag);
      expect(style).toBe(property + ":url(" + external + ")");
      expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
      expect(await zipDecision(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    });
  }

  it("preserves benign HTML5 slash-recovered attributes and metadata", async () => {
    const html = '<html><head><meta http-equiv="content-type" content="text/html; charset=UTF-8"></head>'
      + '<body><div/style="color:rgb(10,20,30)" id="inert"></div></body></html>';
    expect(recoveredStyle(parse(html) as HtmlNode, "div")).toBe("color:rgb(10,20,30)");
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await zipDecision(html)).toMatchObject({ status: "supported", format: "zip" });
  });

  it("does not apply HTML5 slash recovery to valid XML quoted non-CSS metadata", () => {
    // XML uses strict attribute separators; /style in this inert data
    // attribute is text, not a CSS-capable attribute of the rect.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg">'
      + '<rect data-note="docs/path/style=display&#58;none" style="fill:rgb(1,2,3)" />'
      + '</svg>';
    expect(checkTextPart407(svg, "svg")).toBeNull();
  });
});
