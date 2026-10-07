import { TableWorkbench } from "../table/TableWorkbench";
import { tableCompareManifest } from "../../../tools/table-compare/manifest";

export function TableCompareTool() {
  return <TableWorkbench toolId={tableCompareManifest.id} title="Table Compare" description="Compare two CSV tables by explicit keys and columns." mode="compare" manifest={tableCompareManifest} />;
}
