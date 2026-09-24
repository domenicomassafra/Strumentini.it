import { TableWorkbench } from "../table/TableWorkbench";
import { csvFilterManifest } from "../../../tools/csv-filter/manifest";

export function CsvFilterTool() {
  return <TableWorkbench toolId={csvFilterManifest.id} title="Filter rows" description="Filter rows with explicit comparison rules." mode="filter" manifest={csvFilterManifest} />;
}
