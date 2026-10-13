/** #407: HTML5 media URL attributes are active without quoted src= or srcset=. */
import { describe, expect, it } from "vitest";
import { parse } from "parse5";
import { strToU8, unzipSync, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";
import { checkTextPart407 } from "../src/runtime/file-threat-gate-407";

type Node = { tagName?: string; attrs?: { name: string; value: string }[]; childNodes?: Node[] };
const remote = "https://outside.invalid/probe.png";

function findAttribute(node: Node, tag: string, attribute: string): string | undefined {
  if (node.tagName === tag) {
    const value = node.attrs?.find((item) => item.name === attribute)?.value;
    if (value !== undefined) return value;
  }
  for (const child of node.childNodes ?? []) {
    const result = findAttribute(child, tag, attribute);
    if (result !== undefined) return result;
  }
  return undefined;
}

async function realZipDecision(html: string) {
  const bytes = zipSync({ "pages/index.html": strToU8(html) }, { level: 6 });
  expect(new TextDecoder("utf-8", { fatal: true }).decode(unzipSync(bytes)["pages/index.html"]))
    .toBe(html);
  const raw = new File([Uint8Array.from(bytes)], "html-resources.zip", { type: "application/zip" });
  let reads = 0;
  const decision = await detectLocalFile({
    name: raw.name, type: raw.type, size: raw.size,
    slice(start = 0, end = raw.size) {
      const count = end - start;
      expect(count).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
      reads += count;
      expect(reads).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      return raw.slice(start, end);
    },
  });
  expect(decision.readBytes).toBe(reads);
  return decision;
}

const resources = [
  ["unquoted image src", "img", "src", `<img src=${remote}>`, remote],
  ["slash-delimited image src", "img", "src", `<img/src=${remote}>`, remote],
  ["unquoted-quote HTML recovery", "img", "src", `<img data-x=a' src=${remote}>`, remote],
  ["quoted image src with HTML entity", "img", "src", '<img src="&#x68;ttps://outside.invalid/probe.png">', remote],
  ["protocol-relative image src", "img", "src", '<img src=//outside.invalid/probe.png>', "//outside.invalid/probe.png"],
  ["video poster", "video", "poster", `<video poster="${remote}" controls></video>`, remote],
  ["unquoted video poster", "video", "poster", `<video poster=${remote} controls></video>`, remote],
  ["unquoted video media", "video", "src", `<video src=${remote} autoplay></video>`, remote],
  ["audio media source", "audio", "src", `<audio src=${remote} autoplay></audio>`, remote],
  ["picture source fallback src", "source", "src", `<picture><source src=${remote}><img alt="sample"></picture>`, remote],
  ["video track resource", "track", "src", `<video><track src=${remote} kind=subtitles></video>`, remote],
  ["input image source", "input", "src", `<input type=image src=${remote}>`, remote],
  ["unquoted anchor navigation", "a", "href", `<a href=${remote}>open</a>`, remote],
] as const;

describe("#407 HTML5 active media/URL attributes in genuine bounded ZIP archives", () => {
  for (const [label, tag, attribute, markup, decoded] of resources) {
    it(`refuses ${label} recovered by independent HTML5 parser`, async () => {
      const html = `<html><body>${markup}</body></html>`;
      expect(findAttribute(parse(html) as Node, tag, attribute)).toBe(decoded);
      expect(checkTextPart407(html, "html"), label).toMatchObject({ reason: "UNSUPPORTED" });
      expect(await realZipDecision(html), label).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    });
  }

  it("preserves inert metadata, empty video poster, and same-document anchors", async () => {
    const html = '<html><body><img alt="preview" data-note="https://outside.invalid/not-requested.png">'
      + '<video controls poster=""></video><audio controls></audio>'
      + '<a href="#local">local section</a><a href=#local>local too</a>'
      + '<p id="local">Literal src and poster strings are just text.</p></body></html>';
    expect(findAttribute(parse(html) as Node, "video", "poster")).toBe("");
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await realZipDecision(html)).toMatchObject({ status: "supported", format: "zip" });
  });
});
