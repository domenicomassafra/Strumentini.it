/** STR-370: a CSV row cannot silently lose cells beyond the header width. */
import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { csvToXlsx, tableToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

describe("STR-370 CSV to XLSX ragged-row fidelity", () => {
  it("refuses an overwide CSV row rather than dropping its last value", async () => {
    const source = "id,city\n00123,Roma,IMPORTANT_CUSTOMER_NOTE\n";
    const parsed = parseCsvTable(source);
    expect(parsed.rows[0]).toEqual(["00123", "Roma", "IMPORTANT_CUSTOMER_NOTE"]);
    await expect(csvToXlsx(source)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses an overwide structured table passed directly to the XLSX engine", async () => {
    const parsed = parseCsvTable("id\n00123,=1+1\n");
    expect(parsed.rows[0]).toHaveLength(2);
    await expect(tableToXlsx(parsed)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("continues round-tripping ordinary rows and padding only missing trailing cells", async () => {
    const good = await csvToXlsx("id,city,notes\n00123,Roma,ok\n00007,Milano\n");
    const exported = await xlsxToCsv(good.bytes);
    expect(parseCsvTable(exported.csv).rows).toEqual([
      ["00123", "Roma", "ok"],
      ["00007", "Milano", ""],
    ]);
  });
});
