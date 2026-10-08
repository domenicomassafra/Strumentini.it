import { describe, expect, it } from "vitest";
import { planPdfNUp, verifyPdfNUp, type PdfNUpOptions } from "../src/engines/pdf/n-up";

const options: PdfNUpOptions = {
  mode: "4-up", paper: "a4", orientation: "landscape",
  margin: 20, gap: 10, order: "row-major",
};

describe("#250 deterministic PDF n-up sheet geometry", () => {
  it("maps 5 source pages to 2 sheets and explicitly pads last three cells", () => {
    const plan = planPdfNUp(5, options);
    expect(plan).toMatchObject({ rows: 2, columns: 2, pageCount: 5, sheetCount: 2, blankSlots: 3, sheetWidth: 841.89, sheetHeight: 595.28 });
    expect(plan.sheets.flatMap((sheet) => sheet.cells.map((cell) => cell.sourcePage))).toEqual([1, 2, 3, 4, 5, null, null, null]);
    expect(plan.sheets[0]?.cells.map(({ row, column }) => [row, column])).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
    const first = plan.sheets[0]!.cells[0]!;
    expect(first.x).toBe(20);
    expect(first.y).toBeCloseTo(302.64, 2);
    expect(first.width).toBeCloseTo(395.945, 3);
    expect(first.height).toBeCloseTo(272.64, 2);
    for (const cell of plan.sheets.flatMap((sheet) => sheet.cells)) {
      expect(cell.x).toBeGreaterThanOrEqual(plan.margin);
      expect(cell.y).toBeGreaterThanOrEqual(plan.margin - 0.000001);
      expect(cell.x + cell.width).toBeLessThanOrEqual(plan.sheetWidth - plan.margin + 0.000001);
      expect(cell.y + cell.height).toBeLessThanOrEqual(plan.sheetHeight - plan.margin + 0.000001);
    }
  });

  it("distinguishes column-first mapping and honors custom paper in points", () => {
    const plan = planPdfNUp(7, { ...options, mode: "custom", rows: 2, columns: 3,
      paper: "custom", orientation: "portrait", customWidth: 700, customHeight: 900, order: "column-major" });
    expect(plan).toMatchObject({ sheetWidth: 700, sheetHeight: 900, rows: 2, columns: 3, sheetCount: 2, blankSlots: 5 });
    expect(plan.sheets[0]?.cells.map(({ row, column }) => [row, column])).toEqual([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]);
    expect(plan.sheets[1]?.cells.map(({ sourcePage }) => sourcePage)).toEqual([7, null, null, null, null, null]);
  });

  it("2-up with odd input keeps all pages and an explicitly white spare slot", () => {
    const plan = planPdfNUp(3, { ...options, mode: "2-up", orientation: "portrait" });
    expect(plan.sheets.flatMap((sheet) => sheet.cells.map((cell) => cell.sourcePage))).toEqual([1, 2, 3, null]);
    expect(plan.blankSlots).toBe(1);
  });

  it("fails on invalid ranges and refuses to certify a malformed output as a PDF", () => {
    expect(() => planPdfNUp(65, options)).toThrow(/Numero pagine/);
    expect(() => planPdfNUp(64, { ...options, mode: "custom", rows: 1, columns: 1 })).toThrow(/32 fogli/);
    expect(() => planPdfNUp(5, { ...options, mode: "custom", rows: 4, columns: 4 })).toThrow(/8 pagine/);
    expect(() => planPdfNUp(5, { ...options, margin: -1 })).toThrow(/Margini/);
    expect(() => planPdfNUp(5, { ...options, gap: 60 })).toThrow(/spazi/);
    expect(() => planPdfNUp(5, { ...options, paper: "custom", customWidth: 230, customHeight: 1200 })).toThrow(/Carta/);
    expect(() => verifyPdfNUp(new Uint8Array([1, 2, 3]), planPdfNUp(5, options))).toThrow(/Signature/);
  });
});
