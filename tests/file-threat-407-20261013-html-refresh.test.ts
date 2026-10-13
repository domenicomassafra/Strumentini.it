/** #407: an HTML meta refresh is active navigation even without script/href/src. */
import { describe, expect, it } from "vitest";
import { parse } from "parse5";
import { strToU8, unzipSync, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";
import { checkTextPart407 } from "../src/runtime/file-threat-gate-407";

type HtmlNode = { tagName?: string; attrs?: { name: string; value: string }[]; childNodes?: HtmlNode[] };

function findMeta(node: HtmlNode): Record<string, string>[] {
  const self = node.tagName === "meta"
    ? [Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]))]
    : [];
  return [...self, ...(node.childNodes ?? []).flatMap(findMeta)];
}

const file = (bytes: Uint8Array) => new File([new Uint8Array(bytes)], "html-archive.zip", { type: "application/zip" });
const archive = (html: string) => zipSync({ "pages/index.html": strToU8(html) }, { level: 6 });

const dangerousHtml = [
  '<html><head><meta http-equiv="refresh" content="0; url=https://outside.invalid/next?private=1"></head><body>preview</body></html>',
  '<html><head><meta content="0;URL=https://outside.invalid/secret" http-equiv="ref&#x72;esh"></head><body>preview</body></html>',
  '<html><head><meta content="0;url=https://outside.invalid/secret" http-equiv=refresh></head><body>preview</body></html>',
] as const;

describe("#407 live HTML meta-refresh navigation in actual DEFLATE ZIP", () => {
  it.each(dangerousHtml)("refuses a browser-valid HTML auto-navigation element %s", async (html) => {
    const bytes = archive(html);
    const decompressed = unzipSync(bytes)["pages/index.html"];
    expect(decompressed).toBeDefined();
    const realHtml = new TextDecoder("utf-8", { fatal: true }).decode(decompressed);
    const values = findMeta(parse(realHtml) as HtmlNode);
    expect(values).toHaveLength(1);
    expect(values[0]?.["http-equiv"]).toBe("refresh");
    expect(values[0]?.content).toMatch(/^0;\s*(?:url|URL)=https:\/\/outside\.invalid\//u);
    expect(await detectLocalFile(file(bytes))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    expect(checkTextPart407(realHtml, "html")).toMatchObject({ reason: "UNSUPPORTED" });
  });

  it("keeps harmless metadata, local inert markup, and bounded read budget", async () => {
    const html = '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="content-type" content="text/html; charset=UTF-8"></head><body><p>Safe local text</p></body></html>';
    const zip = archive(html);
    const parsed = findMeta(parse(html) as HtmlNode);
    expect(parsed).toEqual([{ charset: "utf-8" }, { name: "viewport", content: "width=device-width" },
      { "http-equiv": "content-type", content: "text/html; charset=UTF-8" }]);
    expect(checkTextPart407(html, "html")).toBeNull();
    let reads = 0;
    const raw = file(zip);
    const traced = { name: raw.name, type: raw.type, size: raw.size,
      slice(start = 0, end = raw.size) {
        const count = end - start;
        expect(count).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
        reads += count;
        return raw.slice(start, end);
      } };
    expect(await detectLocalFile(traced)).toMatchObject({ status: "supported", format: "zip" });
    expect(reads).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
    const controller = new AbortController();
    controller.abort();
    expect(await detectLocalFile(raw, { signal: controller.signal }))
      .toMatchObject({ status: "refused", reason: "CANCELLED" });
  });
});
