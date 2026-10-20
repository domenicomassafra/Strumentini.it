import { describe, expect, it } from "vitest";
import { generateQr, penalty } from "../src/engines/qr/encode";
import { readQrMatrix } from "../src/engines/qr";

describe("ISO/IEC 18004 N3 mask selection", () => {
  it("charges 40 points for a finder-like pattern with a four-module light guard", () => {
    const rows = Array.from({ length: 11 }, () => Array<boolean>(11).fill(false));
    rows[0] = [..."00001011101"].map((bit) => bit === "1");
    // Independent N1/N2/N4 total for this constructed matrix: 553.
    expect(penalty(rows)).toBe(593);
    const columns = rows[0]!.map((_value, index) => rows.map((row) => row[index]!));
    expect(penalty(columns)).toBe(593);
  });

  it("selects the documented ISO mask and preserves independent QR reading", () => {
    const generated = generateQr("https://strumentini.it");
    expect(generated.mask).toBe(0);
    expect(readQrMatrix(generated.matrixRows).payload).toBe("https://strumentini.it");
  });
});
