import { TableWorkbench } from "../table/TableWorkbench";
import { csvToJsonManifest } from "../../../tools/csv-to-json/manifest";

export function CsvToJsonTool() {
  return <TableWorkbench toolId={csvToJsonManifest.id} title="Convert to JSON" description="Convert CSV records to JSON locally." mode="to-json" manifest={csvToJsonManifest} />;
}
