import { TableWorkbench } from "../table/TableWorkbench";
import { csvViewerManifest } from "../../../tools/csv-viewer/manifest";
import { SpreadsheetEditor387 } from "./SpreadsheetEditor387";

export function CsvViewerTool() {
  return <>
    <SpreadsheetEditor387 />
    <TableWorkbench toolId={csvViewerManifest.id} title="Preview CSV" description="Preview a bounded local table." mode="viewer" manifest={csvViewerManifest} />
  </>;
}
