import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditXlsxFidelity370 } from "../scripts/audit-xlsx-fidelity-370";

const defaultPython = "/tmp/strumentini-370-openpyxl/bin/python";
const python = process.env.SPREADSHEET370_PYTHON ?? (existsSync(defaultPython) ? defaultPython : "");
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const MAKE_SOURCE = String.raw`
import io, sys, zipfile, xml.etree.ElementTree as ET
from datetime import datetime
from openpyxl import Workbook
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont

mode = sys.argv[1]
wb = Workbook()
ws = wb.active
ws.title = 'Dati'
ws.append(['Codice', 'Data', 'Formula', 'Testo ricco', 'Link', 'Quantità'])
ws['A2'] = '00123'
ws['B2'] = datetime(2024, 2, 29)
ws['B2'].number_format = 'yyyy-mm-dd'
ws['C2'] = '=1+1'
ws['D2'] = CellRichText(TextBlock(InlineFont(b=True), 'Grassetto'), ' normale')
ws['E2'] = 'Pagina locale'
ws['E2'].hyperlink = 'https://example.invalid/manual?private=ignore'
ws['F2'] = 12.5
second = wb.create_sheet('Secondo')
second['A1'] = 'Foglio due'
stream = io.BytesIO()
wb.save(stream)
original = stream.getvalue()

if mode in ('stale-cache', 'macro'):
    modified = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original), 'r') as source, zipfile.ZipFile(modified, 'w') as target:
        for part in source.infolist():
            content = source.read(part.filename)
            if part.filename == 'xl/worksheets/sheet1.xml' and mode == 'stale-cache':
                ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
                root = ET.fromstring(content)
                cell = next(c for c in root.findall('.//{' + ns + '}c') if c.get('r') == 'C2')
                value = cell.find('{' + ns + '}v')
                assert value is not None
                value.text = '777'
                content = ET.tostring(root, encoding='utf-8')
            target.writestr(part, content)
        if mode == 'macro':
            target.writestr('xl/vbaProject.bin', b'SYNTHETIC_NON_EXECUTABLE_TEST_MARKER')
    original = modified.getvalue()

with zipfile.ZipFile(io.BytesIO(original)) as probe:
    assert probe.testzip() is None
    assert 'xl/workbook.xml' in probe.namelist()
    assert b'<f>1+1</f>' in probe.read('xl/worksheets/sheet1.xml') or mode == 'stale-cache'
sys.stdout.buffer.write(original)
`;

function workbook(mode = "normal"): Buffer {
  const produced = spawnSync(python, ["-c", MAKE_SOURCE, mode], { timeout: 10_000, maxBuffer: 3 * 1024 * 1024 });
  if (produced.error || produced.status !== 0) {
    throw new Error(`Openpyxl genuine XLSX fixture generation failed: ${produced.error?.message ?? produced.stderr.toString()}`);
  }
  return produced.stdout;
}

