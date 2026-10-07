import { TableWorkbench } from "../table/TableWorkbench";
import { csvSplitterManifest } from "../../../tools/csv-splitter/manifest";

export function CsvSplitterTool() {
  return <TableWorkbench toolId={csvSplitterManifest.id} title="CSV Splitter" description="Split large CSV files locally with bounded input buffering." mode="split" manifest={csvSplitterManifest} />;
}
