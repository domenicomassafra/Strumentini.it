import { describe, expect, it, vi } from "vitest";
import { parseFragment } from "parse5";
import * as cssTree from "css-tree";
import { cssMinifyOperation, htmlMinifyOperation } from "../src/engines/developer-web/minifiers";
import { jsonFormatterOperation } from "../src/engines/developer-web/structured-data";
import { parseXmlDocument, xmlOperation } from "../src/engines/developer-web/structured-repair";

function utf8(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Includes comments and whitespace, unlike a textContent-only equality test. */
function fragmentTree(source: string): unknown {
  type Node = { nodeName?: string; data?: string; value?: string; tagName?: string; attrs?: Array<{ name: string; value: string }>; childNodes?: Node[] };
  function visit(node: Node): unknown {
    return [node.nodeName, node.tagName ?? null, node.data ?? node.value ?? null,
      (node.attrs ?? []).map(({ name, value }) => [name, value]), (node.childNodes ?? []).map(visit)];
  }
  return visit(parseFragment(source) as Node);
}

const htmlDirectives = [
  { name: "Knockout binding", markup: "<!--ko if: show--><span>Visibile</span><!--/ko-->" },
  { name: "SSI include", markup: '<!--#include virtual="/frammento.html" --><p>Contenuto</p>' },
  { name: "React suspense markers", markup: "<!--$--><b>In caricamento</b><!--/$-->" },
  { name: "Angular template markers", markup: "<!--ngIf: visible--><span>Qui</span><!--/ng-->" },
  { name: "Astro hydration comments", markup: "<!--astro:component--><section>Render</section>" },
  { name: "IE conditional", markup: "<!--[if IE]>supporto<![endif]--><span>Altro</span>" },
];

describe("#059 next acceptance: HTML functional comments and real structured corpora", () => {
  it.each(htmlDirectives)("keeps functional $name in BOTH HTML minify modes", ({ markup }) => {
    const source = `<main>${markup}</main>`;
    for (const mode of ["safe", "advanced"] as const) {
      const result = htmlMinifyOperation(source, mode);
      expect(fragmentTree(result.output)).toEqual(fragmentTree(source));
      expect(htmlMinifyOperation(result.output, mode).output).toBe(result.output);
      expect(result.outputBytes).toBe(utf8(result.output));
      expect(result.savedBytes).toBe(utf8(source) - utf8(result.output));
      if (mode === "advanced") expect(result.warnings.join(" ")).toMatch(/Direttiva/u);
    }
  });

  it("safe HTML retains arbitrary comments; advanced removes ordinary comments with a disclosed lossy policy", () => {
    const input = "<div><!-- ordinary user note --><p>È ancora qui</p></div>";
    const safe = htmlMinifyOperation(input, "safe");
    expect(safe.output).toBe(input);
    expect(safe.commentPolicy).toMatch(/Preserve all comments/u);
    const advanced = htmlMinifyOperation(input, "advanced");
    expect(advanced.output).toBe("<div><p>È ancora qui</p></div>");
    expect(advanced.commentPolicy).toMatch(/lossy/u);
    expect(advanced.savedBytes).toBe(utf8(input) - utf8(advanced.output));
    expect(htmlMinifyOperation(advanced.output, "advanced").output).toBe(advanced.output);
  });

  it("leaves comments in foreign SVG/MathML subtree intact in advanced HTML, but never optimizes SVG", () => {
    const markup = '<main><svg xmlns="http://www.w3.org/2000/svg"><!-- not decorative for custom consumers --><text>A  B</text><script>globalThis.unsafeExecuted=true</script><image href="https://outside.invalid/p.svg"></image></svg><math><mtext> x </mtext><!-- formula meta --></math></main>';
    const oldValue = (globalThis as { unsafeExecuted?: boolean }).unsafeExecuted;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network attempt"); });
    try {
      for (const mode of ["safe", "advanced", "prettify"]) {
        const result = htmlMinifyOperation(markup, mode);
        expect(result.output).toContain("not decorative for custom consumers");
        expect(result.output).toContain("formula meta");
        expect(result.output).toContain("globalThis.unsafeExecuted=true");
        expect(result.output).toContain("https://outside.invalid/p.svg");
        expect(htmlMinifyOperation(result.output, mode).output).toBe(result.output);
        expect(result.scriptStylePolicy).toMatch(/never regex-rewritten/);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      expect((globalThis as { unsafeExecuted?: boolean }).unsafeExecuted).toBe(oldValue);
    } finally { fetchSpy.mockRestore(); }
  });

  it.each([
    ['@layer base { .card { color: rebeccapurple; --spacing: 1rem  2rem; content: "a  b"; } }', "--spacing:1rem 2rem"],
    ['@media (min-width: 32em) { .banner::after {content: "https://example.invalid/a  b";} }', '"https://example.invalid/a  b"'],
    ['/*! retained license */ .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }', "/*! retained license */"],
    ['.data {background-image: url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"); content:"<script>x</script>"}', 'content:"<script>x</script>"'],
  ])("round-trips CSS parser-approved stylesheet through minify & prettify without executing code", (source, expected) => {
    const minified = cssMinifyOperation(source, "minify");
    const pretty = cssMinifyOperation(source, "prettify");
    const canonical = cssTree.generate(cssTree.parse(source, { parseCustomProperty: true }));
    expect(minified.output).toBe(canonical);
    expect(cssMinifyOperation(minified.output, "minify").output).toBe(minified.output);
    expect(cssMinifyOperation(pretty.output, "prettify").output).toBe(pretty.output);
    expect(cssMinifyOperation(pretty.output, "minify").output).toBe(minified.output);
    expect(minified.output).toContain(expected);
    for (const result of [minified, pretty]) {
      expect(result.inputBytes).toBe(utf8(source));
      expect(result.outputBytes).toBe(utf8(result.output));
      expect(result.savedBytes).toBe(utf8(source) - utf8(result.output));
    }
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><text><tspan>Caffè</tspan> <tspan>☕</tspan></text></svg>',
    '<?xml version="1.0"?><root xml:space="preserve"><a>  x  </a>   <b>y</b></root>',
    '<feed><title> Notizie </title><!-- metadati --><entry><![CDATA[<b> A </b>]]></entry></feed>',
  ])("keeps XML text/CDATA/PI and whitespace context through parser-backed minify/prettify", (source) => {
    const sourceTree = parseXmlDocument(source);
    for (const mode of ["minify", "prettify"] as const) {
      const result = xmlOperation(source, mode);
      if (typeof result.output !== "string") throw new Error("XML formatter returned non-text output");
      const tree = parseXmlDocument(result.output);
      expect(tree.root.name).toBe(sourceTree.root.name);
      expect(tree.root.children).toEqual(sourceTree.root.children);
      expect(tree.before.filter((node) => node.kind !== "text")).toEqual(sourceTree.before.filter((node) => node.kind !== "text"));
      expect(xmlOperation(result.output, mode).output).toBe(result.output);
      expect(result.savedBytes).toBe(utf8(source) - utf8(result.output));
      expect(result.whitespacePolicy).toMatch(/may discard/);
    }
  });

  it("discloses JSON duplicate-key lossiness and stable Unicode byte accounting", () => {
    const source = '{ "caffè": "☕", "x": 1, "x": 2 }';
    const transformed = jsonFormatterOperation(source, 2, false, "minify");
    if (typeof transformed.formatted !== "string") throw new Error("JSON formatter returned non-text output");
    expect(transformed.duplicateKeys).toEqual(["x"]);
    expect(transformed.warnings).toHaveLength(1);
    expect(transformed.formatted).toBe('{"caffè":"☕","x":2}');
    expect(transformed.inputBytes).toBe(utf8(source));
    expect(transformed.outputBytes).toBe(utf8(transformed.formatted));
    expect(jsonFormatterOperation(transformed.formatted, 2, false, "minify").formatted).toBe(transformed.formatted);
  });
});
