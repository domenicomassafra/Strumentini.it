import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { XMLParser } from "fast-xml-parser";
import { parseXmlDocument } from "../src/engines/developer-web/structured-repair";
import { parseTabularXmlRoot } from "../src/engines/table/xml-parser-adapter";
import { parseCsvTable } from "../src/engines/table/csv";
import {
  XmlInterchangeError,
  xmlToCsv,
  xmlToJson,
  xmlToTabularTable,
  xmlToXlsx,
} from "../src/engines/table/xml-interchange";
import { xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

interface Fixture {
  json: Array<{ name: string; input: string; expected: Record<string, unknown> }>;
  tabular: Array<{
    name: string;
    input: string;
    rowPath?: string;
    expectedHeader: string[];
    expectedRows: string[][];
    expectedRowPath: string;
  }>;
  ambiguous: Array<{ name: string; input: string; code: string }>;
  hostile: Array<{ name: string; input: string; error: string }>;
}

const fixture = JSON.parse(await readFile("quality/fixtures/xml-interchange/vectors.json", "utf8")) as Fixture;

describe("ticket 169 — representable XML to JSON/CSV/XLSX mappings", () => {
  it("maps representable XML to deterministic JSON with explicit attribute/text/repeat rules", () => {
    for (const vector of fixture.json) {
      const result = xmlToJson(vector.input);
      expect(result.value, vector.name).toEqual(vector.expected);
      expect(JSON.parse(result.json), vector.name).toEqual(vector.expected);
      expect(result.mapping).toMatchObject({
        attributePrefix: "@",
        textKey: "#text",
        repeatedChildren: "array",
        mixedContent: "refuse",
        commentsAndProcessingInstructions: "refuse-except-xml-declaration",
        entityReferences: "decode-predefined-and-numeric",
      });
    }
  });

  it("maps only representable tabular shapes and exposes row/column/mapping summaries", () => {
    for (const vector of fixture.tabular) {
      const options = vector.rowPath === undefined ? {} : { rowPath: vector.rowPath };
      const result = xmlToTabularTable(vector.input, options);
      expect(result.table.header, vector.name).toEqual(vector.expectedHeader);
      expect(result.table.rows, vector.name).toEqual(vector.expectedRows);
      expect(result).toMatchObject({ rows: vector.expectedRows.length, columns: vector.expectedHeader.length });
      expect(result.mapping.rowPath, vector.name).toBe(vector.expectedRowPath);
      expect(result.mapping.columns.map(({ column }) => column), vector.name).toEqual(vector.expectedHeader);
      expect(result.mapping).toMatchObject({
        attributePrefix: "attr:",
        textKey: "#text",
        repeatedFields: "refuse",
        mixedContent: "refuse",
        nestedFields: "refuse",
      });
    }
  });

  it("requires an explicit row path for nested wrappers and refuses lossy ambiguity", () => {
    const nested = fixture.tabular.find(({ rowPath }) => rowPath !== undefined)!;
    expect(() => xmlToTabularTable(nested.input)).toThrowError(XmlInterchangeError);
    try {
      xmlToTabularTable(nested.input);
      throw new Error("expected row-path failure");
    } catch (error) {
      expect(error).toMatchObject({ code: "AMBIGUOUS_XML_MAPPING" });
    }

    for (const vector of fixture.ambiguous) {
      try {
        xmlToTabularTable(vector.input);
        throw new Error(`expected mapping refusal for ${vector.name}`);
      } catch (error) {
        expect(error, vector.name).toBeInstanceOf(XmlInterchangeError);
        expect((error as XmlInterchangeError).code, vector.name).toBe(vector.code);
      }
    }
    expect(() => xmlToJson("<root>before<child>value</child>after</root>"))
      .toThrow(/AMBIGUOUS_XML_MAPPING/u);
  });

  it("exports safe CSV with the same represented rows and columns", () => {
    const vector = fixture.tabular[0]!;
    const result = xmlToCsv(vector.input);
    const parsed = parseCsvTable(result.csv);
    expect(parsed.header).toEqual(vector.expectedHeader);
    expect(parsed.rows).toEqual(vector.expectedRows);
    expect(result).toMatchObject({
      rows: vector.expectedRows.length,
      columns: vector.expectedHeader.length,
      csvPolicy: "formula-like-cells-escaped",
    });
  });

  it("writes XLSX, reopens it through the ticket-161 reader, and proves mapped values/dimensions", async () => {
    const vector = fixture.tabular[0]!;
    const result = await xmlToXlsx(vector.input, { sheetName: "XML rows" });
    expect(result.reopen).toEqual({
      verified: true,
      selectedSheet: "XML rows",
      rows: vector.expectedRows.length,
      columns: vector.expectedHeader.length,
      policy: "xlsx-values-to-safe-csv",
    });
    expect(result.columnTypes).toEqual(vector.expectedHeader.map(() => "text"));

    const reopened = await xlsxToCsv(result.bytes);
    const table = parseCsvTable(reopened.csv);
    expect(table.header).toEqual(vector.expectedHeader);
    expect(table.rows).toEqual(vector.expectedRows);
  });

  it("inherits safe XML refusal for DTD/entities and performs no network requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network must not be used"));
    try {
      for (const vector of fixture.hostile) {
        expect(() => xmlToJson(vector.input), vector.name).toThrow(new RegExp(vector.error, "u"));
        expect(() => xmlToCsv(vector.input), vector.name).toThrow(new RegExp(vector.error, "u"));
        await expect(xmlToXlsx(vector.input), vector.name).rejects.toThrow(new RegExp(vector.error, "u"));
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("ticket 291 — pinned donor parity and hostile XML fence", () => {
  it("uses the donor for lossless rows and entities, and falls back on CRLF normalization", () => {
    const plain = '<rows><row id="001"><name>Marco</name></row></rows>';
    const plainValidated = parseXmlDocument(plain).root;
    const parsed = parseTabularXmlRoot(plain, plainValidated);
    expect(parsed).not.toBe(plainValidated);
    expect(parsed).toEqual(plainValidated);

    const entity = "<rows><row><name>A &amp; B</name></row></rows>";
    const entityValidated = parseXmlDocument(entity).root;
    expect(parseTabularXmlRoot(entity, entityValidated)).toEqual(entityValidated);

    const originalLineEndings = "<rows><row><name>line1\r\nline2</name></row></rows>";
    const validatedLineEndings = parseXmlDocument(originalLineEndings).root;
    expect(parseTabularXmlRoot(originalLineEndings, validatedLineEndings)).toBe(validatedLineEndings);
  });

  it("runs the donor after strict validation and retains entity spelling, order and repeated nodes", () => {
    const donor = vi.spyOn(XMLParser.prototype, "parse");
    const source = "<data><record z='003' a='001'><name>A &amp; B<![CDATA[ < C]]>&#x1F600;</name><tag>first</tag><tag>second</tag><empty/></record></data>";
    try {
      const before = source;
      const result = xmlToJson(source);
      expect(donor).toHaveBeenCalled();
      expect(source).toBe(before);
      expect(result.value).toEqual({ data: { record: {
        "@z": "003", "@a": "001", name: "A & B < C😀", tag: ["first", "second"], empty: null,
      } } });
      expect(Object.keys((result.value.data as Record<string, unknown>).record as object))
        .toEqual(["@z", "@a", "name", "tag", "empty"]);
    } finally {
      donor.mockRestore();
    }
  });

  it("preserves exact CRLF text and reserved XML element names when the donor cannot", () => {
    expect(xmlToJson("<root><value>line1\r\nline2</value></root>").value)
      .toEqual({ root: { value: "line1\r\nline2" } });
    expect(xmlToJson("<root><__proto__>safe</__proto__><constructor>ok</constructor></root>").value)
      .toEqual(JSON.parse('{"root":{"__proto__":"safe","constructor":"ok"}}'));
  });

  it("retains qualified namespace names, first-seen columns, and explicit rowPath selection", () => {
    const xml = "<rows><p:row xmlns:p='urn:test' id='001'><p:label>A</p:label></p:row><p:row xmlns:p='urn:test' id='002'><p:label>B</p:label><tail>C</tail></p:row></rows>";
    const mapped = xmlToTabularTable(xml, { rowPath: "p:row" });
    expect(mapped.table.header).toEqual(["attr:xmlns:p", "attr:id", "p:label", "tail"]);
    expect(mapped.table.rows).toEqual([["urn:test", "001", "A", ""], ["urn:test", "002", "B", "C"]]);
    expect(mapped.mapping.rowPath).toBe("/rows/p:row");
    expect(xmlToTabularTable(xml).table).toEqual(mapped.table);
    expect(() => xmlToTabularTable("<rows><p:row><name>A</name></p:row></rows>"))
      .toThrow(/AMBIGUOUS_XML_MAPPING.*undeclared XML qualified name/u);
    expect(() => xmlToJson("<rows><a:b:c/></rows>"))
      .toThrow(/AMBIGUOUS_XML_MAPPING.*unexpected or undeclared XML qualified name/u);
  });

  it("refuses lossy comments, processing instructions, mixed data and entity declarations", () => {
    const cases = [
      ["<root><!--comment--><item>ok</item></root>", "AMBIGUOUS_XML_MAPPING"],
      ["<root><item><?extra instruction?>ok</item></root>", "AMBIGUOUS_XML_MAPPING"],
      ["<root>left<item/>right</root>", "AMBIGUOUS_XML_MAPPING"],
      ["<!DOCTYPE root [<!ENTITY x 'value'>]><root>&x;</root>", "XML_EXTERNAL_ENTITY_DISABLED"],
      ["<root><row>&unknown;</row></root>", "XML_EXTERNAL_ENTITY_DISABLED"],
      ["<root><row>&#0;</row></root>", "INVALID_XML_ENTITY"],
    ] as const;
    for (const [xml, code] of cases) expect(() => xmlToJson(xml), xml).toThrow(code);
  });

  it("rejects bounds and invalid structure before calling the donor", () => {
    const donor = vi.spyOn(XMLParser.prototype, "parse");
    try {
      const cases = [
        ["<root><row>".repeat(70) + "</row></root>", "XML_TOO_DEEP"],
        ["<root>" + "x".repeat(1_000_001) + "</root>", "INPUT_TOO_LARGE"],
        ["<root><row></root>", "INVALID_XML"],
      ] as const;
      for (const [xml, code] of cases) expect(() => xmlToJson(xml), code).toThrow(code);
      expect(donor).not.toHaveBeenCalled();
    } finally {
      donor.mockRestore();
    }
  });
});
