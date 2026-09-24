import { TableWorkbench } from "../table/TableWorkbench";
import { csvColumnSelectorManifest } from "../../../tools/csv-column-selector/manifest";

export function CsvColumnSelectorTool() {
  return <TableWorkbench toolId={csvColumnSelectorManifest.id} title="Select columns" description="Keep and reorder explicit CSV columns." mode="selector" manifest={csvColumnSelectorManifest} />;
}
