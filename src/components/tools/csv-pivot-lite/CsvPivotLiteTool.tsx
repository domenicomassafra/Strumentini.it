import { TableWorkbench } from "../table/TableWorkbench";
import { csvPivotLiteManifest } from "../../../tools/csv-pivot-lite/manifest";

export function CsvPivotLiteTool() {
  return <TableWorkbench toolId={csvPivotLiteManifest.id} title="Pivot table" description="Aggregate a small pivot locally." mode="pivot" manifest={csvPivotLiteManifest} />;
}
