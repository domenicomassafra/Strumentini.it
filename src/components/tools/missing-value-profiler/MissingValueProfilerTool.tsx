import { TableWorkbench } from "../table/TableWorkbench";
import { missingValueProfilerManifest } from "../../../tools/missing-value-profiler/manifest";

export function MissingValueProfilerTool() {
  return <TableWorkbench toolId={missingValueProfilerManifest.id} title="Profile missing values" description="Count empty cells by column." mode="missing-profile" manifest={missingValueProfilerManifest} />;
}
