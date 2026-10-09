import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import * as cssTree from "css-tree";
import { parse, parseFragment } from "parse5";
import { cssMinifyOperation, htmlMinifyOperation } from "../src/engines/developer-web/minifiers";
import { jsonFormatterOperation } from "../src/engines/developer-web/structured-data";
import { xmlOperation } from "../src/engines/developer-web/structured-repair";
import { css059, html059, json059, unknownDirective059, xml059 } from "./fixtures/minifier-059-real-corpus";

const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

type HtmlNode = {
  nodeName?: string;
  tagName?: string;
  value?: string;
  data?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
  content?: HtmlNode;
};

/** Distinguishes text/comment/doctype nodes, attributes and template.content. */
function htmlDom(source: string): unknown {
  const root = /<!doctype\s/iu.test(source) ? parse(source) : parseFragment(source);
  function visit(node: HtmlNode): unknown {
    return {
      node: node.nodeName,
      tag: node.tagName ?? null,
      text: node.value ?? node.data ?? null,
      attrs: (node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]),
      children: (node.childNodes ?? []).map(visit),
      template: node.content === undefined ? null : visit(node.content),
    };
  }
  return visit(root);
}

// Independent standard-library XML parser. Its DOM (including CDATA and text
// spacing) is compared instead of reusing our application's XML parse tree.
const pythonXmlOracle = String.raw`
import json, sys, xml.dom.minidom as dom
before, after = json.load(sys.stdin)
def canonical(node):
    attrs = []
    if node.attributes:
        attrs = sorted((a.namespaceURI, a.localName, a.value) for a in (node.attributes.item(i) for i in range(node.attributes.length)))
    return (node.nodeType, node.namespaceURI, node.localName, node.data if node.nodeType in (3, 4, 8, 7) else None, attrs, [canonical(child) for child in node.childNodes])
def root_xml(s):
    return canonical(dom.parseString(s).documentElement)
print(json.dumps([root_xml(before), root_xml(after)], ensure_ascii=False))
`;

function independentXmlRoots(source: string, output: string): [unknown, unknown] {
  const result = spawnSync("python3", ["-c", pythonXmlOracle], {
    input: JSON.stringify([source, output]), encoding: "utf8", timeout: 5000,
    maxBuffer: 512 * 1024,
  });
  if (result.status !== 0) throw new Error(`Independent XML parser failed: ${result.stderr || result.error?.message}`);
  return JSON.parse(result.stdout) as [unknown, unknown];
}

function assertSizeAccounting(source: string, output: string, result: { inputBytes: number; outputBytes: number; savedBytes: number; savedPercent: number }) {
  expect(result.inputBytes).toBe(bytes(source));
  expect(result.outputBytes).toBe(bytes(output));
  expect(result.savedBytes).toBe(bytes(source) - bytes(output));
  expect(result.savedPercent).toBeCloseTo(bytes(source) === 0 ? 0 : 100 * result.savedBytes / bytes(source), 2);
}

