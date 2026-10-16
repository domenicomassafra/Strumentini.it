/** #370: inspect the original numeric <v> XML before a JS number can silently
 * round an XLSX source cell during values-only CSV import. */
import { spawnSync } from "node:child_process";
import { zipSync, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { csvToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

const worksheetPath = "xl/worksheets/sheet1.xml";

async function xlsxWithRawNumericValue(raw: string, encodedNumericType = false): Promise<ArrayBuffer> {
  const initial = await csvToXlsx("id,amount\nA,10\n", {
    columnPolicies: [{ column: 1, type: "number" }],
  });
  const files = unzipSync(new Uint8Array(initial.bytes));
  const original = files[worksheetPath];
  expect(original).toBeDefined();
  const xml = new TextDecoder().decode(original);
  expect(xml.match(/<v>10<\/v>/gu)).toHaveLength(1);
  const withValue = xml.replace("<v>10</v>", `<v>${raw}</v>`);
  if (encodedNumericType) expect(withValue).toContain('<c r="B2">');
  files[worksheetPath] = new TextEncoder().encode(encodedNumericType
    ? withValue.replace('<c r="B2">', '<c r="B2" t="&#x6e;">')
    : withValue);
  const zipped = zipSync(files);

  // An independent ZIP reader and arbitrary precision Decimal prove that the
  // actual CRC-valid source contains precisely the raw source value.
  const oracle = spawnSync("python3", ["-c", String.raw`
import io, sys, zipfile
from decimal import Decimal
from xml.etree import ElementTree as ET
raw = sys.argv[1]
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
    assert z.testzip() is None
    ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    cell = root.find(".//%sc[@r='B2']" % ns)
    assert cell is not None and cell.attrib.get('t', 'n') == 'n'
    value = cell.find('%sv' % ns)
    assert value is not None and value.text == raw
    assert Decimal(value.text) != Decimal(0)
`, raw], { input: Buffer.from(zipped), encoding: "utf8", timeout: 10_000 });
  expect(oracle.status, oracle.stderr || String(oracle.error)).toBe(0);
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
}

describe("#370 imported XLSX original decimal fidelity", () => {
  it.each([
    "9007199254740993",
    "0.1234567890123456789",
    "1.234567890123456789",
    `0.${"0".repeat(400)}1`,
    "1e-320",
  ])("refuses source numeric cell that would silently change on XLSX-to-CSV: %s", async (raw) => {
    const original = await xlsxWithRawNumericValue(raw);
    const before = new Uint8Array(original).slice();
    await expect(xlsxToCsv(original)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    expect(new Uint8Array(original)).toEqual(before);
  });

  it("accepts ordinary XLSX numeric values including exponential notation", async () => {
    const bytes = await xlsxWithRawNumericValue("1.25E+3");
    await expect(xlsxToCsv(bytes)).resolves.toMatchObject({ csv: "id,amount\nA,1250" });
  });

  it("refuses an unsafe value with XML-entity-encoded numeric cell type", async () => {
    // ElementTree decodes &#x6e; as 'n'; skipping the raw attribute would let
    // the general reader convert the same unsafe numeric <v> to a JS Number.
    await expect(xlsxToCsv(await xlsxWithRawNumericValue("9007199254740993", true)))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("preserves exact long digits exported as a text cell", async () => {
    const original = await csvToXlsx("id,amount\nA,9007199254740993\n");
    await expect(xlsxToCsv(original.bytes)).resolves.toMatchObject({
      csv: "id,amount\nA,9007199254740993",
    });
  });
});
