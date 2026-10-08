import { describe, expect, it } from "vitest";
import { parseFragment } from "parse5";
import {
  DeveloperWebError,
  cssMinifyOperation,
  htmlMinifyOperation,
  runDeveloperWebTool,
} from "../src/engines/developer-web";

function textContent(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  const record = node as { nodeName?: string; value?: string; childNodes?: unknown[] };
  if (record.nodeName === "#text") return record.value ?? "";
  return (record.childNodes ?? []).map(textContent).join("");
}

describe("tickets 192-193 parser-backed minifiers", () => {
  it("minifies CSS through an AST while preserving strings and custom-property token content", () => {
    const input = '/* comment */\n.card { color: red; content: "a b"; --gap: 1rem  2rem; }';
    const result = cssMinifyOperation(input);
    expect(result.valid).toBe(true);
    expect(result.output).toContain('content:"a b"');
    expect(result.output).toContain("--gap:1rem 2rem");
    expect(result.outputBytes).toBeLessThan(result.inputBytes);
    expect(result.savedBytes).toBe(result.inputBytes - result.outputBytes);
    expect(cssMinifyOperation(result.output).output).toBe(result.output);
  });

  it("formats CSS readably through the AST, with stable output and preserved token semantics", () => {
    const input = '@media screen and (min-width: 20em){.x{content:"a  b";--my-space:1rem  2rem;color:red}.y{margin:0}}';
    const formatted = cssMinifyOperation(input, "prettify");
    expect(formatted.output).toContain("@media screen and (min-width:20em) {");
    expect(formatted.output).toContain(".x {");
    expect(formatted.output).toContain('content: "a  b"');
    expect(formatted.output).toContain("--my-space: 1rem 2rem");
    expect(cssMinifyOperation(formatted.output, "prettify").output).toBe(formatted.output);
    expect(cssMinifyOperation(formatted.output, "minify").output).toBe(cssMinifyOperation(input, "minify").output);
    expect(formatted.mode).toBe("prettify");
    expect(cssMinifyOperation("a{color:red}", "minify").output).toBe("a{color:red}");
    expect(() => cssMinifyOperation("a{}", "bad" as "minify")).toThrow(/INVALID_MODE/u);
  });

  it("refuses malformed CSS with a structured location and no optimized artifact", () => {
    for (const input of ["a { color: red", "a { color:; }", "a { color: red; broken ??? }"]) {
      try {
        cssMinifyOperation(input);
        throw new Error("expected CSS failure");
      } catch (error) {
        expect(error).toBeInstanceOf(DeveloperWebError);
        expect((error as DeveloperWebError).code).toBe("INVALID_CSS");
        expect((error as DeveloperWebError).diagnostic?.line).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("safe HTML mode preserves inline text and sensitive raw-text/whitespace semantics", () => {
    const input = '<div>\n  <p>Hello <strong>world</strong> again.</p>\n  <pre>  keep\n  this </pre>\n  <textarea> a  b </textarea>\n  <script>if (a < b) { x = "a  b"; }</script>\n  <style>.x { content: "a  b"; }</style>\n</div>';
    const before = parseFragment(input);
    const result = htmlMinifyOperation(input, "safe");
    const after = parseFragment(result.output);
    expect(result.valid).toBe(true);
    expect(textContent(after)).toBe(textContent(before));
    expect(result.output).toContain("<pre>  keep\n  this </pre>");
    expect(result.output).toContain("<textarea> a  b </textarea>");
    expect(result.output).toContain('<script>if (a < b) { x = "a  b"; }</script>');
    expect(result.output).toContain('<style>.x { content: "a  b"; }</style>');
  });

  it("removes only parser-visible safe whitespace/comments and preserves conditional comments", () => {
    const advanced = htmlMinifyOperation("<div>\n <p>A</p>\n <p>B</p>\n</div>", "advanced");
    expect(advanced.output).toBe("<div><p>A</p><p>B</p></div>");
    const conditional = htmlMinifyOperation("<div><!--[if IE]>x<![endif]--><p>A</p><!-- ordinary --></div>", "advanced");
    expect(conditional.output).toContain("<!--[if IE]>x<![endif]-->");
    expect(conditional.output).not.toContain("ordinary");
    expect(conditional.warnings).toHaveLength(1);
  });

  it("offers a separate readable HTML mode only for block-only structure, preserving mixed and sensitive text", () => {
    const input = '<section><p>A <strong>B</strong> C</p><p>D</p></section>';
    const readable = htmlMinifyOperation(input, "prettify");
    expect(readable.output).toBe('<section>\n  <p>A <strong>B</strong> C</p>\n  <p>D</p>\n</section>');
    expect(htmlMinifyOperation(readable.output, "prettify").output).toBe(readable.output);
    expect(readable.warnings.join(" ")).toMatch(/spazi e a-capo/u);
    expect(readable.whitespacePolicy).toMatch(/CSS whitespace selectors/u);
    const sensitive = '<div><span>Hello <strong>world</strong>!</span><pre>  keep\n  this </pre><script>var x="a  b";</script></div>';
    const parsed = htmlMinifyOperation(sensitive, "prettify");
    expect(parsed.output).toContain('Hello <strong>world</strong>!');
    expect(parsed.output).toContain('<pre>  keep\n  this </pre>');
    expect(parsed.output).toContain('<script>var x="a  b";</script>');
    expect(textContent(parseFragment(parsed.output))).toBe(textContent(parseFragment(sensitive)));
    expect(() => htmlMinifyOperation("<div/>", "unsupported")).toThrow(/INVALID_MODE/u);
  });

  it("refuses HTML parse errors and runs both tools through the shared developer seam", async () => {
    expect(() => htmlMinifyOperation("<div>\u0000</div>", "safe")).toThrow(/INVALID_HTML/u);
    const css = await runDeveloperWebTool("css-minifier", { text: "a { color: red; }" }) as Record<string, unknown>;
    const html = await runDeveloperWebTool("html-minifier", { text: "<p>A</p>", mode: "safe" }) as Record<string, unknown>;
    expect(css).toMatchObject({ valid: true, engineVersion: "developer-web-v1" });
    expect(html).toMatchObject({ valid: true, engineVersion: "developer-web-v1" });
  });
});
