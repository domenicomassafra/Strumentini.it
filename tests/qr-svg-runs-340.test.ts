import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateQr, rasterPlan, renderQrSvg } from "../src/engines/qr/encode";
import { readQrMatrix } from "../src/engines/qr";

// The inputs from #278's differential test, plus the six accepted canonical
// fixtures and one more compact value: 21 varied byte-mode symbols in total.
const canonical = JSON.parse(readFileSync(new URL("../quality/fixtures/qr-contract/vectors.json", import.meta.url), "utf8")) as {
  vectors: { payload: string; expected_rejection?: string }[];
};
const corpus = [
  "https://strumentini.it", "https://strumentini.it/tools/qr-generator",
  "WIFI:T:WPA;S:Caffè;P:locale;;", "Città però più così — perché",
  "QR ✅ locale 🚀", "12345678901234567890", "HELLO WORLD 123",
  ...[17, 18, 32, 33, 53, 54, 78].map((length) => "x".repeat(length)),
  ...canonical.vectors.filter((vector) => !vector.expected_rejection).map((vector) => vector.payload),
  "qr",
];

const RUN = /M(\d+) ([\d.]+)h(\d+)/gu;

/** Decode only the painted SVG geometry; deliberately never inspect data-matrix. */
function paintedModules(svg: string, size: number, scale: number): { rows: string[]; runs: number } {
  const matchPath = svg.match(/<path fill="none" stroke="#000000" stroke-width="(\d+)" stroke-linecap="butt" d="([^"]+)"\/>/u);
  expect(Number(matchPath?.[1])).toBe(scale);
  const d = matchPath?.[2];
  expect(d).toBeDefined();
  const visited = Array.from({ length: size }, () => Array<number>(size).fill(0));
  let runCount = 0;
  for (const match of d!.matchAll(RUN)) {
    const left = Number(match[1]!);
    const center = Number(match[2]!);
    const width = Number(match[3]!);
    expect(left % scale).toBe(0);
    expect(width % scale).toBe(0);
    const y = center / scale - 4.5;
    expect(Number.isInteger(y)).toBe(true);
    const x = left / scale - 4;
    const length = width / scale;
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(size);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x + length).toBeLessThanOrEqual(size);
    for (let column = x; column < x + length; column += 1) {
      visited[y]![column] = (visited[y]![column] ?? 0) + 1;
    }
    runCount += 1;
  }
  expect(d!.replace(RUN, "")).toBe("");
  return { rows: visited.map((row) => row.join("")), runs: runCount };
}

/** Byte-identical reconstruction of the previous per-module path for comparison. */
function previousSvg(rows: readonly string[], scale: number): string {
  const plan = rasterPlan(rows, scale);
  const oldPath = plan.dark
    .map(({ x, y }) => `M${(x + plan.quietZone) * scale} ${(y + plan.quietZone) * scale}h${scale}v${scale}h-${scale}z`)
    .join("");
  return renderQrSvg(rows, { scale }).replace(
    /<path fill="none" stroke="#000000" stroke-width="\d+" stroke-linecap="butt" d="[^"]+"\/>/u,
    () => `<path fill="#000000" d="${oldPath}"/>`,
  );
}

describe("QR SVG horizontal runs #340", () => {
  it("paints exactly the generated matrix at several scales, with unchanged public metadata", () => {
    for (const payload of corpus) {
      const generated = generateQr(payload);
      for (const scale of [3, 4, 8]) {
        const svg = renderQrSvg(generated.matrixRows, { scale });
        const { rows, runs } = paintedModules(svg, generated.size, scale);
        const dimension = (generated.size + 8) * scale;
        expect(rows, `${payload} at scale ${scale}`).toEqual(generated.matrixRows);
        expect(runs).toBeLessThan(rasterPlan(rows, scale).dark.length);
        expect(svg).toContain(`viewBox="0 0 ${dimension} ${dimension}" width="${dimension}" height="${dimension}"`);
        expect(svg).toContain('shape-rendering="crispEdges" role="img" aria-label="Codice QR"');
        expect(svg).toContain(`data-matrix="${generated.matrixRows.join(";")}"`);
        expect(svg).toContain(`<rect width="${dimension}" height="${dimension}" fill="#ffffff"/>`);
        expect(readQrMatrix(svg).payload).toBe(payload);
      }
    }
  });

  it("cuts at least half the original SVG bytes on a 21-payload realistic corpus", () => {
    let before = 0;
    let after = 0;
    for (const payload of corpus) {
      const rows = generateQr(payload).matrixRows;
      before += Buffer.byteLength(previousSvg(rows, 8));
      after += Buffer.byteLength(renderQrSvg(rows));
    }
    expect(corpus).toHaveLength(21);
    expect(after).toBeLessThanOrEqual(before * 0.5);
  });
});
