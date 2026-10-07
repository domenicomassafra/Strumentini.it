import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handoffCatalog } from "../src/generated/handoff-catalog";
import { parseCsvTable } from "../src/engines/table/csv";
import {
  TABLE_MAX_ROWS,
  estimateTableJoinRows,
  filterTable,
  groupCountTable,
  joinCsvTables,
  makeTableHandoff,
  pivotTable,
  selectTableColumns,
  sortTable,
  type TableJoinType,
} from "../src/engines/table/operations";
import { compatibleHandoffTargets, proposeHandoff } from "../src/runtime/handoff";
import type { ToolExecutionContext, ToolModule } from "../src/runtime/types";
import csvColumnSelectorModule from "../src/tools/csv-column-selector/module";
import csvFilterModule from "../src/tools/csv-filter/module";
import csvGroupCountModule from "../src/tools/csv-group-count/module";
import csvJoinModule from "../src/tools/csv-join/module";
import csvPivotLiteModule from "../src/tools/csv-pivot-lite/module";
import csvSortModule from "../src/tools/csv-sort/module";

interface TransformVector {
  case: string;
  operation: string;
  input?: string;
  left?: string;
  right?: string;
  column?: number;
  operator?: "equals";
  value?: string;
  comparator?: "numeric";
  nulls?: "last";
  group_columns?: number[];
  aggregate_column?: number;
  value_header_column?: number;
  left_key_columns?: number[];
  right_key_columns?: number[];
  case_sensitive?: boolean;
  null_tokens?: string[];
  empty_as_null?: boolean;
  null_key_policy?: "match" | "never-match";
  expected?: string;
  expected_ids?: string[];
  expected_output_rows?: number;
  expected_matched_rows?: number;
  expected_unmatched_left_rows?: number;
  expected_unmatched_right_rows?: number;
}

const fixture = JSON.parse(readFileSync(new URL("../quality/fixtures/csv-table-ops/vectors.json", import.meta.url), "utf8")) as {
  transform_upgrade: TransformVector[];
};
const goldFixture = JSON.parse(readFileSync(new URL("../quality/fixtures/data-table-gold/vectors.json", import.meta.url), "utf8")) as {
  tool_vectors: Array<{ tool_id: string; input: Record<string, unknown>; expected: Record<string, unknown> }>;
};

const upgradedModules: Readonly<Record<string, ToolModule>> = {
  "csv-column-selector": csvColumnSelectorModule,
  "csv-filter": csvFilterModule,
  "csv-sort": csvSortModule,
  "csv-group-count": csvGroupCountModule,
  "csv-join": csvJoinModule,
  "csv-pivot-lite": csvPivotLiteModule,
};
const executionContext: ToolExecutionContext = { defaults: {} };

function vector(name: string): TransformVector {
  const value = fixture.transform_upgrade.find(({ case: candidate }) => candidate === name);
  if (value === undefined) throw new Error(`missing transform fixture: ${name}`);
  return value;
}

