import { TableWorkbench } from "../table/TableWorkbench";
import { csvViewerManifest } from "../../../tools/csv-viewer/manifest";
import { SpreadsheetEditor387 } from "./SpreadsheetEditor387";
import { WorkbookEditor389 } from "./WorkbookEditor389";

export function CsvViewerTool() {
  return <>
    <WorkbookEditor389 />
    <SpreadsheetEditor387 />
    <TableWorkbench toolId={csvViewerManifest.id} title="Preview CSV" description="Preview a bounded local table." mode="viewer" manifest={csvViewerManifest} />
  </>;
}
