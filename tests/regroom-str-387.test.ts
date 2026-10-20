import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/universal";
import { parseCsvTable, readBlobText } from "../src/engines/table/csv";
import {
  editCell387, exportEditableCsv387, parseEditable387,
} from "../src/engines/table/spreadsheet-edit-387";
import { csvToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

function independentCsv(text: string, delimiter = ","): string[][] {
  const process = spawnSync("python3", ["-c",
    "import csv,io,json,sys;print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.read(),newline=''),delimiter=sys.argv[1])),ensure_ascii=False))", delimiter],
  { input: text, encoding: "utf8", timeout: 5_000 });
  if (process.error || process.status !== 0) throw new Error(String(process.stderr || process.error));
  return JSON.parse(process.stdout) as string[][];
}

describe("#146 STR-387: edit/export fidelity and independent consumers", () => {
  it("opens CSV UTF-8, edits one cell and preserves local dates, leading zeros and >15-digit decimals", () => {
    const original = "id;data locale;precisone;nota\n00123;03/04/2026;123456789012345678901;Caffè\n00007;11/12/2026;0,000001;Roma";
    const input = parseEditable387(original);
    const edited = editCell387(input, 0, 3, "Città");
    expect(input.rows[0]?.[3]).toBe("Caffè");
    const exported = exportEditableCsv387(edited);
    expect(independentCsv(exported, ";")).toEqual([
      ["id", "data locale", "precisone", "nota"],
      ["00123", "03/04/2026", "123456789012345678901", "Città"],
      ["00007", "11/12/2026", "0,000001", "Roma"],
    ]);
    expect(parseCsvTable(exported).delimiter).toBe(";");
  });

  it.each(["=SUM(1,2)", "+cmd", "@SUM(1)", "-CMD()", "\t=1+1", "  =1+1", "\r+1"])(
    "refuses formula-like CSV cell %s without producing output", (poison) => {
      expect(() => exportEditableCsv387(editCell387(parseEditable387("id,value\n00123,ok"), 0, 1, poison)))
        .toThrow(/INVALID_INPUT.*Formula/u);
      expect(() => parseEditable387("id,value\n00123,\"" + poison.replaceAll("\"", "\"\"") + "\""))
        .toThrow();
    },
  );

  it("rejects dangerous headers, uneven rows and over-limit grids", () => {
    expect(() => parseEditable387("id,=WEBSERVICE(1)\n00123,x")).toThrow(/Formula/u);
    expect(() => parseEditable387("id,value\n00123")).toThrow(/irregolari/u);
    expect(() => parseEditable387("id,value\n" + "1,ok\n".repeat(201))).toThrow(/200 righe/u);
  });

  it("roundtrips XLSX through the distinct read-excel-file consumer with preserved source types", async () => {
    const original = await csvToXlsx(
      "id,importo,iso,locale,grande\n00123,12.50,2026-03-04,03/04/2026,123456789012345678901",
      { sheetName: "Dati", columnPolicies: [{ column: 1, type: "number" }, { column: 2, type: "date" }] },
    );
    const read = await xlsxToCsv(original.bytes, { refuseFormulaLikeText: true, strictEditing: true });
    expect(read.columnTypes).toEqual(["text", "number", "date", "text", "text"]);
    const changed = editCell387(parseEditable387(read.csv), 0, 0, "00007");
    const saved = await csvToXlsx(exportEditableCsv387(changed), {
      sheetName: read.selectedSheet,
      columnPolicies: read.columnTypes.map((type, column) => ({ column, type: type as "number" | "date" | "text" })),
    });
    const independent = await xlsxToCsv(saved.bytes);
    expect(independent.columnTypes).toEqual(read.columnTypes);
    expect(parseCsvTable(independent.csv).rows).toEqual([
      ["00007", "12.5", "2026-03-04", "03/04/2026", "123456789012345678901"],
    ]);
  });

  it("refuses XLSX formula-like literal, calculated cell and multi-sheet ambiguity", async () => {
    const literal = await csvToXlsx("id,label\n00123,=1+1");
    await expect(xlsxToCsv(literal.bytes, { refuseFormulaLikeText: true }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    const multi = await writeXlsxFile([
      { sheet: "Uno", data: [[{ value: "001", type: String }]] },
      { sheet: "Due", data: [[{ value: "002", type: String }]] },
    ]).toBlob();
    await expect(xlsxToCsv(await multi.arrayBuffer())).rejects.toMatchObject({ code: "SHEET_SELECTION_REQUIRED" });
  });

  it("refuses numeric display masks that would silently remove visible leading zeros", async () => {
    const formatted = await writeXlsxFile([
      [{ value: "id", type: String }],
      [{ value: 123, type: Number, format: "00000" }],
    ]).toBlob();
    await expect(xlsxToCsv(await formatted.arrayBuffer(), { strictEditing: true }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("reads valid accents and rejects malformed UTF-8 before edit/export", async () => {
    expect(parseEditable387(await readBlobText(new Blob([new TextEncoder().encode("nome\ncaffè")]))).rows)
      .toEqual([["caffè"]]);
    await expect(readBlobText(new Blob([Uint8Array.of(110, 111, 109, 101, 10, 0xe9)])))
      .rejects.toMatchObject({ code: "INVALID_ENCODING" });
  });
});