describe("#059 real-world structured minimizer corpus and adversarial refusal", () => {
  it.each(html059)("safe HTML roundtrips whole parser DOM, including template content: $name", ({ source }) => {
    const first = htmlMinifyOperation(source, "safe");
    expect(htmlDom(first.output)).toEqual(htmlDom(source));
    expect(htmlMinifyOperation(first.output, "safe").output).toBe(first.output);
    expect(first.commentPolicy).toMatch(/Preserve all comments/u);
    assertSizeAccounting(source, first.output, first);
  });

  it("advanced HTML preserves known React, Gutenberg and Svelte template delimiters", () => {
    const recognized = "<article><!--ko if: show--><!--$--><p>A</p><!--/$--><!--/ko--></article>";
    const advanced = htmlMinifyOperation(recognized, "advanced");
    expect(htmlDom(advanced.output)).toEqual(htmlDom(recognized));
    expect(advanced.warnings.join(" ")).toMatch(/Direttiva/u);

    const safeUnknown = htmlMinifyOperation(unknownDirective059, "safe");
    expect(htmlDom(safeUnknown.output)).toEqual(htmlDom(unknownDirective059));
    const advancedUnknown = htmlMinifyOperation(unknownDirective059, "advanced");
    expect(htmlDom(advancedUnknown.output)).toEqual(htmlDom(unknownDirective059));
    expect(advancedUnknown.output).toContain("wp:paragraph");
    expect(advancedUnknown.output).toContain("svelte-h0");
    expect(htmlMinifyOperation(advancedUnknown.output, "advanced").output).toBe(advancedUnknown.output);
    expect(advancedUnknown.commentPolicy).toMatch(/lossy for unknown/u);
    // Other unknown comment-based grammars remain intentionally lossy in advanced.
  });

  it.each(css059)("CSS parser roundtrip and deterministic formatted output: $name", ({ source, requiredTokens }) => {
    const sourceCanonical = cssTree.generate(cssTree.parse(source, { parseCustomProperty: true }));
    const minified = cssMinifyOperation(source, "minify");
    const readable = cssMinifyOperation(source, "prettify");
    expect(minified.output).toBe(sourceCanonical);
    expect(cssTree.generate(cssTree.parse(readable.output, { parseCustomProperty: true }))).toBe(sourceCanonical);
    expect(cssMinifyOperation(minified.output).output).toBe(minified.output);
    expect(cssMinifyOperation(readable.output, "prettify").output).toBe(readable.output);
    for (const token of requiredTokens) expect(minified.output).toContain(token);
    assertSizeAccounting(source, minified.output, minified);
    assertSizeAccounting(source, readable.output, readable);
  });

  it.each(xml059)("independent Python XML DOM root parity and stable output: $name", ({ source }) => {
    for (const mode of ["minify", "prettify"] as const) {
      const transformed = xmlOperation(source, mode);
      if (typeof transformed.output !== "string") throw new Error("Expected a text XML artifact");
      const [inputRoot, outputRoot] = independentXmlRoots(source, transformed.output);
      expect(outputRoot).toEqual(inputRoot);
      expect(xmlOperation(transformed.output, mode).output).toBe(transformed.output);
      assertSizeAccounting(source, transformed.output, transformed as { inputBytes: number; outputBytes: number; savedBytes: number; savedPercent: number });
    }
  });

  it("XML element-only whitespace remains an explicitly lossy opt-in transform", () => {
    const source = "<app><header/> <main/>  <footer/></app>";
    const minified = xmlOperation(source, "minify");
    expect(minified.output).toBe("<app><header/><main/><footer/></app>");
    expect(independentXmlRoots(source, String(minified.output))[0]).not.toEqual(independentXmlRoots(source, String(minified.output))[1]);
    expect(minified.whitespacePolicy).toMatch(/may discard whitespace-only nodes/u);
  });

  it.each(json059)("JSON roundtrips native JSON structures without executing markup: $name", ({ source }) => {
    for (const mode of ["minify", "prettify"] as const) {
      const output = jsonFormatterOperation(source, 2, false, mode);
      if (typeof output.formatted !== "string") throw new Error("Expected JSON text artifact");
      expect(JSON.parse(output.formatted)).toEqual(JSON.parse(source));
      expect(jsonFormatterOperation(output.formatted, 2, false, mode).formatted).toBe(output.formatted);
      expect(output.inputBytes).toBe(bytes(source));
      expect(output.outputBytes).toBe(bytes(output.formatted));
      expect(output.byteDelta).toBe(bytes(output.formatted) - bytes(source));
    }
  });

  it("JSON duplicate keys and __proto__ are explicit parsed-data limitations, not code execution", () => {
    const source = '{"__proto__":{"polluted":true},"name":"old","name":"new"}';
    const output = jsonFormatterOperation(source, 2, false, "minify");
    expect(output.duplicateKeys).toEqual(["name"]);
    expect(output.warnings).toHaveLength(1);
    expect(JSON.parse(String(output.formatted))).toMatchObject({ name: "new" });
    expect(Object.hasOwn(JSON.parse(String(output.formatted)), "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("refuses invalid JSON, XML external entities, malformed CSS and invalid HTML without network access", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("NETWORK_WAS_CALLED"); });
    const initial = (globalThis as Record<string, unknown>).__MUST_NOT_RUN__;
    try {
      expect(() => jsonFormatterOperation('{"unterminated":', 2, false, "minify")).toThrow(/INVALID_JSON/u);
      expect(() => xmlOperation('<!DOCTYPE svg [<!ENTITY e SYSTEM "https://outside.invalid/a">]><svg>&e;</svg>', "minify")).toThrow(/XML_EXTERNAL_ENTITY_DISABLED/u);
      expect(() => xmlOperation('<x>&#0;</x>', "minify")).toThrow(/INVALID_XML_ENTITY/u);
      expect(() => cssMinifyOperation("a{content: 'unterminated}")).toThrow(/INVALID_CSS/u);
      expect(() => htmlMinifyOperation("<div>\u0000</div>", "safe")).toThrow(/INVALID_HTML/u);
      for (const { source } of xml059) xmlOperation(source, "minify");
      for (const { source } of html059) htmlMinifyOperation(source, "safe");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect((globalThis as Record<string, unknown>).__MUST_NOT_RUN__).toBe(initial);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
