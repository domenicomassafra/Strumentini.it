import { TableWorkbench } from "../table/TableWorkbench";
import { csvSortManifest } from "../../../tools/csv-sort/manifest";

export function CsvSortTool() {
  return <TableWorkbench toolId={csvSortManifest.id} title="Sort rows" description="Sort rows with stable, explicit comparators." mode="sort" manifest={csvSortManifest} />;
}
