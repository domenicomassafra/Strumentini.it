"""Independent Python zipfile + Office library reopen for browser-generated files."""
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

output, original = map(Path, sys.argv[1:3])
suffix = output.suffix
with zipfile.ZipFile(original) as before, zipfile.ZipFile(output) as after:
    assert after.testzip() is None, "ZIP CRC mismatch"
    assert sorted(after.namelist()) == sorted(before.namelist()), "Member path changed"
    for part in before.namelist():
        if "/media/" in part:
            continue
        assert after.read(part) == before.read(part), f"Non-media byte changed: {part}"
        if part.endswith(".xml") or part.endswith(".rels"):
            ElementTree.fromstring(after.read(part))
    paths = [p for p in after.namelist() if "/media/" in p]
    assert len(paths) == 2, "Expected two embedded raster media"

if suffix == ".docx":
    from docx import Document
    doc = Document(output)
    assert "Ticket 264" in "\n".join(p.text for p in doc.paragraphs)
    assert len(doc.inline_shapes) == 2
elif suffix == ".pptx":
    from pptx import Presentation
    slides = Presentation(output).slides
    assert len(slides) == 1 and sum(len(s.shapes) for s in slides) == 2
elif suffix == ".xlsx":
    with zipfile.ZipFile(output) as z:
        assert z.read("xl/workbook.xml")
        assert any(p.startswith("xl/drawings/drawing") for p in z.namelist())
        assert z.read("xl/worksheets/sheet1.xml").find(b"264") >= 0
else:
    raise ValueError("Unsupported OOXML fixture")
print(f"REOPEN_OK {suffix} ZIP CRC+XML+relationships+office structure")
