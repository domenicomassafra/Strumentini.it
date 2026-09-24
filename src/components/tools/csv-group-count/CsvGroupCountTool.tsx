import { TableWorkbench } from "../table/TableWorkbench";
import { csvGroupCountManifest } from "../../../tools/csv-group-count/manifest";

export function CsvGroupCountTool() {
  return <TableWorkbench toolId={csvGroupCountManifest.id} title="Group and count" description="Group rows and emit stable counts." mode="group-count" manifest={csvGroupCountManifest} />;
}
