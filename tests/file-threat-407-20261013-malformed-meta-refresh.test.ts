/** #407: HTML5 treats quotes inside unquoted attributes as literal characters. */
import { describe, expect, it, vi } from "vitest";
import { parse } from "parse5";
import { strToU8, unzipSync, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";
import { checkTextPart407 } from "../src/runtime/file-threat-gate-407";

type Node = { tagName?: string; attrs?: { name: string; value: string }[]; childNodes?: Node[] };
function metas(node: Node): Record<string, string>[] {
  const own = node.tagName === "meta"
    ? [Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]))]
    : [];
  return [...own, ...(node.childNodes ?? []).flatMap(metas)];
}

const file = (bytes: Uint8Array) =>
  new File([new Uint8Array(bytes)], "malformed-meta.zip", { type: "application/zip" });
const zip = (html: string) => zipSync({ "pages/index.html": strToU8(html) }, { level: 6 });

const browserValidRedirects = [
  '<html><head><meta data-x=a\' http-equiv=refresh content="0;url=https://outside.invalid/next"></head></html>',
  '<html><head><meta data-x=a" http-equiv=refresh content="0;url=https://outside.invalid/next"></head></html>',
  '<html><head><meta data-x="innocent > character" data-y=a\' content="0;url=https://outside.invalid/next" http-equiv=refresh></head></html>',
  '<html><head><meta data-x=a\' http-equiv=ref&#x72;esh content="0;url=https://outside.invalid/next"></head></html>',
] as const;

describe("#407 HTML5 unquoted attribute quote recovery before ZIP candidate acceptance", () => {
  it.each(browserValidRedirects)("refuses independently parsed active meta refresh: %s", async (html) => {
    const bytes = zip(html);
    const expanded = unzipSync(bytes)["pages/index.html"];
    const actualHtml = new TextDecoder("utf-8", { fatal: true }).decode(expanded);
    expect(actualHtml).toBe(html);
    const parsed = metas(parse(actualHtml) as Node);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.["http-equiv"]).toBe("refresh");
    expect(parsed[0]?.content).toBe("0;url=https://outside.invalid/next");
    // The public candidate API is the security boundary; assert it first.
    expect(await detectLocalFile(file(bytes))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    expect(checkTextPart407(actualHtml, "html")).toMatchObject({ reason: "UNSUPPORTED" });
  });

  it("keeps harmless repaired HTML5 metadata and quoted > values, with bounded reads and zero network", async () => {
    const html = '<html><head><meta data-x=a\' http-equiv=content-type content="text/html; charset=UTF-8">'
      + '<meta data-x="quoted > character" name="viewport" content="width=device-width">'
      + '<meta data-x=a" name=description content="Local-only description"></head><body>safe</body></html>';
    expect(metas(parse(html) as Node)).toEqual([
      { "data-x": "a'", "http-equiv": "content-type", content: "text/html; charset=UTF-8" },
      { "data-x": "quoted > character", name: "viewport", content: "width=device-width" },
      { "data-x": 'a"', name: "description", content: "Local-only description" },
    ]);
    expect(checkTextPart407(html, "html")).toBeNull();
    const raw = file(zip(html));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let totalReadBytes = 0;
    try {
      const bounded = { name: raw.name, type: raw.type, size: raw.size,
        slice(start = 0, end = raw.size) {
          const count = end - start;
          expect(count).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
          totalReadBytes += count;
          expect(totalReadBytes).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
          return raw.slice(start, end);
        },
      };
      expect(await detectLocalFile(bounded)).toMatchObject({ status: "supported", format: "zip" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
