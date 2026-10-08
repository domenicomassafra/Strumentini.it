"""Independently compare downloaded Office XML/rels/fonts/charts and reopen."""
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import sys

original, output = (Path(p) for p in sys.argv[1:3])
assert original.suffix == output.suffix
with ZipFile(original) as source, ZipFile(output) as result:
    assert result.testzip() is None
    assert set(source.namelist()) == set(result.namelist())
    for part in source.namelist():
        if "/media/" in part:
            continue
        assert source.read(part) == result.read(part), f"Altered Office part: {part}"
        if part.endswith((".rels", ".xml")):
            ET.fromstring(result.read(part))
    assert any(path.endswith(".rels") for path in result.namelist())
    # Explicitly require chart/font references in the corpus and byte-identity
    # of any font payloads (including *.odttf should the package contain them).
    assert any("/charts/" in p and p.endswith(".xml") for p in result.namelist()) or original.suffix == ".docx"
    assert any("styles.xml" in p or "fontTable.xml" in p or "/theme/" in p for p in result.namelist())

if output.suffix == ".docx":
    from docx import Document
    doc = Document(output)
    assert len(doc.inline_shapes) == 2 and len(doc.tables) >= 1
    assert any(p.text.startswith("Office chart and editability regression") for p in doc.paragraphs)
elif output.suffix == ".pptx":
    from pptx import Presentation
    pres = Presentation(output)
    assert len(pres.slides) == 1 and sum(bool(s.has_chart) for s in pres.slides[0].shapes) >= 1
elif output.suffix == ".xlsx":
    with ZipFile(output) as book:
        assert book.read("xl/workbook.xml")
        assert any(p.startswith("xl/charts/chart") for p in book.namelist())
        assert any("externalLink" in p or b"https://example.invalid/office-no-fetch" in book.read(p)
                   for p in book.namelist() if p.endswith(".rels"))
else:
    raise AssertionError("Unexpected Office extension")
print(f"OOXML68_REOPEN_OK {output.suffix}: charts/tables/fonts/links XML byte-identical, ZIP CRC valid")
