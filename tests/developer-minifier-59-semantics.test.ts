import { describe, expect, it, vi } from "vitest";
import { parseFragment } from "parse5";
import { cssMinifyOperation, htmlMinifyOperation } from "../src/engines/developer-web/minifiers";
import { parseXmlDocument, xmlOperation } from "../src/engines/developer-web/structured-repair";

/** Inspect parser nodes rather than comparing superficial output strings. */
function xmlLeafText(root: ReturnType<typeof parseXmlDocument>["root"]): string {
  function collect(node: typeof root | typeof root.children[number]): string {
    if (node.kind === "text" || node.kind === "cdata") return node.value;
    if (node.kind === "element") return node.children.map(collect).join("");
    return "";
  }
  return collect(root);
}

describe("#059 XML/CSS/HTML parser-backed corpus", () => {
  it.each([
    ["SVG text with inline space", '<svg xmlns="http://www.w3.org/2000/svg"><text><tspan>A</tspan> <tspan>B</tspan></text></svg>', "A B"],
    ["SVG text with emoji", '<svg xmlns="http://www.w3.org/2000/svg"><text><tspan>Caffè ☕</tspan>  <tspan>ok</tspan></text></svg>', "Caffè ☕  ok"],
    ["XHTML nested inline", '<p><b>A</b> <em>B</em> <strong>C</strong></p>', "A B C"],
    ["mixed nested text", '<root><div>start</div> <section><b>middle</b></section> <div>end</div></root>', "start middle end"],
    ["literal CDATA sibling", '<root><item><![CDATA[ A ]]></item> <item>B</item></root>', " A  B"],
    ["SVG whitespace-only text node", '<svg xmlns="http://www.w3.org/2000/svg"><text><tspan/> <tspan/></text></svg>', " "],
    ["SVG text node with only spaces", '<svg xmlns="http://www.w3.org/2000/svg"><text>   </text></svg>', "   "],
    ["prefixed SVG whitespace", '<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><svg:text> <svg:tspan/></svg:text></svg:svg>', " "],
  ])("preserves text-bearing XML subtree semantics: %s", (_name, source, expectedText) => {
    const sourceTree = parseXmlDocument(source);
    expect(xmlLeafText(sourceTree.root)).toBe(expectedText);
    for (const mode of ["minify", "prettify"] as const) {
      const result = xmlOperation(source, mode);
      const outputTree = parseXmlDocument(String(result.output));
      expect(xmlLeafText(outputTree.root)).toBe(expectedText);
      expect(String(result.output)).toContain(" ");
      expect(xmlOperation(String(result.output), mode).output).toBe(result.output);
      const bytes = new TextEncoder();
      expect(result.inputBytes).toBe(bytes.encode(source).byteLength);
      expect(result.outputBytes).toBe(bytes.encode(String(result.output)).byteLength);
      expect(result.savedBytes).toBe(Number(result.inputBytes) - Number(result.outputBytes));
    }
  });

  it("still compacts element-only XML and reports actual UTF-8 savings", () => {
    const input = '  <catalogo>  <a/>   <b id="caffè"/> </catalogo> \n';
    const compact = xmlOperation(input, "minify");
    expect(compact.output).toBe('<catalogo><a/><b id="caffè"/></catalogo>');
    expect(Number(compact.savedBytes)).toBeGreaterThan(0);
    expect(Number(compact.outputBytes)).toBeLessThan(Number(compact.inputBytes));
    expect(compact.savedPercent).toBeCloseTo(100 * Number(compact.savedBytes) / Number(compact.inputBytes), 1);
  });

  it("rejects malformed XML/XXE and never resolves remote references or executes embedded scripts", () => {
    const forbidden = '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "https://outside.invalid/payload">]><svg>&xxe;</svg>';
    for (const mode of ["validate", "minify", "prettify"]) expect(() => xmlOperation(forbidden, mode)).toThrow(/XML_EXTERNAL_ENTITY_DISABLED/);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Unexpected external request"); });
    try {
      const payload = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><image href="https://outside.invalid/icon.svg"/></svg>';
      const result = xmlOperation(payload, "minify");
      expect(parseXmlDocument(String(result.output)).root.name).toBe("svg");
      expect(result.output).toContain('href="https://outside.invalid/icon.svg"');
      expect(result.output).toContain("<script>alert(1)</script>");
      // This is textual XML formatting, not SVG sanitization, optimization, or preview.
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it("HTML and CSS stay parser-based and do not interpret potentially active external references", () => {
    const original = '<div><svg xmlns="http://www.w3.org/2000/svg"><script>window.NO_EXECUTE=true</script><image href="https://outside.invalid/a.svg" /></svg><pre>A  B</pre></div>';
    const converted = htmlMinifyOperation(original, "safe");
    const fragment = parseFragment(String(converted.output));
    expect(fragment.childNodes).toHaveLength(1);
    expect(converted.output).toContain("<script>window.NO_EXECUTE=true</script>");
    expect(converted.output).toContain("<pre>A  B</pre>");
    const style = cssMinifyOperation('/* note */ .a{content:"https://outside.invalid/x  y"; color: red }');
    expect(style.output).toContain('content:"https://outside.invalid/x  y"');
    expect(Number(style.savedBytes)).toBeGreaterThan(0);
  });
});
