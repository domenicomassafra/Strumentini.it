import { TableRelations390 } from "../table-relations-390/TableRelations390";
import { tableCompareManifest } from "../../../tools/table-compare/manifest";

export function TableCompareTool() {
  return <TableRelations390 kind="compare" manifest={tableCompareManifest} />;
}
