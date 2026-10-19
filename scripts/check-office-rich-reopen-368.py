"""Independent Python ZIP/XML readback for the rich #368 Office corpus.

Only the conservative OOXML repack is eligible for a lossless claim. This
compares the *actual* exported file with the original, not producer receipts.
It deliberately does not claim that a page was rendered or visually compared.
"""

import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


def inspect(source_path: Path, exported_path: Path) -> dict:
    kind = source_path.suffix.removeprefix(".")
    if kind not in ("docx", "xlsx", "pptx") or exported_path.suffix != source_path.suffix:
        raise ValueError("OFFICE368_FORMAT_MISMATCH")

    with ZipFile(source_path) as source, ZipFile(exported_path) as exported:
        source_parts = source.namelist()
        exported_parts = exported.namelist()
        if len(source_parts) != len(set(source_parts)) or len(exported_parts) != len(set(exported_parts)):
            raise ValueError("OFFICE368_DUPLICATE_PART")
        if set(source_parts) != set(exported_parts):
            raise ValueError("OFFICE368_PARTS_CHANGED")
        if source.testzip() is not None or exported.testzip() is not None:
            raise ValueError("OFFICE368_BAD_ZIP_CRC")

        xml_parts = 0
        for part in source_parts:
            original = source.read(part)
            result = exported.read(part)
            if original != result:
                raise ValueError(f"OFFICE368_PART_CHANGED:{part}")
            if part.endswith((".xml", ".rels")) or part == "[Content_Types].xml":
                ET.fromstring(result)
                xml_parts += 1

        if kind == "docx":
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            doc = ET.fromstring(exported.read("word/document.xml"))
            fonts = ET.fromstring(exported.read("word/fontTable.xml"))
            tables = len(doc.findall(".//w:tbl", ns))
            font_count = len(fonts.findall(".//w:font", ns))
            layout = len(doc.findall(".//w:sectPr", ns))
            charts = len([p for p in exported_parts if p.startswith("word/charts/") and p.endswith(".xml")])
            slides_or_sheets = 0
        elif kind == "xlsx":
            ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            sheet = ET.fromstring(exported.read("xl/worksheets/sheet1.xml"))
            styles = ET.fromstring(exported.read("xl/styles.xml"))
            tables = len(sheet.findall(".//x:c", ns))
            font_count = len(styles.findall(".//x:fonts/x:font", ns))
            layout = len(sheet.findall(".//x:pageMargins", ns))
            charts = len([p for p in exported_parts if p.startswith("xl/charts/chart") and p.endswith(".xml")])
            slides_or_sheets = len([p for p in exported_parts if p.startswith("xl/worksheets/sheet") and p.endswith(".xml")])
        else:
            ns = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main"}
            presentation = ET.fromstring(exported.read("ppt/presentation.xml"))
            tables = 0
            font_count = len([p for p in exported_parts if p.startswith("ppt/theme/") and p.endswith(".xml")])
            layout = len(presentation.findall(".//p:sldSz", ns))
            charts = len([p for p in exported_parts if p.startswith("ppt/charts/chart") and p.endswith(".xml")])
            slides_or_sheets = len([p for p in exported_parts if p.startswith("ppt/slides/slide") and p.endswith(".xml")])

        media = len([p for p in exported_parts if "/media/" in p])
        relationships = len([p for p in exported_parts if p.endswith(".rels")])
        if not (xml_parts > 0 and tables + slides_or_sheets > 0 and font_count > 0
                and layout > 0 and media >= 2 and relationships > 0):
            raise ValueError("OFFICE368_RICH_ELEMENTS_MISSING")
        if kind != "docx" and charts == 0:
            raise ValueError("OFFICE368_CHART_MISSING")

        return {
            "format": kind,
            "parts": len(exported_parts),
            "xmlPartsParsed": xml_parts,
            "tablesOrCells": tables,
            "fontsOrThemes": font_count,
            "layoutDeclarations": layout,
            "mediaExact": media,
            "chartsExact": charts,
            "slidesOrSheets": slides_or_sheets,
            "allPartsByteIdentical": True,
            "visualPageFidelity": "NOT_RENDERED",
        }


if __name__ == "__main__":
    try:
        print("OFFICE368_REOPEN_PASS " + json.dumps(inspect(Path(sys.argv[1]), Path(sys.argv[2])), sort_keys=True))
    except (AssertionError, KeyError, OSError, ValueError, ET.ParseError, IndexError) as exc:
        print(f"OFFICE368_REOPEN_FAIL {exc}", file=sys.stderr)
        sys.exit(1)
