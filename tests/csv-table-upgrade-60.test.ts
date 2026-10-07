import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { handoffCatalog } from "../src/generated/handoff-catalog";
import { cleanCsvText, dedupeCsvTable, parseCsvTable } from "../src/engines/table/csv";
import {
  filterTable,
  fixTableEncoding,
  groupCountTable,
  joinCsvTables,
  makeTableHandoff,
  pivotTable,
  sortTable,
} from "../src/engines/table/operations";
import { compatibleHandoffTargets } from "../src/runtime/handoff";

interface UpgradeRoute {
  tool_id: string;
  audit_record: string | null;
  covered_by: number[];
  upgrade: string;
  status: "COMPLETE" | "REFUSED";
}

interface UpgradeChecklist {
  route_count: number;
  handoff_policy: {
    json: string;
    sql: string;
    xlsx: string;
  };
  routes: UpgradeRoute[];
  refusals: Array<{ capability: string; decision: string; reason: string }>;
}

const checklist = JSON.parse(readFileSync(new URL("../quality/functional-audit/csv-table-upgrade-checklist.json", import.meta.url), "utf8")) as UpgradeChecklist;

describe("ticket 60 CSV/table upgrade gate", () => {
  it("has one explicit checklist row for every current table-csv/table-operations route", () => {
    const catalogRoutes = catalog
      .filter(({ engine }) => engine === "table-csv" || engine === "table-operations")
      .map(({ id }) => id)
      .toSorted();
    const checklistRoutes = checklist.routes.map(({ tool_id }) => tool_id).toSorted();

    expect(checklist.route_count).toBe(25);
    expect(checklistRoutes).toEqual(catalogRoutes);
    expect(new Set(checklistRoutes).size).toBe(checklist.route_count);
    expect(checklist.routes.every(({ status, upgrade }) => status === "COMPLETE" && upgrade.trim() !== "")).toBe(true);
  });

  it("links every original route to its existing audit record and traces later routes to their implementation tickets", () => {
    const newer = new Map<string, number>([
      ["csv-to-sql", 170], ["csv-splitter", 171], ["table-compare", 172],
      ["fatturapa-reader", 148], ["fatturapa-batch-csv", 149],
    ]);
    for (const route of checklist.routes) {
      const newTicket = newer.get(route.tool_id);
      if (newTicket !== undefined) {
        expect(route.audit_record, route.tool_id).toBeNull();
        expect(route.covered_by, route.tool_id).toContain(newTicket);
        continue;
      }
      expect(route.audit_record, route.tool_id).not.toBeNull();
      const auditUrl = new URL(`../${route.audit_record!}`, import.meta.url);
      expect(existsSync(auditUrl), route.tool_id).toBe(true);
      const audit = JSON.parse(readFileSync(auditUrl, "utf8")) as { toolId?: string };
      expect(audit.toolId, route.tool_id).toBe(route.tool_id);
    }
  });

  it("keeps cleaner, dedupe and encoding effects exact and non-coercive", () => {
    const cleaned = cleanCsvText("\uFEFFa,b\r\n1,2\r\n");
    expect(cleaned.output).toBe("a,b\n1,2\n");
    expect(cleaned.changes).toEqual({ strippedBom: true, normalizedRecordBreaks: 2 });
    expect(cleaned).toMatchObject({ affectedRows: 0, affectedCells: 0, dialect: { encoding: "utf-8", dynamicTyping: false } });

    const deduped = dedupeCsvTable(parseCsvTable("id,name\n1,Ada\n1,Ada\n2,Grace"), { mode: "whole-row" });
    expect(deduped).toMatchObject({ inputRows: 3, outputRows: 2, removedRows: 1, affectedRows: 1, affectedCells: 2 });
    expect(deduped.output).toBe("id,name\n1,Ada\n2,Grace");

    const source = "id,value\n00123,é\n";
    const bytes = new Uint8Array(2 + source.length * 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    for (let index = 0; index < source.length; index += 1) {
      const code = source.charCodeAt(index);
      bytes[2 + index * 2] = code & 0xff;
      bytes[3 + index * 2] = code >> 8;
    }
    const encoding = fixTableEncoding(bytes);
    expect(encoding.output).toBe(source);
    expect(encoding).toMatchObject({
      detectedEncoding: "utf-16le",
      bomRemoved: true,
      affectedRows: 0,
      affectedCells: 0,
      textChanges: { bomRemoved: true, normalizedLineEndings: 0, replacementCharacters: 0 },
    });
    expect(encoding.output).toContain("00123");
  });

  it("exposes key/null/type and row-count policy on filter, sort, group, join and pivot", () => {
    const source = parseCsvTable("team,key,amount\nA,1,10\na,2,NULL\nNULL,3,5\n,4,7");

    const filtered = filterTable(source, { column: 0, operator: "not-empty", nullTokens: ["NULL"], emptyAsNull: true, caseSensitive: false });
    expect(filtered).toMatchObject({
      inputRows: 4,
      outputRows: 2,
      rowCountEffect: { inputRows: 4, outputRows: 2, delta: -2 },
      selectedColumn: { index: 0, name: "team" },
      nullPolicy: { tokens: ["NULL"], emptyAsNull: true },
    });

    const sorted = sortTable(source, { column: 2, comparator: "numeric", nullTokens: ["NULL"], emptyAsNull: true });
    expect(sorted).toMatchObject({
      inputRows: 4,
      outputRows: 4,
      rowCountEffect: { delta: 0 },
      selectedColumn: { index: 2, name: "amount" },
      invalidValues: "as-null",
    });

    const grouped = groupCountTable(source, { groupColumns: [0], countColumn: 2, aggregate: "sum", caseSensitive: false, nullTokens: ["NULL"], emptyAsNull: true });
    expect(grouped.groupColumnDisclosure).toEqual([{ index: 0, name: "team" }]);
    expect(grouped).toMatchObject({ inputRows: 4, outputRows: 2, nullKeys: "group", numericPolicy: "ignore-null-reject-non-numeric" });

    const joined = joinCsvTables(
      parseCsvTable("id,left\n1,a\nNULL,n"),
      parseCsvTable("id,right\n1,x\nNULL,m"),
      { leftKeyColumns: [0], rightKeyColumns: [0], joinType: "full", nullTokens: ["NULL"], emptyAsNull: true, nullKeyPolicy: "never-match" },
    );
    expect(joined.leftKeyDisclosure).toEqual([{ index: 0, name: "id" }]);
    expect(joined.rightKeyDisclosure).toEqual([{ index: 0, name: "id" }]);
    expect(joined).toMatchObject({ outputRows: 3, unmatchedLeftRows: 1, unmatchedRightRows: 1, nullKeyPolicy: "never-match" });
    expect(joined.estimate.guardedBeforeMaterialization).toBe(true);

    const pivoted = pivotTable(parseCsvTable("team,q,amount\nA,Q1,2\na,q1,3\nNULL,Q2,4\n,Q2,5"), {
      groupColumns: [0], valueHeaderColumn: 1, aggregateColumn: 2, aggregate: "sum", caseSensitive: false, nullTokens: ["NULL"], emptyAsNull: true,
    });
    expect(pivoted.groupColumnDisclosure).toEqual([{ index: 0, name: "team" }]);
    expect(pivoted).toMatchObject({ inputRows: 4, outputRows: 2, nullKeys: "group", numericPolicy: "ignore-null-reject-non-numeric" });
  });

  it("offers only real JSON/SQL targets and explicitly refuses XLSX because no compatible target exists", () => {
    const xlsxTargets = handoffCatalog.filter(({ id, route, name }) => /xlsx/iu.test(`${id} ${route} ${name}`));
    expect(xlsxTargets).toEqual([]);
    expect(checklist.handoff_policy.xlsx).toBe("REFUSED_NO_TARGET_IN_CURRENT_CATALOG");
    expect(checklist.refusals).toContainEqual(expect.objectContaining({ capability: "XLSX handoff", decision: "REFUSED" }));

    const unique = parseCsvTable("id,name\n1,Ada");
    const uniqueEnvelope = makeTableHandoff("id,name\n1,Ada", unique);
    const uniqueTargets = new Set(compatibleHandoffTargets(uniqueEnvelope, handoffCatalog).map(({ target }) => target.id));
    expect(uniqueTargets.has("csv-to-json")).toBe(true);
    expect(uniqueTargets.has("csv-to-sql")).toBe(true);

    const duplicate = parseCsvTable("id,id\n1,Ada");
    const duplicateEnvelope = makeTableHandoff("id,id\n1,Ada", duplicate);
    const duplicateTargets = new Set(compatibleHandoffTargets(duplicateEnvelope, handoffCatalog).map(({ target }) => target.id));
    expect(duplicateTargets.has("csv-to-json")).toBe(true);
    expect(duplicateTargets.has("csv-to-sql")).toBe(false);
  });

  it("renders exact change-effect labels on cleaner/dedupe/encoding result surfaces", () => {
    const cleanerSource = readFileSync(new URL("../src/components/tools/csv-cleaner/CsvCleanerTool.tsx", import.meta.url), "utf8");
    const dedupeSource = readFileSync(new URL("../src/components/tools/csv-dedupe/CsvDedupeTool.tsx", import.meta.url), "utf8");
    const workbenchSource = readFileSync(new URL("../src/components/tools/table/TableWorkbench.tsx", import.meta.url), "utf8");

    expect(cleanerSource).toContain("Righe dati modificate");
    expect(cleanerSource).toContain("Celle modificate");
    expect(dedupeSource).toContain("Righe dati interessate");
    expect(dedupeSource).toContain("Celle rimosse");
    expect(workbenchSource).toContain("interruzioni riga normalizzate");
    expect(workbenchSource).toContain("caratteri sostitutivi");
  });
});
