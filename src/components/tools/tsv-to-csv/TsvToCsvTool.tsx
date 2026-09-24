import { TableWorkbench } from "../table/TableWorkbench";
import { tsvToCsvManifest } from "../../../tools/tsv-to-csv/manifest";

export function TsvToCsvTool() {
  return <TableWorkbench toolId={tsvToCsvManifest.id} title="Convert TSV" description="Convert tab-separated values to CSV." mode="tsv" manifest={tsvToCsvManifest} inputLabel="TSV text" />;
}
