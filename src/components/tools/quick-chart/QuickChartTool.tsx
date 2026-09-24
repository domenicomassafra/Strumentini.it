import { TableWorkbench } from "../table/TableWorkbench";
import { quickChartManifest } from "../../../tools/quick-chart/manifest";

export function QuickChartTool() {
  return <TableWorkbench toolId={quickChartManifest.id} title="Build chart" description="Create a bounded local bar chart." mode="chart" manifest={quickChartManifest} />;
}
