/** #407 wave22 — real ZIP/OOXML SVG external resolution boundary.
 * Uses an actual DEFLATE ZIP and independently parses the *expanded* SVG/XML
 * with root-lock-pinned sax@1.6.1 (via svgo), not the source preflight regexes.
 * Success here is a bounded candidate result, NOT sanitization/certification.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";
import { checkTextPart407 } from "../src/runtime/file-threat-gate-407";

const installed = createRequire(import.meta.url);
type XmlNode407 = { name: string; uri: string; attributes: Record<string, string> };
type SaxTag407 = { name: string; uri: string; attributes: Record<string, { value: string }> };
const { parser: saxParser } = installed("sax") as { parser: (strict: boolean, options: { xmlns: true }) => {
  onopentag: (node: SaxTag407) => void;
  write: (source: string) => { close: () => void };
} };

const zip = (name: string, source: string) => zipSync({ [name]: strToU8(source) }, { level: 6 });
const file = (bytes: Uint8Array) => new File([new Uint8Array(bytes)], "svg-members.zip", { type: "application/zip" });

function parseRealZipXml(bytes: Uint8Array, name: string): XmlNode407[] {
  const extracted = unzipSync(bytes)[name];
  expect(extracted).toBeDefined();
  const source = new TextDecoder("utf-8", { fatal: true }).decode(extracted);
  const elements: XmlNode407[] = [];
  const parser = saxParser(true, { xmlns: true });
  parser.onopentag = (node) => elements.push({
    name: node.name, uri: node.uri,
    attributes: Object.fromEntries(Object.entries(node.attributes).map(([key, attr]) => [key, attr.value])),
  });
  expect(() => parser.write(source).close()).not.toThrow();
  expect(elements.length).toBeGreaterThan(0);
  return elements;
}

describe("#407 wave22 XML/SVG external-URL and escaped CSS fail-closed preflight", () => {
  it("rejects XML xml:base that resolves a relative SVG href into an outside HTTPS resource", async () => {
    const xml = '<svg xmlns="http://www.w3.org/2000/svg" xml:base="https://outside.invalid/resources/"><a href="payload.svg#p">Preview</a></svg>';
    const bytes = zip("artwork/preview.svg", xml);
    const doc = parseRealZipXml(bytes, "artwork/preview.svg");
    const inheritedBase = doc.find((node) => node.name === "svg")?.attributes["xml:base"];
    const relativeHref = doc.find((node) => node.name === "a")?.attributes.href;
    expect(new URL(relativeHref!, inheritedBase!).href).toBe("https://outside.invalid/resources/payload.svg#p");
    expect(checkTextPart407(xml, "svg")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await detectLocalFile(file(bytes))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("rejects SVG relative href even without xml:base: it resolves outside the standalone archive member", async () => {
    const xml = '<svg xmlns="http://www.w3.org/2000/svg"><a href="../private/tracker.svg#anchor">Open</a></svg>';
    const bytes = zip("view/relative.svg", xml);
    const doc = parseRealZipXml(bytes, "view/relative.svg");
    const href = doc.find((node) => node.name === "a")?.attributes.href;
    expect(new URL(href!, "https://files.example.test/asset/view/relative.svg").href)
      .toBe("https://files.example.test/asset/private/tracker.svg#anchor");
    expect(await detectLocalFile(file(bytes))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("rejects SVG external handler protocols other than the previously enumerated http/file/data schemes", async () => {
    const xml = '<svg xmlns="http://www.w3.org/2000/svg"><a href="mailto:private@example.invalid">Contact</a></svg>';
    const bytes = zip("drawing/contact.svg", xml);
    const doc = parseRealZipXml(bytes, "drawing/contact.svg");
    const href = doc.find((node) => node.name === "a")?.attributes.href;
    if (typeof href !== "string") throw new Error("Independent SAX parse did not find the SVG link href");
    expect(new URL(href).protocol).toBe("mailto:");
    expect(await detectLocalFile(file(bytes))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("rejects CSS hexadecimal-escaped url() in SVG attributes that browser CSSOM resolves externally", async () => {
    // In CSS, \\72 is the code point 'r'. Chromium parses the below SVG
    // style into fill: url("https://outside.invalid/..."), despite the raw
    // input not containing the literal substring url(.
    const xml = String.raw`<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:rect width="20" height="20" style="fill:u\72 l(https://outside.invalid/secret.svg#id)"/></s:svg>`;
    const bytes = zip("images/safe-looking.xml", xml);
    const doc = parseRealZipXml(bytes, "images/safe-looking.xml");
    const css = doc.find((node) => node.name === "s:rect")?.attributes.style;
    if (typeof css !== "string") throw new Error("Independent SAX parse did not find the SVG rect style");
    expect(css.includes("url(")).toBe(false);
    const cssUnescaped = css.replace(/\\([0-9a-f]{1,6})(?:[ \t\r\n\f])?/giu, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)));
    expect(cssUnescaped).toContain("url(https://outside.invalid/secret.svg#id)");
    expect(checkTextPart407(xml, "xml")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await detectLocalFile(file(bytes))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("keeps harmless SVG vector shapes, same-document anchors and ordinary zipped XML supported", async () => {
    const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><path id="shape" d="M0 0 L20 20"/></defs><a href="#shape"><text x="2" y="4">Shape</text></a></svg>';
    const prefixed = '<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:rect width="20" height="20" style="fill:#334455"/></s:svg>';
    const ordinaryXml = '<Relationships><Relationship Id="rId1" Target="media/image.png" TargetMode="Internal"/></Relationships>';
    const bytes = zipSync({
      "graphics/shape.svg": strToU8(safeSvg),
      "graphics/rect.xml": strToU8(prefixed),
      "word/_rels/document.xml.rels": strToU8(ordinaryXml),
    }, { level: 6 });
    for (const [name, source, kind] of [
      ["graphics/shape.svg", safeSvg, "svg"],
      ["graphics/rect.xml", prefixed, "xml"],
      ["word/_rels/document.xml.rels", ordinaryXml, "xml"],
    ] as const) {
      expect(parseRealZipXml(bytes, name).length).toBeGreaterThan(0);
      expect(checkTextPart407(source, kind)).toBeNull();
    }
    expect(await detectLocalFile(file(bytes))).toMatchObject({
      status: "supported", format: "zip",
      note: "candidate only; decoding and content safety are not verified",
    });
  });

  it("uses only the bounded detector slice contract, never full ZIP materialization", async () => {
    const xml = '<svg xmlns="http://www.w3.org/2000/svg" xml:base="https://outside.invalid/"><path d="M0 0"/></svg>';
    const real = file(zip("images/x.svg", xml));
    let total = 0;
    const tracked = {
      name: real.name, type: real.type, size: real.size,
      slice(start = 0, end = real.size) {
        const count = end - start;
        expect(count).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
        total += count;
        return real.slice(start, end);
      },
    };
    expect(await detectLocalFile(tracked)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    expect(total).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
  });
});
