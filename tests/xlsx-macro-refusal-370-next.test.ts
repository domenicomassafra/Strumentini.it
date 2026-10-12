import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseCsvTable } from "../src/engines/table/csv";
import { csvToXlsx, xlsxToCsv } from "../src/engines/table/spreadsheet-interchange";

// Python's independent standard-library ZIP writer edits a real workbook
// produced by the app; no mock reader, ZIP metadata stub or actual VBA executes.
const mutateZip = String.raw`
import io, sys, zipfile
mode = sys.argv[1]
original = io.BytesIO(sys.stdin.buffer.read())
output = io.BytesIO()
with zipfile.ZipFile(original, 'r') as source, zipfile.ZipFile(output, 'w') as target:
    for part in source.infolist():
        content = source.read(part.filename)
        if part.filename == '[Content_Types].xml' and mode in ('macro', 'case-macro', 'declared-macro'):
            content = content.replace(b'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', b'application/vnd.ms-excel.sheet.macroEnabled.main+xml')
            assert b'macroEnabled.main+xml' in content
            content = content.replace(b'</Types>', b'<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>')
        target.writestr(part, content)
    if mode == 'macro':
        target.writestr('xl/vbaProject.bin', b'SYNTHETIC_BINARY_VBA_MARKER_NOT_EXECUTABLE')
    elif mode == 'case-macro':
        target.writestr('XL/VBAPROJECT.BIN', b'SYNTHETIC_BINARY_VBA_MARKER_NOT_EXECUTABLE')
    elif mode == 'traversal':
        target.writestr('xl/../xl/hidden.xml', b'<not-a-worksheet/>')
    elif mode == 'bomb':
        target.writestr('xl/worksheets/unreferenced.xml', b'X' * (8 * 1024 * 1024), compress_type=zipfile.ZIP_DEFLATED)
    elif mode not in ('declared-macro',):
        raise ValueError(mode)
result = output.getvalue()
with zipfile.ZipFile(io.BytesIO(result)) as probe:
    assert probe.testzip() is None
    if mode == 'macro': assert 'xl/vbaProject.bin' in probe.namelist()
    if mode == 'case-macro': assert 'XL/VBAPROJECT.BIN' in probe.namelist()
    if mode == 'declared-macro': assert 'xl/vbaProject.bin' not in probe.namelist()
    if mode == 'bomb': assert probe.getinfo('xl/worksheets/unreferenced.xml').file_size == 8 * 1024 * 1024
sys.stdout.buffer.write(result)
`;

function pythonZip(mode: string, source: ArrayBuffer): ArrayBuffer {
  const result = spawnSync("python3", ["-c", mutateZip, mode], {
    input: Buffer.from(source),
    timeout: 15_000,
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`Independent Python ZIP fixture failed: ${result.error?.message ?? result.stderr.toString()}`);
  const bytes = result.stdout;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("#370 operational OOXML preflight before XLSX CSV conversion", () => {
  it("accepts a genuine ordinary XLSX and retains leading zeros", async () => {
    const workbook = await csvToXlsx("id,label\n00123,Comune\n");
    expect(parseCsvTable((await xlsxToCsv(workbook.bytes)).csv).rows).toEqual([["00123", "Comune"]]);
  });

  it.each(["macro", "case-macro"])("refuses the genuine ZIP member %s macro marker before XLSX read", async (mode) => {
    const workbook = await csvToXlsx("id,label\n00123,Comune\n");
    const archive = pythonZip(mode, workbook.bytes);
    const immutable = new Uint8Array(archive).slice();
    await expect(xlsxToCsv(archive)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
    expect(new Uint8Array(archive)).toEqual(immutable);
  });

  it("refuses macro content-type declarations even if the VBA payload path is omitted", async () => {
    const workbook = await csvToXlsx("id\n00123\n");
    await expect(xlsxToCsv(pythonZip("declared-macro", workbook.bytes)))
      .rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });

  it("rejects a real ZIP traversal name before parsing workbook data", async () => {
    const workbook = await csvToXlsx("id\n00123\n");
    await expect(xlsxToCsv(pythonZip("traversal", workbook.bytes)))
      .rejects.toMatchObject({ code: "XLSX_READ_FAILED" });
  });

  it("rejects oversized inflated member declared by a genuine small ZIP before expansion", async () => {
    const workbook = await csvToXlsx("id\n00123\n");
    const bomb = pythonZip("bomb", workbook.bytes);
    expect(bomb.byteLength).toBeLessThan(40_000);
    await expect(xlsxToCsv(bomb)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it.skipIf(!process.env.SPREADSHEET370_PYTHON)("independent openpyxl can reopen the macro-marked real OOXML ZIP without executing VBA", async () => {
    const workbook = await csvToXlsx("id\n00123\n");
    const macro = pythonZip("macro", workbook.bytes);
    const oracle = spawnSync(process.env.SPREADSHEET370_PYTHON!, ["-c", String.raw`
import io, openpyxl, sys, zipfile
content = sys.stdin.buffer.read()
with zipfile.ZipFile(io.BytesIO(content)) as archive:
    assert 'xl/vbaProject.bin' in archive.namelist()
    assert 'macroEnabled.main+xml' in archive.read('[Content_Types].xml').decode()
book = openpyxl.load_workbook(io.BytesIO(content), keep_vba=True, read_only=False, data_only=True)
assert book.active['A2'].value == '00123'
print(openpyxl.__version__)
`], { input: Buffer.from(macro), timeout: 10_000, maxBuffer: 1_000_000 });
    expect(oracle.error).toBeUndefined();
    expect(oracle.status, oracle.stderr.toString()).toBe(0);
    expect(oracle.stdout.toString().trim()).toBe("3.1.5");
    await expect(xlsxToCsv(macro)).rejects.toMatchObject({ code: "UNSUPPORTED_XLSX_FEATURE" });
  });
});
