import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
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
