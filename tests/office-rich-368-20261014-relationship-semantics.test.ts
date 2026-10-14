/** #368: real DOCX hyperlink and relationship boundaries must be faithfully
 * classified from valid OOXML, rather than silently disappearing on XML syntax. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractDocxSemantics, inspectOfficeStructure } from "../src/engines/ooxml/office-semantics";

const ORIGINAL = readFileSync("tests/ooxml-68-corpus/complex.docx");
const TARGET = "https://example.invalid/office-no-fetch";

const pythonZip = String.raw`
import io,sys,zipfile
from xml.etree import ElementTree as ET
mode=sys.argv[1]
src=io.BytesIO(sys.stdin.buffer.read()); dst=io.BytesIO()
with zipfile.ZipFile(src) as archive,zipfile.ZipFile(dst,'w',compression=zipfile.ZIP_DEFLATED) as result:
    assert archive.testzip() is None
    for part in archive.infolist():
        data=archive.read(part.filename)
        if part.filename=='word/_rels/document.xml.rels':
            assert b'Id="rId11"' in data and b'TargetMode="External"' in data
            assert b'https://example.invalid/office-no-fetch' in data
            if mode in ('valid-whitespace','valid-entity-comment'):
                data=data.replace(b'Id="rId11"',b'Id = "rId11"')
                data=data.replace(b'Target="https://example.invalid/office-no-fetch"',b'Target = "https://example.invalid/office-no-fetch"')
                data=data.replace(b'TargetMode="External"',b"TargetMode = 'External'")
                if mode=='valid-entity-comment':
                    data=data.replace(b'office-no-fetch',b'office-no-fetch?a=1&amp;b=2')
                    data=data.replace(b'</Relationships>',b'<!-- <Relationship Id="fake" TargetMode="External"/> --></Relationships>')
                root=ET.fromstring(data)
                nodes=[r for r in root if r.get('Id')=='rId11']
                assert len(nodes)==1 and nodes[0].get('TargetMode')=='External'
                assert nodes[0].get('Target')=='https://example.invalid/office-no-fetch'+ ('?a=1&b=2' if mode=='valid-entity-comment' else '')
            elif mode=='malformed':
                data=data.replace(b'TargetMode="External"',b'TargetMode="External" <broken')
                try:
                    ET.fromstring(data)
                    raise AssertionError('malformed relationship unexpectedly valid')
                except ET.ParseError: pass
            elif mode=='duplicate':
                root=ET.fromstring(data)
                link=[r for r in root if r.get('Id')=='rId11']
                assert len(link)==1
                ET.SubElement(root,'{%s}Relationship'%root.tag.split('}')[0][1:],{
                   'Id':'rId11','Type':link[0].get('Type'),'Target':'https://example.invalid/shadow','TargetMode':'External'})
                data=ET.tostring(root,encoding='utf-8',xml_declaration=True)
                root=ET.fromstring(data)
                assert sum(r.get('Id')=='rId11' for r in root)==2
            else: raise AssertionError(mode)
        result.writestr(part,data)
out=dst.getvalue()
with zipfile.ZipFile(io.BytesIO(out)) as check:
    assert check.testzip() is None
    assert b'rId11' in check.read('word/document.xml')
    if mode in ('valid-whitespace','valid-entity-comment'):
        root=ET.fromstring(check.read('word/_rels/document.xml.rels'))
        assert len([r for r in root if r.get('Id')=='rId11'])==1
sys.stdout.buffer.write(out)
`;

function realOfficeFixture(mode: "valid-whitespace" | "valid-entity-comment" | "malformed" | "duplicate"): Uint8Array {
  const child = spawnSync("python3", ["-c", pythonZip, mode], {
    input: ORIGINAL, timeout: 10_000, maxBuffer: 4 * 1024 * 1024,
  });
  expect(child.status, child.stderr.toString() || String(child.error)).toBe(0);
  return new Uint8Array(child.stdout);
}

describe("#368 Office-rich real DOCX relationship fidelity", () => {
  it("parses XML-legal attribute spaces and quotes without losing the genuine external link", async () => {
    const bytes = realOfficeFixture("valid-whitespace");
    const unchanged = bytes.slice();
    const inspection = await inspectOfficeStructure(bytes);
    expect(inspection.kind).toBe("docx");
    expect(inspection.externalRelationshipCount).toBe(1);
    const extracted = await extractDocxSemantics(bytes);
    expect(extracted.structureCounts.links).toBeGreaterThanOrEqual(1);
    expect(extracted.markdown).toContain(`[Source](${TARGET})`);
    expect(extracted.html).toContain(`<a href="${TARGET}" rel="noreferrer">Source</a>`);
    expect(extracted.activeContentPolicy).toBe("macros-refused-external-resources-never-fetched");
    expect(bytes).toEqual(unchanged);
  });

  it("refuses malformed relationship XML instead of reporting a misleading safe zero", async () => {
    const invalid = realOfficeFixture("malformed");
    await expect(inspectOfficeStructure(invalid)).rejects.toMatchObject({ code: "REBUILD_VERIFICATION_FAILED" });
    await expect(extractDocxSemantics(invalid)).rejects.toMatchObject({ code: "REBUILD_VERIFICATION_FAILED" });
  });

  it("decodes XML entities once and ignores comment-shaped fake external relationships", async () => {
    const bytes = realOfficeFixture("valid-entity-comment");
    expect((await inspectOfficeStructure(bytes)).externalRelationshipCount).toBe(1);
    const output = await extractDocxSemantics(bytes);
    expect(output.markdown).toContain(`[Source](${TARGET}?a=1&b=2)`);
    expect(output.html).toContain(`<a href="${TARGET}?a=1&amp;b=2" rel="noreferrer">Source</a>`);
  });

  it("refuses duplicate relationship IDs instead of replacing an actual linked target", async () => {
    const ambiguous = realOfficeFixture("duplicate");
    await expect(inspectOfficeStructure(ambiguous)).rejects.toMatchObject({ code: "REBUILD_VERIFICATION_FAILED" });
    await expect(extractDocxSemantics(ambiguous)).rejects.toMatchObject({ code: "REBUILD_VERIFICATION_FAILED" });
  });

  it("keeps the original source DOCX hyperlinks and semantics importable", async () => {
    const result = await extractDocxSemantics(new Uint8Array(ORIGINAL));
    expect(result.markdown).toContain(`[Source](${TARGET})`);
    expect((await inspectOfficeStructure(new Uint8Array(ORIGINAL))).externalRelationshipCount).toBe(1);
  });
});
