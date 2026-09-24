import { TableWorkbench } from "../table/TableWorkbench";
import { csvViewerManifest } from "../../../tools/csv-viewer/manifest";

export function CsvViewerTool() {
  return <TableWorkbench toolId={csvViewerManifest.id} title="Preview CSV" description="Preview a bounded local table." mode="viewer" manifest={csvViewerManifest} />;
}
