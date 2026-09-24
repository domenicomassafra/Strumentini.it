import { TableWorkbench } from "../table/TableWorkbench";
import { jsonToCsvManifest } from "../../../tools/json-to-csv/manifest";

export function JsonToCsvTool() {
  return <TableWorkbench toolId={jsonToCsvManifest.id} title="Convert to CSV" description="Convert a JSON object array to CSV locally." mode="from-json" manifest={jsonToCsvManifest} inputLabel="JSON array text" />;
}
