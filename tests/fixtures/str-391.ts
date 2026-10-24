import type { Pipeline391Recipe } from "../../src/engines/table/pipeline-391";

export const left391 = "id,gruppo\n1,si\n2,no\n3,si";
export const right391 = "id,tag\n1,α\n2,β\n3,γ";
export const recipe391: Pipeline391Recipe = { version: 1, steps: [
  { kind: "filter", table: "left", column: 1, operator: "equals", value: "si" },
  { kind: "join", leftKeyColumns: [0], rightKeyColumns: [0], joinType: "inner" },
  { kind: "export", format: "csv" },
] };
