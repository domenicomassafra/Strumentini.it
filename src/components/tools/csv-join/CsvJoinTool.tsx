import { TableWorkbench } from "../table/TableWorkbench";
import { csvJoinManifest } from "../../../tools/csv-join/manifest";

export function CsvJoinTool() {
  return <TableWorkbench toolId={csvJoinManifest.id} title="Join tables" description="Join two local tables by explicit key columns." mode="join" manifest={csvJoinManifest} secondaryLabel="Right CSV table" />;
}
