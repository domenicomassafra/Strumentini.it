import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { sortTable } from "../src/engines/table/operations";

describe("STR-388 numeric sorting with mixed Italian and dot decimals", () => {
  it("sorts decimal commas as numbers without losing duplicate rows or text", () => {
    const source = "nome;importo\nRosa;\"1,5\"\nAda;2\nLéa;\"1,25\"\nAda;2\nNoe;1.75";
    const sorted = sortTable(parseCsvTable(source), { column: 1, comparator: "numeric" });
    expect(sorted.table.rows.map((row) => row[0])).toEqual(["Léa", "Rosa", "Noe", "Ada", "Ada"]);
    expect(sorted.table.rows.map((row) => row[1])).toEqual(["1,25", "1,5", "1.75", "2", "2"]);
    expect(sorted.inputRows).toBe(5);
    expect(sorted.outputRows).toBe(5);
  });

  it("keeps malformed/mixed separator values after valid numbers without rewriting cells", () => {
    const source = "nome;importo\nA;1.5\nB;1,2,3\nC;0,5\nD;NULL";
    const sorted = sortTable(parseCsvTable(source), { column: 1, comparator: "numeric", nullTokens: ["NULL"] });
    expect(sorted.table.rows.map((row) => row[0])).toEqual(["C", "A", "B", "D"]);
    expect(sorted.table.rows.find((row) => row[0] === "B")?.[1]).toBe("1,2,3");
  });
});
