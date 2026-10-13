/** #407: XML/HTML attribute entities are resolved before CSS url() parsing. */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { parse } from "parse5";
import { strToU8, unzipSync, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS, type LocalFileSource } from "../src/runtime/file-detection";
import { checkTextPart407 } from "../src/runtime/file-threat-gate-407";

type HtmlNode = { tagName?: string; attrs?: { name: string; value: string }[]; childNodes?: HtmlNode[] };
const { parser: saxParser } = createRequire(import.meta.url)("sax") as {
  parser: (strict: boolean, options: { xmlns: true }) => {
    onopentag: (node: { local: string; attributes: Record<string, { value: string }> }) => void;
    write: (value: string) => { close: () => void };
  };
};
function parsedSvgStyle(xml: string, local: string, attribute: string): string {
  let observed: string | undefined;
  const parser = saxParser(true, { xmlns: true });
  parser.onopentag = (node) => {
    if (node.local === local) observed = node.attributes[attribute]?.value;
  };
  parser.write(xml).close();
  if (observed === undefined) throw new Error("Actual XML attribute not found by independent SAX parser");
  return observed;
}
function parsedSvgStyleText(xml: string): string {
  let inStyle = false;
  let value = "";
  const parser = saxParser(true, { xmlns: true }) as ReturnType<typeof saxParser> & {
    ontext?: (value: string) => void;
    onclosetag?: (tag: string) => void;
  };
  parser.onopentag = (node) => { if (node.local === "style") inStyle = true; };
  parser.ontext = (part) => { if (inStyle) value += part; };
  parser.onclosetag = (tag) => { if (tag.endsWith("style")) inStyle = false; };
  parser.write(xml).close();
  return value;
}
function parsedHtmlStyle(html: string): string {
  const walk = (node: HtmlNode): string | undefined => {
    if (node.tagName === "div") return node.attrs?.find((item) => item.name === "style")?.value;
    for (const child of node.childNodes ?? []) {
      const found = walk(child);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const observed = walk(parse(html) as HtmlNode);
  if (observed === undefined) throw new Error("Actual HTML5 style attribute not found by parse5");
  return observed;
}
const makeZip = (text: string, name: string) => {
  const packed = zipSync({ [name]: strToU8(text) }, { level: 6 });
  expect(new TextDecoder("utf-8", { fatal: true }).decode(unzipSync(packed)[name])).toBe(text);
  return new File([Uint8Array.from(packed)], "css-entities.zip", { type: "application/zip" });
};
async function candidate(text: string, name: string) {
  const real = makeZip(text, name);
  let readBytes = 0;
  const traced: LocalFileSource = {
    size: real.size, name: real.name, type: real.type,
    slice(start = 0, end = real.size) {
      const bytes = end - start;
      expect(bytes).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
      readBytes += bytes;
      expect(readBytes).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      return real.slice(start, end);
    },
  };
  const result = await detectLocalFile(traced);
  expect(readBytes).toBe(result.readBytes);
  return result;
}
const url = "https://outside.invalid/secret.svg#frame";
const svgCases = [
  ["decimal CSS opening parenthesis", `<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url&#40;${url}&#41;"/></svg>`, "rect", "style"],
  ["hex CSS opening parenthesis", `<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url&#x28;${url}&#x29;"/></svg>`, "rect", "style"],
  ["CSS function name encoded", `<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:u&#114;l(${url})"/></svg>`, "rect", "style"],
  ["quote embedded inside quoted CSS style", `<svg xmlns="http://www.w3.org/2000/svg"><rect style="font-family:'Times';fill:u&#114;l(${url})"/></svg>`, "rect", "style"],
  ["presentation attribute", `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url&#40;${url}&#41;"/></svg>`, "rect", "fill"],
  ["Unicode-prefixed SVG under XML extension",
    `<é:svg xmlns:é="http://www.w3.org/2000/svg"><é:rect style="fill:url&#40;${url}&#41;"/></é:svg>`, "rect", "style"],
] as const;
const htmlCases = [
  ["quoted HTML5 style", `<html><head><meta charset="utf-8"></head><body><div style="background-image:url&#40;${url}&#41;"></div></body></html>`],
  ["unquoted HTML5 style", `<html><body><div style=background-image:u&#114;l(${url})></div></body></html>`],
] as const;

describe("#407 XML/HTML character references in CSS-bearing ZIP member attributes", () => {
  for (const [label, text, element, attribute] of svgCases) {
    it(`refuses independently SAX-parsed external SVG resource: ${label}`, async () => {
      expect(parsedSvgStyle(text, element, attribute)).toContain(`url(${url})`);
      expect(checkTextPart407(text, label.includes("XML extension") ? "xml" : "svg"))
        .toMatchObject({ reason: "UNSUPPORTED" });
      expect(await candidate(text, label.includes("XML extension") ? "graphics/drawing.xml" : "graphics/drawing.svg"))
        .toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    });
  }
  it("refuses SVG style element character references decoded as CSS source text", async () => {
    const text = `<svg xmlns="http://www.w3.org/2000/svg"><style>rect { fill:url&#40;${url}&#41; }</style><rect/></svg>`;
    expect(parsedSvgStyleText(text)).toContain(`url(${url})`);
    expect(checkTextPart407(text, "svg")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await candidate(text, "graphics/style.svg")).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });
  for (const [label, text] of htmlCases) {
    it(`refuses independently HTML5-parsed external CSS resource: ${label}`, async () => {
      expect(parsedHtmlStyle(text)).toContain(`url(${url})`);
      expect(checkTextPart407(text, "html")).toMatchObject({ reason: "UNSUPPORTED" });
      expect(await candidate(text, "pages/index.html")).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    });
  }
  it("keeps harmless SVG text entities and simple CSS / HTML metadata", async () => {
    const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="r" style="fill:rgb(10,20,30)"/>'
      + '<text x="0" y="0">A &amp; B</text><a href="#r">same page</a></svg>';
    expect(checkTextPart407(safeSvg, "svg")).toBeNull();
    expect(await candidate(safeSvg, "graphics/safe.svg")).toMatchObject({ status: "supported", format: "zip" });
    const safeHtml = '<html><head><meta http-equiv="content-type" content="text/html; charset=UTF-8"></head>'
      + '<body><div style="background:rgb(1,2,3)">A &amp; B</div></body></html>';
    expect(parsedHtmlStyle(safeHtml)).toBe("background:rgb(1,2,3)");
    expect(checkTextPart407(safeHtml, "html")).toBeNull();
    expect(await candidate(safeHtml, "pages/safe.html")).toMatchObject({ status: "supported", format: "zip" });
  });
  it("does not apply SVG/HTML CSS attribute policy to an unrelated OOXML relationship", async () => {
    const xml = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="urn:local" Target="media/image.png" '
      + 'TargetMode="Internal" style="display&#58;inline"/></Relationships>';
    expect(checkTextPart407(xml, "xml")).toBeNull();
    expect(await candidate(xml, "word/_rels/document.xml.rels")).toMatchObject({
      status: "supported", format: "zip",
    });
  });
});
