import { TableWorkbench } from "../table/TableWorkbench";
import { csvDelimiterDetectorManifest } from "../../../tools/csv-delimiter-detector/manifest";

export function CsvDelimiterDetectorTool() {
  return <TableWorkbench toolId={csvDelimiterDetectorManifest.id} title="Detect delimiter" description="Compare delimiter candidates without uploading text." mode="delimiter" manifest={csvDelimiterDetectorManifest} />;
}
