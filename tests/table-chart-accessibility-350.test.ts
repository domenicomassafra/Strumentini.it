import { describe, expect, it } from "vitest";
import { TableAccessibleChart } from "../src/components/tools/table/TableWorkbench";

describe("#350 table chart data accessibility", () => {
  it("exposes each visible series label and value in the chart's accessible name", () => {
    const chart = TableAccessibleChart({
      publicTitle: "Conteggio per città",
      points: [{ label: "Roma", value: 3 }, { label: "Milano", value: 0 }, { label: "Bari", value: -2 }],
      maxPoint: 3,
    });
    expect(chart.props).toMatchObject({
      class: "table-chart",
      role: "img",
      "aria-label": "Grafico: Conteggio per città. Roma: 3; Milano: 0; Bari: -2",
    });
    expect(chart.props.children).toHaveLength(3);
  });

  it("retains an explicit name without inventing series when no bars are supplied", () => {
    const chart = TableAccessibleChart({ publicTitle: "Conteggio", points: [], maxPoint: 1 });
    expect(chart.props["aria-label"]).toBe("Grafico: Conteggio");
  });
});
