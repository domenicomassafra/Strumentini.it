"""Independent pypdf inspection of #237 exported raster-only PDFs.

The test passes a plan JSON from the browser under test, but this inspector
derives all actual PDF object and decoded pixel bytes with pypdf + zlib, not
the product's TypeScript writer, parser or post-export verifier.
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader
from pdfminer.high_level import extract_text


def check(source: Path, result: Path, plan_path: Path) -> dict:
    marker = [b"PRIVATE_237_SOURCE_ONLY_NEVER_OUTPUT_4D792A", b"ORPHAN_237_RECOVERABLE_PRIVATE_7F9D13"]
    original = PdfReader(source, strict=False)
    exported = PdfReader(result, strict=True)
    plan = json.loads(plan_path.read_text("utf8"))
    assert len(exported.pages) == len(original.pages) == plan["pageCount"]
    assert exported.metadata is None, "Original metadata must not be copied"
    assert not exported.is_encrypted
    assert all(secret not in result.read_bytes() for secret in marker), "Source marker recovered in raw exported bytes"
    assert not exported.trailer.get("/Prev"), "Exporter must not retain incremental chain"
    assert not exported.trailer.get("/XRefStm"), "Exporter must not retain hybrid xref"
    assert "/AcroForm" not in exported.trailer["/Root"], "Form recovery"
    assert not extract_text(str(result)).strip(), "Independent pdfminer found searchable text in exported output"
    if "covered-orphan" in source.name:
        assert marker[0].decode("ascii") in extract_text(str(source)), "Must prove text beneath opaque overlay is recoverable before redaction"
        assert marker[1] in source.read_bytes(), "Must prove orphan token recoverable before redaction"
    verified = 0
    canvas_witness = 0
    for page_number, (page, expected) in enumerate(zip(exported.pages, plan["pages"]), 1):
        assert page_number == expected["page"]
        assert not (page.extract_text() or "").strip(), "Recoverable text in raster PDF"
        assert "/Annots" not in page and "/AA" not in page, "Interactive data copied"
        assert set(page["/Resources"].keys()) == {"/XObject"}, "Resources beyond a raster"
        xobjects = page["/Resources"]["/XObject"]
        assert list(xobjects.keys()) == ["/Im0"], "Extra image/object references remain"
        image = xobjects["/Im0"].get_object()
        assert image["/Subtype"] == "/Image" and image["/ColorSpace"] == "/DeviceRGB"
        assert image["/Filter"] == "/FlateDecode" and image["/BitsPerComponent"] == 8
        width, height = int(image["/Width"]), int(image["/Height"])
        assert (width, height) == (expected["pixelWidth"], expected["pixelHeight"])
        rgb = image.get_data()  # pypdf independently decompresses FlateDecode
        assert len(rgb) == width * height * 3
        assert all(secret not in rgb for secret in marker), "Recoverable marker in XObject pixels"
        mask = bytearray(width * height)
        for region in expected["regions"]:
            import math

            x0 = math.floor(region["left"] * width)
            y0 = math.floor(region["top"] * height)
            x1 = math.ceil((region["left"] + region["width"]) * width)
            y1 = math.ceil((region["top"] + region["height"]) * height)
            for y in range(y0, y1):
                for x in range(x0, x1):
                    at = y * width + x
                    mask[at] = 1
                    assert rgb[at * 3: at * 3 + 3] == b"\x00\x00\x00", f"Recoverable darkened pixel {page_number} ({x}, {y})"
        verified += sum(mask)
        canvas_witness += sum(1 for at in range(width * height) if not mask[at] and rgb[at * 3:at * 3 + 3] != b"\x00\x00\x00")
        content = page.get_contents().get_data()
        assert b"/Im0 Do" in content and b" Tj" not in content and b" TJ" not in content
        assert not re.search(rb"/(?:Font|JavaScript|Metadata|Sig|EmbeddedFiles)\b", content)
    assert verified > 0, "No region checked"
    assert canvas_witness > 0, "Untouched visual content should survive as pixels"
    return {"pages": len(exported.pages), "blackPixels": verified, "outsideColoredPixels": canvas_witness,
            "pypdf": "PASS", "pdfminer": "PASS"}


if __name__ == "__main__":
    print(json.dumps(check(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])), sort_keys=True))
