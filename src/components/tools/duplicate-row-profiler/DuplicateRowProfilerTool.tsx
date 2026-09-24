import { TableWorkbench } from "../table/TableWorkbench";
import { duplicateRowProfilerManifest } from "../../../tools/duplicate-row-profiler/manifest";

export function DuplicateRowProfilerTool() {
  return <TableWorkbench toolId={duplicateRowProfilerManifest.id} title="Profile duplicate rows" description="Report repeated rows and keys." mode="duplicate-profile" manifest={duplicateRowProfilerManifest} />;
}
