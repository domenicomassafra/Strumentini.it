import { TableWorkbench } from "../table/TableWorkbench";
import { columnTypeProfilerManifest } from "../../../tools/column-type-profiler/manifest";

export function ColumnTypeProfilerTool() {
  return <TableWorkbench toolId={columnTypeProfilerManifest.id} title="Profile column types" description="Infer column value types locally." mode="type-profile" manifest={columnTypeProfilerManifest} />;
}
