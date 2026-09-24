import { TableWorkbench } from "../table/TableWorkbench";
import { csvEncodingFixerManifest } from "../../../tools/csv-encoding-fixer/manifest";

export function CsvEncodingFixerTool() {
  return <TableWorkbench toolId={csvEncodingFixerManifest.id} title="Fix encoding" description="Decode local bytes to normalized UTF-8." mode="encoding" manifest={csvEncodingFixerManifest} inputLabel="CSV text (or choose a file)" />;
}