describe("ticket 195 table transform upgrades", () => {
  it("keeps the existing Gold vectors green for all six upgraded public modules without rewriting receipts", async () => {
    const vectors = goldFixture.tool_vectors.filter(({ tool_id }) => tool_id in upgradedModules);
    expect(vectors.map(({ tool_id }) => tool_id).toSorted()).toEqual(Object.keys(upgradedModules).toSorted());
    for (const item of vectors) {
      const module = upgradedModules[item.tool_id];
      if (module === undefined) throw new Error(`missing module for ${item.tool_id}`);
      const actual = await module.run(item.input, executionContext);
      expect(actual, item.tool_id).toMatchObject(item.expected);
    }
  });

  it("keeps column selection row-stable and discloses chosen column names", () => {
    const table = parseCsvTable("id,name,score\n1,Ada,10\n2,Grace,20");
    const result = selectTableColumns(table, [2, 0]);
    expect(result.rowCountEffect).toEqual({ inputRows: 2, outputRows: 2, delta: 0 });
    expect(result.selectedColumnDisclosure).toEqual([
      { index: 2, name: "score" },
      { index: 0, name: "id" },
    ]);
    expect(result.policySummary).toMatch(/indice/u);
  });

  it("applies the fixture-declared filter null/case policy and reports row-count effects", () => {
    const item = vector("filter-explicit-null-policy");
    const result = filterTable(parseCsvTable(item.input!), {
      column: item.column!,
      operator: item.operator!,
      value: item.value!,
      caseSensitive: item.case_sensitive!,
      nullTokens: item.null_tokens!,
      emptyAsNull: item.empty_as_null!,
    });
    expect(result.table.rows.map((row) => row[0])).toEqual(item.expected_ids);
    expect(result.outputRows).toBe(item.expected_output_rows);
    expect(result.rowCountEffect).toEqual({ inputRows: 4, outputRows: 1, delta: -3 });
    expect(result.selectedColumn).toEqual({ index: 1, name: "status" });
    expect(result.nullPolicy).toEqual({ tokens: ["NULL"], emptyAsNull: true });
    expect(result.typePolicy).toEqual({ mode: "text", invalidValues: "literal" });
  });

  it("sorts mixed numeric/text/null values with invalid typed values explicitly treated as null", () => {
    const item = vector("numeric-sort-mixed-values-as-null");
    const result = sortTable(parseCsvTable(item.input!), {
      column: item.column!,
      comparator: item.comparator!,
      nulls: item.nulls!,
      nullTokens: item.null_tokens!,
      emptyAsNull: item.empty_as_null!,
    });
    expect(result.table.rows.map((row) => row[0])).toEqual(item.expected_ids);
    expect(result.invalidValues).toBe("as-null");
    expect(result.rowCountEffect.delta).toBe(0);
    expect(result.policySummary).toMatch(/non validi.*NULL/u);
  });

  it("groups case-folded/null keys and applies strict numeric aggregation policy", () => {
    const item = vector("group-casefold-null-and-numeric-policy");
    const result = groupCountTable(parseCsvTable(item.input!), {
      groupColumns: item.group_columns!,
      countColumn: item.aggregate_column!,
      aggregate: "sum",
      caseSensitive: item.case_sensitive!,
      nullTokens: item.null_tokens!,
      emptyAsNull: item.empty_as_null!,
    });
    expect(result.output).toBe(item.expected);
    expect(result.groupColumnDisclosure).toEqual([{ index: 0, name: "team" }]);
    expect(result.rowCountEffect).toEqual({ inputRows: 4, outputRows: 2, delta: -2 });
    expect(result.numericPolicy).toBe("ignore-null-reject-non-numeric");

    expect(() => groupCountTable(parseCsvTable("team,amount\nA,1\nA,oops"), {
      groupColumns: [0], countColumn: 1, aggregate: "sum", nullTokens: ["NULL"], emptyAsNull: true,
    })).toThrow(/INVALID_NUMERIC_VALUE/u);
  });

  it("applies explicit null-key policy to joins and discloses the complete estimate", () => {
    const item = vector("join-null-never-match");
    const options = {
      leftKeyColumns: item.left_key_columns!,
      rightKeyColumns: item.right_key_columns!,
      joinType: "full" as const,
      nullTokens: item.null_tokens!,
      emptyAsNull: item.empty_as_null!,
      nullKeyPolicy: item.null_key_policy!,
    };
    const left = parseCsvTable(item.left!);
    const right = parseCsvTable(item.right!);
    const estimate = estimateTableJoinRows(left, right, options);
    const result = joinCsvTables(left, right, options);

    expect(estimate.guardedBeforeMaterialization).toBe(true);
    expect(estimate.estimatedOutputRows).toBe(item.expected_output_rows);
    expect(result.outputRows).toBe(item.expected_output_rows);
    expect(result.matchedRows).toBe(item.expected_matched_rows);
    expect(result.unmatchedLeftRows).toBe(item.expected_unmatched_left_rows);
    expect(result.unmatchedRightRows).toBe(item.expected_unmatched_right_rows);
    expect(result.leftKeyDisclosure).toEqual([{ index: 0, name: "id" }]);
    expect(result.rightKeyDisclosure).toEqual([{ index: 0, name: "id" }]);
    expect(result.nullKeyPolicy).toBe("never-match");
  });

  it("rejects a duplicate-key join explosion from its estimate before output materialization", () => {
    const left = parseCsvTable(`id,left\n${Array.from({ length: 400 }, (_, index) => `same,L${index}`).join("\n")}`);
    const right = parseCsvTable(`id,right\n${Array.from({ length: 400 }, (_, index) => `same,R${index}`).join("\n")}`);
    const options = { leftKeyColumns: [0], rightKeyColumns: [0], joinType: "inner" as const };
    const estimate = estimateTableJoinRows(left, right, options);
    expect(estimate).toMatchObject({ estimatedOutputRows: 160_000, estimatedOutputCells: 640_000, matchedOutputRows: 160_000, guardedBeforeMaterialization: true, outputLimitRows: TABLE_MAX_ROWS });
    expect(() => joinCsvTables(left, right, options)).toThrow(/TABLE_JOIN_EXPLOSION: estimated 160000 rows/u);
  });

  it("property-style: join estimates equal materialized cardinality for bounded generated tables", () => {
    const joinTypes: readonly TableJoinType[] = ["inner", "left", "right", "full"];
    for (const leftSize of [0, 1, 4, 11]) {
      for (const rightSize of [0, 2, 5, 13]) {
        const left = parseCsvTable(`id,left\n${Array.from({ length: leftSize }, (_, index) => `${index % 3},L${index}`).join("\n")}`.trimEnd());
        const right = parseCsvTable(`id,right\n${Array.from({ length: rightSize }, (_, index) => `${index % 4},R${index}`).join("\n")}`.trimEnd());
        for (const joinType of joinTypes) {
          const options = { leftKeyColumns: [0], rightKeyColumns: [0], joinType };
          const estimate = estimateTableJoinRows(left, right, options);
          const result = joinCsvTables(left, right, options);
          expect(result.outputRows, `${leftSize}/${rightSize}/${joinType}`).toBe(estimate.estimatedOutputRows);
          expect(result.matchedRows, `${leftSize}/${rightSize}/${joinType}`).toBe(estimate.matchedOutputRows);
        }
      }
    }
  });

  it("pivots case-folded/null groups with explicit numeric/null policy", () => {
    const item = vector("pivot-casefold-null-groups");
    const result = pivotTable(parseCsvTable(item.input!), {
      groupColumns: item.group_columns!,
      valueHeaderColumn: item.value_header_column!,
      aggregateColumn: item.aggregate_column!,
      aggregate: "sum",
      caseSensitive: item.case_sensitive!,
      nullTokens: item.null_tokens!,
      emptyAsNull: item.empty_as_null!,
    });
    expect(result.output).toBe(item.expected);
    expect(result.groupColumnDisclosure).toEqual([{ index: 0, name: "team" }]);
    expect(result.valueHeaderColumnDisclosure).toEqual({ index: 1, name: "quarter" });
    expect(result.aggregateColumnDisclosure).toEqual({ index: 2, name: "amount" });
    expect(result.rowCountEffect).toEqual({ inputRows: 4, outputRows: 2, delta: -2 });
  });

  it("offers JSON and SQL only when the concrete table envelope is compatible", () => {
    const uniqueTable = parseCsvTable("id,name\n1,Ada");
    const uniqueEnvelope = makeTableHandoff("id,name\n1,Ada", uniqueTable);
    const uniqueTargets = compatibleHandoffTargets(uniqueEnvelope, handoffCatalog);
    const uniqueIds = new Set(uniqueTargets.map(({ target }) => target.id));
    expect(uniqueIds.has("csv-to-json")).toBe(true);
    expect(uniqueIds.has("csv-to-sql")).toBe(true);
    expect(uniqueTargets.every(({ target }) => proposeHandoff(uniqueEnvelope, target).compatible)).toBe(true);

    const duplicateTable = parseCsvTable("id,id\n1,Ada");
    const duplicatePayload = "id,id\n1,Ada";
    const duplicateEnvelope = makeTableHandoff(duplicatePayload, duplicateTable);
    const duplicateIds = new Set(compatibleHandoffTargets(duplicateEnvelope, handoffCatalog).map(({ target }) => target.id));
    expect(duplicateIds.has("csv-to-json")).toBe(true);
    expect(duplicateIds.has("csv-to-sql")).toBe(false);

    const oversizedValue = "x".repeat(2 * 1024 * 1024 + 1);
    const oversizedTable = { header: ["value"], rows: [[oversizedValue]], delimiter: ",", warnings: [] };
    const oversizedEnvelope = makeTableHandoff(`value\n${oversizedValue}`, oversizedTable);
    expect(compatibleHandoffTargets(oversizedEnvelope, handoffCatalog)).toEqual([]);
    expect(proposeHandoff(oversizedEnvelope, handoffCatalog.find(({ id }) => id === "csv-to-json")!)).toMatchObject({
      compatible: false,
      reason: expect.stringContaining("handoff limit"),
    });

    for (const xlsxTarget of handoffCatalog.filter(({ id }) => /xlsx/u.test(id))) {
      const proposal = proposeHandoff(uniqueEnvelope, xlsxTarget);
      expect(uniqueIds.has(xlsxTarget.id)).toBe(proposal.compatible);
    }
  });
});
