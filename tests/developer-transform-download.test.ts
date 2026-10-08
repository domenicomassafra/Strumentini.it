import { describe, expect, it } from "vitest";
import { developerTransformDownload } from "../src/runtime/developer-transform-download";
import { cssMinifyOperation, htmlMinifyOperation, jsonFormatterOperation, xmlOperation } from "../src/engines/developer-web";
import { createOutputArtifactDescriptor } from "../src/runtime/output-artifact";

describe("ticket 59 — raw transformed file export", () => {
  it("returns the actual parser-approved output, UTF-8 byte counts and correct names/MIME", () => {
    const fixtures = [
      ["json-formatter", '{ "uno": "à" }', jsonFormatterOperation('{ "uno": "à" }', 2, false, "minify"), "json", "application/json"],
      ["xml-formatter-validator", '<root> <a/> </root>', xmlOperation('<root> <a/> </root>', "minify"), "xml", "application/xml"],
      ["css-minifier", 'p { color: red; }', cssMinifyOperation('p { color: red; }'), "css", "text/css"],
      ["html-minifier", '<div> <p>hello</p> </div>', htmlMinifyOperation('<div> <p>hello</p> </div>', "safe"), "html", "text/html"],
    ] as const;
    for (const [id, input, result, ext, mime] of fixtures) {
      const transformed = developerTransformDownload(id, result, input);
      expect(transformed).not.toBeNull();
      expect(transformed!.filename).toBe(`${id}-risultato.${ext}`);
      expect(transformed!.mime).toBe(mime);
      expect(transformed!.output).toBe(id === "json-formatter" ? result.formatted : result.output);
      expect(transformed!.inputBytes).toBe(new TextEncoder().encode(input).length);
      expect(transformed!.outputBytes).toBe(new TextEncoder().encode(transformed!.output).length);
      expect(transformed!.savedBytes).toBe(transformed!.inputBytes - transformed!.outputBytes);
      const artifact = createOutputArtifactDescriptor({
        kind: transformed!.kind, name: transformed!.filename, mime,
        bytes: new TextEncoder().encode(transformed!.output),
        verification: { state: "verified", verifiedMime: mime, method: "parser completed" },
        fidelity: "structural", fidelityNote: "Parsed, locally transformed text",
      });
      expect(artifact.download.ready, id).toBe(true);
    }
  });

  it("never offers a transformed download for validation-only/error/non-transform results", () => {
    expect(developerTransformDownload("xml-formatter-validator", { valid: true, mode: "validate" }, "<a/>")).toBeNull();
    expect(developerTransformDownload("json-formatter", { valid: false, formatted: "unsafe" }, "bad")).toBeNull();
    expect(developerTransformDownload("css-minifier", { valid: true, output: {} }, "a{}")).toBeNull();
    expect(developerTransformDownload("unrelated", { valid: true, output: "abc" }, "abc")).toBeNull();
  });
});
