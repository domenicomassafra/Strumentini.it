import { TableWorkbench } from "../table/TableWorkbench";
import { tableTransposeManifest } from "../../../tools/table-transpose/manifest";

export function TableTransposeTool() {
  return <TableWorkbench toolId={tableTransposeManifest.id} title="Transpose table" description="Flip table rows and columns locally." mode="transpose" manifest={tableTransposeManifest} />;
}
