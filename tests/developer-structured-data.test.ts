import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  DeveloperWebError,
  jsonInferenceOperation,
  jsonRepairOperation,
  jsonStructuralDiffOperation,
  runDeveloperWebTool,
  xmlOperation,
} from "../src/engines/developer-web";

const fixture = JSON.parse(
  readFileSync(new URL("../quality/fixtures/developer-structured-data/vectors.json", import.meta.url), "utf8"),
) as {
  json_repair: Array<{ name: string; input: string; expected: { value: unknown; edit_reasons: string[] } }>;
  json_diff: Array<{ name: string; left: string; right: string; expected_kinds: string[] }>;
  json_inference: Array<{ name: string; input: string; root_name: string }>;
  xml: Array<{ name: string; input: string; pretty?: string; minified?: string }>;
  hostile: Array<{ name: string; input: string; expected_code: string }>;
};

describe("tickets 165-168 developer structured data", () => {
  it("repairs only deterministic JSON syntax and returns an ordered original-span edit log", () => {
    for (const vector of fixture.json_repair) {
      const result = jsonRepairOperation(vector.input) as {
        repaired: string;
        edits: Array<{ reason: string; startCharacter: number; endCharacterExclusive: number }>;
      };
      expect(JSON.parse(result.repaired), vector.name).toEqual(vector.expected.value);
      expect(result.edits.map(({ reason }) => reason), vector.name).toEqual(vector.expected.edit_reasons);
      expect(result.edits.every((edit, index) => edit.startCharacter < edit.endCharacterExclusive && (index === 0 || result.edits[index - 1]!.startCharacter <= edit.startCharacter))).toBe(true);
      const secondPass = jsonRepairOperation(result.repaired) as { changed: boolean; edits: unknown[]; repaired: string };
      expect(secondPass.changed, vector.name).toBe(false);
      expect(secondPass.edits, vector.name).toEqual([]);
      expect(secondPass.repaired, vector.name).toBe(result.repaired);
    }
    expect((jsonRepairOperation('{"literal":"// not a comment",}') as { repaired: string }).repaired).toBe('{"literal":"// not a comment"}');
  });

  it("refuses ambiguous JSON repair and keeps structured diagnostics", () => {
    const hostile = fixture.hostile.find(({ name }) => name === "ambiguous-json-missing-comma")!;
    try {
      jsonRepairOperation(hostile.input);
      throw new Error("expected repair refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(DeveloperWebError);
      expect((error as DeveloperWebError).code).toBe(hostile.expected_code);
      expect((error as DeveloperWebError).diagnostic).toMatchObject({ line: 1, path: "$" });
    }
  });

  it("diffs JSON with stable pointers, explicit kinds, duplicate caveat and bounded preview", () => {
    const vector = fixture.json_diff[0]!;
    const result = jsonStructuralDiffOperation(vector.left, vector.right) as {
      differences: Array<{ kind: string; path: string }>;
      preview: unknown[];
      previewTruncated: boolean;
      warnings: string[];
    };
    expect(new Set(result.differences.map(({ kind }) => kind))).toEqual(new Set(vector.expected_kinds));
    expect(result.differences).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "type", path: "/a" }),
      expect.objectContaining({ kind: "add", path: "/nested/new" }),
      expect.objectContaining({ kind: "remove", path: "/nested/old" }),
      expect.objectContaining({ kind: "order", path: "/items" }),
    ]));
    expect((jsonStructuralDiffOperation('{"a/b":1,"x~y":1}', '{"a/b":2,"x~y":2}') as { differences: Array<{ path: string }> }).differences.map(({ path }) => path)).toEqual(["/a~1b", "/x~0y"]);
    expect((jsonStructuralDiffOperation('{"a":1,"a":2}', '{"a":2}') as { warnings: string[] }).warnings).toHaveLength(1);

    const left = Object.fromEntries(Array.from({ length: 250 }, (_, index) => [`k${String(index).padStart(3, "0")}`, index]));
    const right = Object.fromEntries(Array.from({ length: 250 }, (_, index) => [`k${String(index).padStart(3, "0")}`, index + 1]));
    const large = jsonStructuralDiffOperation(JSON.stringify(left), JSON.stringify(right)) as { differences: unknown[]; preview: unknown[]; previewTruncated: boolean };
    expect(large.differences).toHaveLength(250);
    expect(large.preview).toHaveLength(200);
    expect(large.previewTruncated).toBe(true);
  });

  it("infers compiling TypeScript and a source-valid schema without prototype pollution", () => {
    const vector = fixture.json_inference[0]!;
    const prototype = Object.prototype as Record<string, unknown>;
    delete prototype.polluted;
    try {
      const result = jsonInferenceOperation(vector.input, vector.root_name, "both") as {
        typescript: string;
        schema: Record<string, unknown>;
        schemaJson: string;
        rootTypeName: string;
        sourceExampleValidatesSchema: boolean;
        limitations: string[];
      };
      expect(result.rootTypeName).toBe("_123_unsafe_root");
      expect(result.typescript).toContain('readonly "__proto__"');
      expect(result.typescript).toContain('readonly "constructor"');
      expect(result.sourceExampleValidatesSchema).toBe(true);
      expect(result.limitations.length).toBeGreaterThanOrEqual(3);
      expect(Object.hasOwn(result.schema.properties as object, "__proto__")).toBe(true);
      expect(prototype.polluted).toBeUndefined();
      const transpiled = ts.transpileModule(result.typescript, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        reportDiagnostics: true,
      });
      expect(transpiled.diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? []).toEqual([]);
      expect(() => JSON.parse(result.schemaJson)).not.toThrow();
    } finally {
      delete prototype.polluted;
    }
  });

  it("validates/formats/minifies XML without changing sensitive whitespace", () => {
    for (const vector of fixture.xml) {
      if (vector.pretty !== undefined) expect((xmlOperation(vector.input, "prettify", 2) as { output: string }).output, vector.name).toBe(vector.pretty);
      if (vector.minified !== undefined) expect((xmlOperation(vector.input, "minify", 2) as { output: string }).output, vector.name).toBe(vector.minified);
      expect(xmlOperation(vector.input, "validate")).toMatchObject({ valid: true, externalEntities: "disabled" });
    }
    expect((xmlOperation("<root> one <b>two</b> three </root>", "prettify") as { output: string }).output).toBe("<root> one <b>two</b> three </root>");
  });

  it("rejects DTD/external entities, unknown entities and malformed XML with exact diagnostics", () => {
    const hostile = fixture.hostile.find(({ name }) => name === "external-entity")!;
    for (const input of [hostile.input, "<root>&custom;</root>"]) {
      expect(() => xmlOperation(input, "validate")).toThrow(/XML_EXTERNAL_ENTITY_DISABLED/u);
    }
    try {
      xmlOperation("<root>\n  <item>value</root>", "prettify");
      throw new Error("expected XML failure");
    } catch (error) {
      expect(error).toBeInstanceOf(DeveloperWebError);
      expect((error as DeveloperWebError).code).toBe("INVALID_XML");
      expect((error as DeveloperWebError).diagnostic).toMatchObject({ line: 2, path: "/root/item" });
      expect(JSON.stringify((error as DeveloperWebError).diagnostic)).not.toContain("stack");
    }
    for (const input of [
      '<root a="1" a="2"/>',
      "<root>&#0;</root>",
      "<root>&#x110000;</root>",
      "<root>bad]]>text</root>",
      `<root>${String.fromCharCode(1)}</root>`,
    ]) {
      expect(() => xmlOperation(input, "validate"), input).toThrow();
    }

    for (const codePoint of [0x9, 0xA, 0xD, 0x20, 0xD7FF, 0xE000, 0xFFFD, 0x10000, 0x10FFFF]) {
      const input = `<root>&#x${codePoint.toString(16)};</root>`;
      expect(xmlOperation(input, "validate"), input).toMatchObject({ valid: true, externalEntities: "disabled" });
    }
    for (const codePoint of [0x0, 0x1, 0xD800, 0xDFFF, 0xFFFE, 0xFFFF, 0x110000]) {
      const input = `<root>&#x${codePoint.toString(16)};</root>`;
      expect(() => xmlOperation(input, "validate"), input).toThrow();
    }
  });

  it("runs the four new routes through the shared developer engine seam", async () => {
    const cases = [
      ["json-repair", { text: '{"a":1,}' }],
      ["json-structural-diff", { leftJson: '{"a":1}', rightJson: '{"a":2}' }],
      ["json-type-schema-inference", { json: '{"a":1}', typeName: "Root", mode: "both" }],
      ["xml-formatter-validator", { text: "<root><a/></root>", mode: "minify" }],
    ] as const;
    for (const [toolId, input] of cases) {
      const result = await runDeveloperWebTool(toolId, input) as Record<string, unknown>;
      expect(result.valid, toolId).toBe(true);
      expect(result.engineVersion, toolId).toBe("developer-web-v1");
    }
  });
});