describe.skipIf(!python)("#370 genuine installed SheetJS XLSX donor: independent openpyxl + OOXML readback", () => {
  it("refuses rich spreadsheet roundtrip on formula semantics, text runs, date styles and external hyperlinks", () => {
    const input = workbook();
    const original = Buffer.from(input);
    let output: Buffer | undefined;
    const result = auditXlsxFidelity370(input, { python, onCandidate: (bytes) => { output = bytes; } });
    expect(result.decision).toBe("NO_GO");
    expect(result.promotionApproved).toBe(false);
    expect(result.sourceSha256).toBe(digest(original));
    expect(digest(input)).toBe(digest(original));
    expect(result.source.sheets).toEqual(["Dati", "Secondo"]);
    expect(result.source.cells["Dati!A2"]).toMatchObject({ type: "s", value: "00123" });
    expect(result.source.cells["Dati!B2"]).toMatchObject({ value: "2024-02-29T00:00:00", format: "yyyy-mm-dd" });
    expect(result.source.cells["Dati!C2"]).toMatchObject({ type: "f", value: "=1+1", cached: null });
    expect(result.source.cells["Dati!D2"]).toMatchObject({ value: "Grassetto normale", richRuns: 1 });
    expect(result.source.cells["Dati!E2"]?.link).toBe("https://example.invalid/manual?private=ignore");
    expect(result.source.cells["Dati!F2"]).toMatchObject({ type: "n", value: 12.5 });
    expect(result.source.externalRelationships).toBeGreaterThan(0);
    expect(result.source.richXml).toBeGreaterThan(0);
    expect(result.source.cells["Dati!D2"]?.richRuns).toBe(1);
    expect(result.candidate?.cells["Dati!D2"]?.richRuns).toBe(0);
    expect(result.mismatches).toContain("RICH_TEXT_RUNS_CHANGED:Dati!D2");
    expect(result.mismatches).toContain("RICH_XML_COUNT_CHANGED");
    expect(result.mismatches).not.toContain("CELL_VALUE_OR_TYPE_CHANGED:Dati!A2");
    expect(result.candidate?.cells["Dati!A2"]).toMatchObject({ type: "s", value: "00123" });
    expect(result.candidate?.cells["Dati!B2"]).toMatchObject({ value: "2024-02-29T00:00:00", format: "yyyy-mm-dd" });
    expect(result.candidate?.cells["Dati!C2"]).toMatchObject({ value: "=1+1", type: "f", cached: null });
    expect(result.candidate?.cells["Dati!E2"]?.link).toBe("https://example.invalid/manual?private=ignore");
    expect(result.refusalReasons).toContain("FORMULA_NOT_EVALUATED");
    expect(result.refusalReasons).toContain("RICH_TEXT_FIDELITY_UNVERIFIED");
    expect(result.refusalReasons).toContain("EXTERNAL_LINKS_NOT_APPROVED");
    expect(result.candidateSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(output).toBeDefined();
    expect(output!.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(result.candidateBytes).toBe(output!.byteLength);

    // Independent filesystem readback of both *actual XLSX byte artifacts*.
    // The donor and JS audit cannot define expected rich-text fidelity here.
    const temp = mkdtempSync(join(tmpdir(), "audit-xlsx-fidelity-370-"));
    try {
      const sourcePath = join(temp, "source.xlsx");
      const candidatePath = join(temp, "sheetjs-candidate.xlsx");
      writeFileSync(sourcePath, input);
      writeFileSync(candidatePath, output!);
      const independent = spawnSync(python, ["-c", String.raw`
import sys, zipfile, openpyxl
from openpyxl.cell.rich_text import CellRichText
src, dst = sys.argv[1:]
for path in [src, dst]:
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        assert {'xl/workbook.xml', 'xl/worksheets/sheet1.xml', '[Content_Types].xml'}.issubset(archive.namelist())
original = openpyxl.load_workbook(src, rich_text=True, data_only=False)
converted = openpyxl.load_workbook(dst, rich_text=True, data_only=False)
assert original.sheetnames == converted.sheetnames == ['Dati', 'Secondo']
assert isinstance(original['Dati']['D2'].value, CellRichText)
assert not isinstance(converted['Dati']['D2'].value, CellRichText)
assert converted['Dati']['A2'].value == '00123'
assert str(converted['Dati']['B2'].value).startswith('2024-02-29')
assert converted['Dati']['C2'].value == '=1+1'
assert converted['Dati']['E2'].hyperlink.target == 'https://example.invalid/manual?private=ignore'
print('INDEPENDENT_ZIP_OPENPYXL_REAL_FILE_LOSS_CONFIRMED')
`, sourcePath, candidatePath], { timeout: 10_000, maxBuffer: 1_000_000, encoding: "utf8" });
      expect(independent.status, independent.stderr).toBe(0);
      expect(independent.stdout.trim()).toBe("INDEPENDENT_ZIP_OPENPYXL_REAL_FILE_LOSS_CONFIRMED");
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }, 30_000);

  it("does not trust a forged cached value for a real formula, even when the formula string survives", () => {
    const input = workbook("stale-cache");
    const before = Buffer.from(input);
    const result = auditXlsxFidelity370(input, { python });
    expect(result.source.cells["Dati!C2"]).toMatchObject({ type: "f", value: "=1+1", cached: 777 });
    expect(Object.values(result.source.formulaCaches)).toContain("777");
    expect(result.refusalReasons).toContain("FORMULA_CACHED_RESULT_UNTRUSTED");
    expect(digest(input)).toBe(digest(before));
  }, 30_000);

  it("does not report zero loss when installed donor drops actual chart and raster media from tracked workbook", () => {
    const source = readFileSync(new URL("./ooxml-68-corpus/complex.xlsx", import.meta.url));
    const result = auditXlsxFidelity370(source, { python });
    expect(result.source.mediaParts).toHaveLength(2);
    expect(result.source.chartParts).toHaveLength(1);
    expect(result.candidate?.mediaParts).toHaveLength(0);
    expect(result.candidate?.chartParts).toHaveLength(0);
    expect(result.mismatches).toContain("MEDIA_PARTS_LOST:2->0");
    expect(result.mismatches).toContain("CHART_PARTS_LOST:1->0");
    expect(result.refusalReasons).toContain("XLSX_SEMANTIC_FIDELITY_LOSS");
  }, 30_000);

  it("refuses real macro-member OOXML before invoking the donor or emitting diagnostic output", () => {
    const input = workbook("macro");
    let callbacks = 0;
    expect(() => auditXlsxFidelity370(input, { python, onCandidate: () => { callbacks++; } }))
      .toThrow(/MACRO_PACKAGE_UNSUPPORTED/u);
    expect(callbacks).toBe(0);
  });

  it("does not run an already-cancelled donor experiment", () => {
    const input = workbook();
    const cancelled = new AbortController();
    cancelled.abort();
    expect(() => auditXlsxFidelity370(input, { python, signal: cancelled.signal }))
      .toThrow(/cancelled/u);
  });

  it("fails closed when pinned oracle or donor licensing evidence is absent, preserving the source", () => {
    const input = workbook();
    const unchanged = digest(input);
    let candidateCalls = 0;
    expect(() => auditXlsxFidelity370(input, { python: "", onCandidate: () => { candidateCalls++; } }))
      .toThrow(/PINNED_ORACLE_REQUIRED/u);
    expect(() => auditXlsxFidelity370(input, { python, spike: "/tmp/xlsx370-nonexistent-vendor-spike",
      onCandidate: () => { candidateCalls++; } })).toThrow(/DONOR_PIN_OR_LICENSE_MISMATCH/u);
    expect(() => auditXlsxFidelity370(Buffer.alloc(2 * 1024 * 1024 + 1), { python }))
      .toThrow(/INPUT_LIMIT/u);
    expect(candidateCalls).toBe(0);
    expect(digest(input)).toBe(unchanged);
  }, 30_000);
});
