import { TableWorkbench } from "../table/TableWorkbench";
import { csvToSqlManifest } from "../../../tools/csv-to-sql/manifest";

export function CsvToSqlTool() {
  return <TableWorkbench toolId={csvToSqlManifest.id} title="CSV to SQL" description="Generate SQL locally without executing it." mode="sql" manifest={csvToSqlManifest} />;
}
