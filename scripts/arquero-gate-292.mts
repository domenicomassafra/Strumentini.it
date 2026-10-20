/** Reproducible STR-292 donor gate. Run after `npm i --no-save --package-lock=false arquero@8.0.3`. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { parseCsvTable } from "../src/engines/table/csv";
import { groupCountTable, joinCsvTables, pivotTable, sortTable } from "../src/engines/table/operations";

const dependency = "arquero";
const aq = await import(dependency);
const fixture = JSON.parse(readFileSync(new URL("../quality/fixtures/csv-table-ops/vectors.json", import.meta.url), "utf8"));
const vector = (name: string) => fixture.transform_upgrade.find((entry: {case: string}) => entry.case === name);

const joined = vector("join-null-never-match");
const left = parseCsvTable(joined.left);
const right = parseCsvTable(joined.right);
const originalInputs = [structuredClone(left), structuredClone(right)];
const nativeJoin = aq.from(left.rows.map((row) => ({ id: row[0], left: row[1] })))
  .join_full(aq.from(right.rows.map((row) => ({ id: row[0], right: row[1] }))), ["id"]);
const legacyJoin = joinCsvTables(left, right, {
  leftKeyColumns: joined.left_key_columns,
  rightKeyColumns: joined.right_key_columns,
  joinType: "full",
  nullTokens: joined.null_tokens,
  emptyAsNull: joined.empty_as_null,
  nullKeyPolicy: "never-match",
});

const grouped = vector("group-casefold-null-and-numeric-policy");
const groupInput = parseCsvTable(grouped.input);
const originalGroupInput = structuredClone(groupInput);
const nativeGroup = aq.from(groupInput.rows.map((row) => ({ team: row[0], amount: row[1] })))
  .groupby("team").rollup({ total: (d: {amount: string}) => aq.op.sum(d.amount) });
const legacyGroup = groupCountTable(groupInput, {
  groupColumns: grouped.group_columns, countColumn: grouped.aggregate_column, aggregate: "sum",
  caseSensitive: grouped.case_sensitive, nullTokens: grouped.null_tokens, emptyAsNull: grouped.empty_as_null,
});

const pivoted = vector("pivot-casefold-null-groups");
const pivotInput = parseCsvTable(pivoted.input);
const originalPivotInput = structuredClone(pivotInput);
const nativePivot = aq.from(pivotInput.rows.map((row) => ({ team: row[0], quarter: row[1], amount: Number(row[2]) })))
  .groupby("team").pivot("quarter", { amount: (d: {amount: number}) => aq.op.sum(d.amount) });
const legacyPivot = pivotTable(pivotInput, {
  groupColumns: pivoted.group_columns, valueHeaderColumn: pivoted.value_header_column,
  aggregateColumn: pivoted.aggregate_column, aggregate: "sum", caseSensitive: pivoted.case_sensitive,
  nullTokens: pivoted.null_tokens, emptyAsNull: pivoted.empty_as_null,
});

// Source values retain their strings; the native conversion has no Italian decimal policy.
const nativeSort = aq.from([{id:"A",amount:"1,2"},{id:"B",amount:"2.5"},{id:"C",amount:"003"}])
  .orderby("amount").objects();
const legacySort = sortTable(parseCsvTable('id;amount\nA;1,2\nB;2.5\nC;003'), { column: 1, comparator: "numeric" });

const invalid = parseCsvTable("team,amount\nA,1\nA,oops");
let legacyInvalid = "accepted";
try { groupCountTable(invalid, { groupColumns: [0], countColumn: 1, aggregate: "sum" }); }
catch (error) { legacyInvalid = String(error); }
let donorInvalid = "accepted";
try {
  const rows = aq.from([{team:"A",amount:"1"},{team:"A",amount:"oops"}]).groupby("team")
    .rollup({sum:(d: {amount:string}) => aq.op.sum(d.amount)}).objects();
  donorInvalid = JSON.stringify(rows);
} catch (error) { donorInvalid = String(error); }

assert.equal(legacyJoin.table.rows.length, 5, "Legacy null keys must never match");
assert.equal(nativeJoin.objects().length, 3, "Direct donor joins NULL and empty keys");
assert.deepEqual(legacyGroup.table.rows, [["A", "3"], ["NULL", "7"]]);
assert.equal(nativeGroup.objects().length, 4, "Direct donor splits casefold/null groups");
assert.deepEqual(legacyPivot.table.header, ["team", "Q1", "Q2"]);
assert.equal(nativePivot.columnNames().length, 4, "Direct donor retains case-distinct pivot header");
assert.deepEqual(legacySort.table.rows.map((row) => row[0]), ["A", "B", "C"]);
assert.deepEqual(nativeSort.map((row: {id:string}) => row.id), ["C", "A", "B"]);
assert.match(legacyInvalid, /INVALID_NUMERIC_VALUE/);
assert.doesNotMatch(donorInvalid, /INVALID_NUMERIC_VALUE/);
assert.deepEqual([left, right], originalInputs, "Join must preserve both original tables");
assert.deepEqual(groupInput, originalGroupInput, "Group must preserve its source table");
assert.deepEqual(pivotInput, originalPivotInput, "Pivot must preserve its source table");
const collisions = parseCsvTable(`id,value\n${Array.from({length:1100}, () => "X,a").join("\n")}`);
assert.throws(() => joinCsvTables(collisions, collisions, {leftKeyColumns:[0],rightKeyColumns:[0]}), /TABLE_JOIN_EXPLOSION/, "Join cardinality must be rejected before materialization");

const size = 5_000;
const leftTable = { header: ["id", "left"], rows: Array.from({length:size}, (_,i)=>[String(i), `L${i}`]), delimiter:",", warnings:[] } as const;
const rightTable = { header: ["id", "right"], rows: Array.from({length:size}, (_,i)=>[String(i), `R${i}`]), delimiter:",", warnings:[] } as const;
const groupTable = {header:["team","amount"],rows:Array.from({length:20_000},(_,i)=>[String(i%400),String(i%9)]),delimiter:",",warnings:[]} as const;
const measures: Record<string,{ms:number;heapDeltaMiB:number;rows:number}> = {};
function bench(name:string,run:()=>number) {
  for(let i=0;i<2;i++) run();
  const times:number[]=[];
  let heapDelta=0;
  let outputRows=0;
  for(let i=0;i<5;i++) {
    global.gc?.();
    const before=process.memoryUsage().heapUsed;
    const start=performance.now();
    outputRows=run();
    times.push(performance.now()-start);
    heapDelta=Math.max(heapDelta,process.memoryUsage().heapUsed-before);
  }
  times.sort((a,b)=>a-b);
  measures[name]={ms:Math.round(times[2]!*100)/100,heapDeltaMiB:Math.round(heapDelta/1048576*100)/100,rows:outputRows};
}
bench("legacy-join",()=>joinCsvTables(leftTable as never,rightTable as never,{leftKeyColumns:[0],rightKeyColumns:[0]}).outputRows);
bench("arquero-join",()=>aq.from(leftTable.rows.map(row=>({id:row[0],left:row[1]})))
  .join(aq.from(rightTable.rows.map(row=>({id:row[0],right:row[1]}))),["id"]).objects().length);
bench("legacy-group",()=>groupCountTable(groupTable as never,{groupColumns:[0],countColumn:1,aggregate:"sum"}).groups);
bench("arquero-group",()=>aq.from(groupTable.rows.map(row=>({team:row[0],amount:Number(row[1])})))
  .groupby("team").rollup({value:(d:{amount:number})=>aq.op.sum(d.amount)}).objects().length);

console.log(JSON.stringify({
  release:"arquero@8.0.3", node:process.version,
  examples:{
    join:{expectedHeader:legacyJoin.table.header,nativeHeader:nativeJoin.columnNames(),expectedRows:legacyJoin.table.rows,nativeRows:nativeJoin.objects()},
    group:{expectedRows:legacyGroup.table.rows,nativeRows:nativeGroup.objects()},
    pivot:{expectedHeader:legacyPivot.table.header,expectedRows:legacyPivot.table.rows,nativeHeader:nativePivot.columnNames(),nativeRows:nativePivot.objects()},
    sort:{legacyIds:legacySort.table.rows.map(row=>row[0]),nativeIds:nativeSort.map((row:{id:string})=>row.id)},
    invalid:{legacy:legacyInvalid,donor:donorInvalid},
  }, measures,
},null,2));
