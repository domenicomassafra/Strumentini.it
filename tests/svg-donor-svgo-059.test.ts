import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { gzipSync } from "fflate";
import { runDeveloperWebTool } from "../src/engines/developer-web";
import { optimizeStaticSvg059 } from "../src/engines/developer-web/svg-optimizer-059";
import { developerTransformDownload } from "../src/runtime/developer-transform-download";

const source = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32">
<!-- this removable comment is non-visual -->
<metadata>Created by an editing application</metadata>
<rect x="0" y="0" width="64" height="32" fill="#1166aa"/>
<circle cx="25" cy="16" r="10" fill="white"/>
</svg>`;

describe("#059 actual SVGO MIT donor for bounded static SVG", () => {
  it("performs true minification and independently compares every rendered pixel against source", async () => {
    const result = await optimizeStaticSvg059(source);
    expect(result).toMatchObject({ valid: true, mode: "svg-minify", donor: "SVGO 4.1.0 (MIT)", safety: "NOT_A_GENERAL_SVG_SANITIZER" });
    expect(result.savedBytes).toBeGreaterThan(30);
    expect(result.outputBytes).toBeLessThan(result.inputBytes);
    expect(result.inputGzipBytes).toBe(gzipSync(new TextEncoder().encode(source), { level: 6 }).length);
    expect(result.outputGzipBytes).toBe(gzipSync(new TextEncoder().encode(result.output), { level: 6 }).length);
    expect(result.savedGzipBytes).toBe(result.inputGzipBytes - result.outputGzipBytes);
    expect(result.output).not.toContain("removable comment");
    expect(result.output).not.toContain("<metadata>");
    const before = await sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const after = await sharp(Buffer.from(result.output)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(after.info.width).toBe(before.info.width);
    expect(after.info.height).toBe(before.info.height);
    expect(after.data).toEqual(before.data);
    const second = await optimizeStaticSvg059(result.output);
    expect(second.output).toBe(result.output);
  });

  it("actually connects through existing XML validator tool and returns a true SVG download MIME", async () => {
    const result = await runDeveloperWebTool("xml-formatter-validator", { text: source, mode: "svg-minify" });
    const download = developerTransformDownload("xml-formatter-validator", result, source);
    expect(download).not.toBeNull();
    expect(download).toMatchObject({ mime: "image/svg+xml", kind: "file" });
    expect(download!.filename).toMatch(/\.svg$/u);
    expect(download!.output).toContain("<svg");
    expect(new TextEncoder().encode(download!.output).length).toBe(download!.outputBytes);
    const defaultXml = await runDeveloperWebTool("xml-formatter-validator", { text: "<a>ok</a>", mode: "minify" });
    expect(developerTransformDownload("xml-formatter-validator", defaultXml, "<a>ok</a>")!.filename).toMatch(/\.xml$/u);
  });

  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><div>Unsafe</div></foreignObject></svg>',
    '<svg><rect onclick="alert(1)"/></svg>',
    '<svg><rect style="fill:url(https://other.test/a)"/></svg>',
    '<svg><image href="https://other.test/image.png"/></svg>',
    '<svg><rect fill="url(https://other.test/foo)"/></svg>',
    '<svg><animate attributeName="x"/></svg>',
    '<!DOCTYPE svg [<!ENTITY foo SYSTEM "file:///etc/passwd">]><svg/>',
    '<svg><style>@import url(https://other.test/x.css)</style></svg>',
  ])("refuses dynamic/external/unsafe SVG, never returns a transformed artifact: %s", async (svg) => {
    await expect(optimizeStaticSvg059(svg)).rejects.toThrow(/INVALID_SVG|SVG_UNSAFE_CONTENT/u);
  });

  it("refuses invalid root, malformed XML, oversized input, and cancelled work", async () => {
    await expect(optimizeStaticSvg059("<html/> ")).rejects.toThrow(/INVALID_SVG/u);
    await expect(optimizeStaticSvg059("<svg><rect></svg>")).rejects.toThrow(/INVALID_SVG/u);
    await expect(optimizeStaticSvg059("<svg>" + " ".repeat(300_000) + "</svg>")).rejects.toThrow(/INVALID_SVG/u);
    const controller = new AbortController(); controller.abort();
    await expect(optimizeStaticSvg059(source, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
